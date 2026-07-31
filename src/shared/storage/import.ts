/**
 * CSV/JSON import: parsing, dedup, bulk insert.
 * Exports `importFileEvents` (distinct from backup.ts `importPlayEvents`).
 *
 * Import bypasses live-play 3s bucket dedup; uses startedAt + trackName keys,
 * Dexie bulkAdd, type "play", skips bad rows, dedups within the batch.
 */

import type { PlayEvent } from "../types/play-event";
import { db } from "./db";
import { generateSyntheticUris } from "./synthetic-uris";
import { resolveImportedUris } from "./uri-resolver";

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

export interface ImportResult {
	imported: number;
	skipped: number;
	errors: number;
	errorDetails: string[];
}

export type ParseResult = {
	events: Omit<PlayEvent, "id">[];
	errors: number;
	errorDetails: string[];
};

// ──────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────

/** v1 raw-history CSV header (includes parentheses in Duration / Played column names). */
const V1_CSV_HEADER = "Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At";

/** v2 backup CSV header: v1 columns plus type/URIs/art so exports round-trip losslessly. */
const V2_CSV_HEADER = `${V1_CSV_HEADER},Type,Track URI,Artist URI,Album URI,Album Art`;

/** Cap error details at 10 entries to avoid bloating the result */
const MAX_ERROR_DETAILS = 10;

/**
 * Album art from imported files ends up in <img src> and CSS url(). Restrict to
 * the CDNs this app itself writes (Spotify, Last.fm, stats.fm) - an arbitrary
 * https URL would let a crafted import file beacon the user's IP to any host
 * on every dashboard render.
 */
const ALBUM_ART_HOSTS = new Set(["lastfm.freetls.fastly.net", "cdn.stats.fm"]);

function isSafeAlbumArtUrl(value: string): boolean {
	if (value.startsWith("spotify:image:")) return true;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		return url.hostname.endsWith(".scdn.co") || ALBUM_ART_HOSTS.has(url.hostname);
	} catch {
		return false;
	}
}

// ──────────────────────────────────────────────────────
// CSV field splitter (handles quoted commas)
// ──────────────────────────────────────────────────────

/**
 * Split a single CSV row into fields, respecting double-quoted fields that
 * may contain commas. Strips surrounding quotes from quoted fields.
 */
function splitCsvRow(row: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < row.length; i++) {
		const ch = row[i];
		if (ch === '"') {
			if (inQuotes && row[i + 1] === '"') {
				// Escaped quote ("") within quoted field
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === "," && !inQuotes) {
			fields.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

// ──────────────────────────────────────────────────────
// parseV1Csv
// ──────────────────────────────────────────────────────

/**
 * Parse a raw-history CSV export into an array of PlayEvent-shaped objects.
 *
 * Accepts two headers (exact match required):
 *   v1: Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At
 *   v2: v1 + Type,Track URI,Artist URI,Album URI,Album Art (this app's backup export)
 *
 * Started At / Ended At are ISO 8601 strings  -  converted to Unix ms via new Date().getTime().
 * Rows with invalid timestamps or non-numeric numeric fields are skipped and counted as errors.
 * v1 rows get synthetic URIs and type: "play"; v2 rows keep their type, URIs and
 * (safe-host) album art, falling back to synthetic URIs when the URI columns are empty.
 */
export async function parseHistoryCsv(text: string): Promise<ParseResult> {
	// Split on \n and filter empty lines
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length === 0) {
		return { events: [], errors: 0, errorDetails: [] };
	}

	const header = lines[0];
	const isV2 = header === V2_CSV_HEADER;
	if (!isV2 && header !== V1_CSV_HEADER) {
		// Detect known non-importable CSV formats and give specific guidance
		if (header.startsWith("Period,")) {
			throw new Error(
				'Import failed: this is a stats summary CSV, not a raw history export. Use "Export play history as CSV" to create an importable backup.',
			);
		}
		if (header.startsWith("Rank,")) {
			throw new Error(
				'Import failed: this is a stats summary CSV, not a raw history export. Use "Export play history as CSV" to create an importable backup.',
			);
		}
		throw new Error(`Import failed: unrecognized CSV format (expected v1 export). Got: "${header.slice(0, 60)}"`);
	}

	const events: Omit<PlayEvent, "id">[] = [];
	let errors = 0;
	const errorDetails: string[] = [];

	const dataRows = lines.slice(1);

	for (let i = 0; i < dataRows.length; i++) {
		const rowNum = i + 2; // 1-indexed, row 1 is header
		const row = dataRows[i];

		const fields = splitCsvRow(row);
		if (fields.length < 7) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: expected 7 fields, got ${fields.length}`);
			}
			continue;
		}

		const [track, artist, album, durationRaw, playedRaw, startedRaw, endedRaw] = fields;

		const durationMs = parseInt(durationRaw, 10);
		const playedMs = parseInt(playedRaw, 10);
		const startedAt = new Date(startedRaw).getTime();
		const endedAt = new Date(endedRaw).getTime();

		if (Number.isNaN(durationMs) || Number.isNaN(playedMs)) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid numeric field (duration or played ms)`);
			}
			continue;
		}

		if (!Number.isFinite(startedAt) || Number.isNaN(startedAt) || startedAt <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid timestamp (Started At: "${startedRaw}")`);
			}
			continue;
		}

		if (!Number.isFinite(endedAt) || Number.isNaN(endedAt) || endedAt <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid timestamp (Ended At: "${endedRaw}")`);
			}
			continue;
		}

		const csvTrackUri = isV2 ? fields[8] : "";
		const uris = csvTrackUri
			? { trackUri: csvTrackUri, artistUri: fields[9] ?? "", albumUri: fields[10] ?? "" }
			: await generateSyntheticUris(track, artist, album);

		const event: Omit<PlayEvent, "id"> = {
			trackName: track,
			artistName: artist,
			albumName: album,
			durationMs,
			playedMs,
			startedAt,
			endedAt,
			type: isV2 && fields[7] === "skip" ? "skip" : "play",
			...uris,
		};

		const csvAlbumArt = isV2 ? fields[11] : "";
		if (csvAlbumArt && isSafeAlbumArtUrl(csvAlbumArt)) {
			event.albumArt = csvAlbumArt;
		}

		events.push(event);
	}

	return { events, errors, errorDetails };
}

// ──────────────────────────────────────────────────────
// parseJsonEvents
// ──────────────────────────────────────────────────────

/**
 * Parse a raw JSON PlayEvent array (v1 export format) into PlayEvent-shaped objects.
 *
 * Accepts: JSON array of objects with PlayEvent fields.
 * Rejects: non-array JSON (throws), StatsResult-shaped objects (throws).
 *
 * Required fields: trackName, artistName, startedAt, endedAt, durationMs, playedMs.
 * Missing albumName defaults to "". Missing URIs get synthetic values.
 * type "skip" is preserved so this app's own JSON backups round-trip; anything
 * else becomes "play".
 */
export async function parseJsonEvents(text: string): Promise<ParseResult> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("Import failed: file is not valid JSON");
	}

	if (!Array.isArray(parsed)) {
		// Detect StatsResult-shaped objects specifically
		if (typeof parsed === "object" && parsed !== null && "topTracks" in (parsed as Record<string, unknown>)) {
			throw new Error("Import failed: JSON must be a raw play events array, not a stats export");
		}
		throw new Error("Import failed: JSON must be a raw play events array, not a stats export");
	}

	const events: Omit<PlayEvent, "id">[] = [];
	let errors = 0;
	const errorDetails: string[] = [];

	for (let i = 0; i < parsed.length; i++) {
		const item = parsed[i] as Record<string, unknown>;
		const rowNum = i + 1;

		// Validate required fields
		if (
			typeof item.trackName !== "string" ||
			typeof item.artistName !== "string" ||
			typeof item.startedAt !== "number" ||
			typeof item.endedAt !== "number" ||
			typeof item.durationMs !== "number" ||
			typeof item.playedMs !== "number"
		) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: missing required field(s)`);
			}
			continue;
		}

		// Reject NaN/Infinity/negative values - they pass the typeof check but
		// would corrupt period queries and duration totals once stored.
		if (
			!Number.isFinite(item.startedAt) ||
			item.startedAt <= 0 ||
			!Number.isFinite(item.endedAt) ||
			item.endedAt <= 0 ||
			!Number.isFinite(item.durationMs) ||
			item.durationMs < 0 ||
			!Number.isFinite(item.playedMs) ||
			item.playedMs < 0
		) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid numeric field (timestamp or duration)`);
			}
			continue;
		}

		const trackName = item.trackName;
		const artistName = item.artistName;
		const albumName = typeof item.albumName === "string" ? item.albumName : "";
		const durationMs = item.durationMs;
		const playedMs = item.playedMs;
		const startedAt = item.startedAt;
		const endedAt = item.endedAt;

		// Generate or preserve URIs
		let trackUri: string;
		let artistUri: string;
		let albumUri: string;

		if (typeof item.trackUri === "string" && item.trackUri) {
			// Keep original URIs if present
			trackUri = item.trackUri;
			artistUri = typeof item.artistUri === "string" ? item.artistUri : "";
			albumUri = typeof item.albumUri === "string" ? item.albumUri : "";
		} else {
			// Generate synthetic URIs when trackUri is missing/falsy
			const uris = await generateSyntheticUris(trackName, artistName, albumName);
			trackUri = uris.trackUri;
			artistUri = uris.artistUri;
			albumUri = uris.albumUri;
		}

		const event: Omit<PlayEvent, "id"> = {
			trackName,
			artistName,
			albumName,
			durationMs,
			playedMs,
			startedAt,
			endedAt,
			trackUri,
			artistUri,
			albumUri,
			type: item.type === "skip" ? "skip" : "play",
		};

		if (typeof item.albumArt === "string" && isSafeAlbumArtUrl(item.albumArt)) {
			event.albumArt = item.albumArt;
		}

		events.push(event);
	}

	return { events, errors, errorDetails };
}

// ──────────────────────────────────────────────────────
// importFileEvents
// ──────────────────────────────────────────────────────

/** Dedupe by startedAt + trackName, bulk-add new rows, then kick off URI resolution. */
export async function importFileEvents(events: Omit<PlayEvent, "id">[]): Promise<ImportResult> {
	if (events.length === 0) {
		return { imported: 0, skipped: 0, errors: 0, errorDetails: [] };
	}

	// Query existing records by startedAt (indexed  -  fast batch lookup)
	const startedAts = events.map((e) => e.startedAt);
	const existing = await db.playEvents.where("startedAt").anyOf(startedAts).toArray();

	// Build O(1) lookup Set from existing records
	const existingKeys = new Set(existing.map((e) => `${e.startedAt}:${e.trackName}`));

	const toInsert: Omit<PlayEvent, "id">[] = [];
	let skipped = 0;

	for (const event of events) {
		const key = `${event.startedAt}:${event.trackName}`;
		if (existingKeys.has(key)) {
			skipped++;
		} else {
			toInsert.push(event);
			// Skip duplicates inside this import batch
			existingKeys.add(key);
		}
	}

	let errorCount = 0;
	const errorDetails: string[] = [];

	if (toInsert.length > 0) {
		try {
			await db.playEvents.bulkAdd(toInsert as PlayEvent[]);
		} catch (err: unknown) {
			// Handle Dexie BulkError  -  some items may have failed but others succeeded
			if (
				err !== null &&
				typeof err === "object" &&
				"failures" in err &&
				err.failures !== null &&
				typeof err.failures === "object"
			) {
				const failures = err.failures as Record<string, unknown>;
				errorCount = Object.keys(failures).length;
				if (errorDetails.length < MAX_ERROR_DETAILS) {
					errorDetails.push(`bulkAdd: ${errorCount} item(s) failed to insert`);
				}
			} else {
				// Unexpected error  -  rethrow so callers can handle it
				throw err;
			}
		}
	}

	// Background URI upgrade after successful inserts
	if (toInsert.length - errorCount > 0) {
		resolveImportedUris().catch((err) => {
			console.warn("[listening-stats] URI resolution error:", err);
		});
	}

	return {
		imported: toInsert.length - errorCount,
		skipped,
		errors: errorCount,
		errorDetails,
	};
}
