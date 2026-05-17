/**
 * CSV/JSON/ZIP import: parsing, dedup, bulk insert.
 * Supports v1 CSV export, v1 JSON export, Spotify streaming history JSON,
 * and Spotify data-request ZIP archives.
 *
 * Exports `importFileEvents` (distinct from backup.ts `importPlayEvents`).
 *
 * Import bypasses live-play 3s bucket dedup; uses startedAt + trackName keys,
 * Dexie bulkAdd, type "play", skips bad rows, dedups within the batch.
 */

import { unzipSync } from "fflate";
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

/** Cap error details at 10 entries to avoid bloating the result */
const MAX_ERROR_DETAILS = 10;

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
 * Parse a v1 CSV export into an array of PlayEvent-shaped objects.
 *
 * Expected header (exact match required):
 *   Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At
 *
 * Started At / Ended At are ISO 8601 strings  -  converted to Unix ms via new Date().getTime().
 * Rows with invalid timestamps or non-numeric numeric fields are skipped and counted as errors.
 * All valid events get synthetic URIs and type: "play".
 */
export async function parseV1Csv(text: string): Promise<ParseResult> {
	// Split on \n and filter empty lines
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	if (lines.length === 0) {
		return { events: [], errors: 0, errorDetails: [] };
	}

	const header = lines[0];
	if (header !== V1_CSV_HEADER) {
		// Detect known non-importable CSV formats and give specific guidance
		if (header.startsWith("Period,")) {
			throw new Error(
				'Import failed: this is a stats summary CSV, not a raw history export. Use "Raw History (CSV)" in v1 to get importable data.',
			);
		}
		if (header.startsWith("Rank,")) {
			throw new Error(
				'Import failed: this is a stats summary CSV, not a raw history export. Use "Raw History (CSV)" in v1 to get importable data.',
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

		const uris = await generateSyntheticUris(track, artist, album);

		events.push({
			trackName: track,
			artistName: artist,
			albumName: album,
			durationMs,
			playedMs,
			startedAt,
			endedAt,
			type: "play",
			...uris,
		});
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
 * All events get type: "play" regardless of source.
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
			type: "play",
		};

		if (typeof item.albumArt === "string" && item.albumArt) {
			event.albumArt = item.albumArt;
		}

		events.push(event);
	}

	return { events, errors, errorDetails };
}

// ──────────────────────────────────────────────────────
// Spotify Streaming History
// ──────────────────────────────────────────────────────

interface SpotifyStreamingHistoryItem {
	endTime: string;
	artistName: string;
	trackName: string;
	msPlayed: number;
}

interface SpotifyEndsongItem {
	ts: string;
	master_metadata_album_artist_name: string | null;
	master_metadata_track_name: string | null;
	master_metadata_album_album_name: string | null;
	ms_played: number;
	spotify_track_uri: string | null;
}

/**
 * Detect whether a parsed JSON array is Spotify streaming history format
 * (has `endTime`, `msPlayed` fields instead of PlayEvent fields).
 */
function isSpotifyStreamingHistory(data: unknown[]): boolean {
	if (data.length === 0) return false;
	const first = data[0] as Record<string, unknown>;
	return "endTime" in first && "msPlayed" in first && !("startedAt" in first);
}

/**
 * Detect whether a parsed JSON array is Spotify endsong format
 * (has `ts`, `ms_played`, `master_metadata_track_name`).
 */
function isSpotifyEndsong(data: unknown[]): boolean {
	if (data.length === 0) return false;
	const first = data[0] as Record<string, unknown>;
	return "ts" in first && "ms_played" in first && "master_metadata_track_name" in first;
}

/**
 * Parse a Spotify streaming history JSON array (from data-request export)
 * into PlayEvent-shaped objects.
 *
 * Format:
 *   { endTime: "2024-01-15 14:30", artistName: "...", trackName: "...", msPlayed: 180000 }
 *
 * `endTime` is treated as the event end time; startedAt = endTime - msPlayed.
 * Rows with missing/empty names or non-positive msPlayed are skipped.
 */
export async function parseSpotifyStreamingHistory(data: SpotifyStreamingHistoryItem[]): Promise<ParseResult> {
	const events: Omit<PlayEvent, "id">[] = [];
	let errors = 0;
	const errorDetails: string[] = [];

	for (let i = 0; i < data.length; i++) {
		const rowNum = i + 1;
		const item = data[i];

		const artistName = (item.artistName ?? "").trim();
		const trackName = (item.trackName ?? "").trim();
		const msPlayed =
			typeof item.msPlayed === "number" ? item.msPlayed : parseInt(item.msPlayed as unknown as string, 10);

		if (!artistName || !trackName) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: missing artist or track name`);
			}
			continue;
		}

		if (!Number.isFinite(msPlayed) || msPlayed <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid or zero msPlayed (${item.msPlayed})`);
			}
			continue;
		}

		const endedAt = new Date(item.endTime).getTime();
		if (!Number.isFinite(endedAt) || Number.isNaN(endedAt) || endedAt <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid endTime ("${item.endTime}")`);
			}
			continue;
		}

		const startedAt = endedAt - msPlayed;
		const durationMs = msPlayed;

		const uris = await generateSyntheticUris(trackName, artistName, "");

		events.push({
			trackName,
			artistName,
			albumName: "",
			durationMs,
			playedMs: msPlayed,
			startedAt,
			endedAt,
			type: "play",
			...uris,
		});
	}

	return { events, errors, errorDetails };
}

/**
 * Parse a Spotify endsong JSON array (from desktop-client export)
 * into PlayEvent-shaped objects.
 *
 * Format:
 *   { ts: "2024-01-15T14:30:00Z", master_metadata_album_artist_name: "...",
 *     master_metadata_track_name: "...", master_metadata_album_album_name: "...",
 *     ms_played: 180000, spotify_track_uri: "spotify:track:xxx" }
 *
 * Rows with null track/artist (non-music items like podcasts/ads) are skipped.
 */
export async function parseSpotifyEndsong(data: SpotifyEndsongItem[]): Promise<ParseResult> {
	const events: Omit<PlayEvent, "id">[] = [];
	let errors = 0;
	const errorDetails: string[] = [];

	for (let i = 0; i < data.length; i++) {
		const rowNum = i + 1;
		const item = data[i];

		const artistName = (item.master_metadata_album_artist_name ?? "").trim();
		const trackName = (item.master_metadata_track_name ?? "").trim();
		const albumName = (item.master_metadata_album_album_name ?? "").trim();
		const msPlayed = typeof item.ms_played === "number" ? item.ms_played : 0;

		if (!artistName || !trackName) {
			errors++;
			continue;
		}

		if (!Number.isFinite(msPlayed) || msPlayed <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid or zero ms_played (${item.ms_played})`);
			}
			continue;
		}

		const endedAt = new Date(item.ts).getTime();
		if (!Number.isFinite(endedAt) || Number.isNaN(endedAt) || endedAt <= 0) {
			errors++;
			if (errorDetails.length < MAX_ERROR_DETAILS) {
				errorDetails.push(`Row ${rowNum}: invalid timestamp ("${item.ts}")`);
			}
			continue;
		}

		const startedAt = endedAt - msPlayed;
		const durationMs = msPlayed;

		let trackUri: string;
		let artistUri: string;
		let albumUri: string;

		if (typeof item.spotify_track_uri === "string" && item.spotify_track_uri) {
			trackUri = item.spotify_track_uri;
			artistUri = "";
			albumUri = "";
		} else {
			const uris = await generateSyntheticUris(trackName, artistName, albumName);
			trackUri = uris.trackUri;
			artistUri = uris.artistUri;
			albumUri = uris.albumUri;
		}

		events.push({
			trackName,
			artistName,
			albumName,
			durationMs,
			playedMs: msPlayed,
			startedAt,
			endedAt,
			trackUri,
			artistUri,
			albumUri,
			type: "play",
		});
	}

	return { events, errors, errorDetails };
}

/**
 * Parse Spotify JSON text by detecting the format (streaming history or endsong).
 */
export async function parseSpotifyJson(text: string): Promise<ParseResult> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("Import failed: file is not valid JSON");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Import failed: Spotify JSON must be an array");
	}

	if (isSpotifyEndsong(parsed)) {
		return parseSpotifyEndsong(parsed as SpotifyEndsongItem[]);
	}

	if (isSpotifyStreamingHistory(parsed)) {
		return parseSpotifyStreamingHistory(parsed as SpotifyStreamingHistoryItem[]);
	}

	throw new Error(
		"Import failed: unrecognized JSON format. Expected Spotify StreamingHistory, endsong, or stats.fm v1 export.",
	);
}

// ──────────────────────────────────────────────────────
// ZIP extraction
// ──────────────────────────────────────────────────────

/**
 * Parse a ZIP buffer containing Spotify data-request files.
 * Extracts and parses all `StreamingHistory*.json` and `endsong_*.json` files,
 * merging their events together.
 */
export async function parseSpotifyZip(buffer: ArrayBuffer): Promise<ParseResult> {
	const uint8 = new Uint8Array(buffer);
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(uint8);
	} catch {
		throw new Error("Import failed: invalid ZIP file");
	}

	const allEvents: Omit<PlayEvent, "id">[] = [];
	let totalErrors = 0;
	const allErrorDetails: string[] = [];

	const pushErrors = (result: ParseResult) => {
		totalErrors += result.errors;
		allEvents.push(...result.events);
		for (const d of result.errorDetails) {
			if (allErrorDetails.length < MAX_ERROR_DETAILS) {
				allErrorDetails.push(d);
			}
		}
	};

	for (const [filename, data] of Object.entries(files)) {
		if (!filename.endsWith(".json")) continue;

		if (!filename.startsWith("StreamingHistory") && !filename.startsWith("endsong_")) {
			continue;
		}

		const text = new TextDecoder().decode(data);
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			totalErrors++;
			if (allErrorDetails.length < MAX_ERROR_DETAILS) {
				allErrorDetails.push(`ZIP: "${filename}" is not valid JSON`);
			}
			continue;
		}

		if (!Array.isArray(parsed)) {
			totalErrors++;
			if (allErrorDetails.length < MAX_ERROR_DETAILS) {
				allErrorDetails.push(`ZIP: "${filename}" JSON is not an array`);
			}
			continue;
		}

		if (isSpotifyEndsong(parsed)) {
			const result = await parseSpotifyEndsong(parsed as SpotifyEndsongItem[]);
			pushErrors(result);
		} else if (isSpotifyStreamingHistory(parsed)) {
			const result = await parseSpotifyStreamingHistory(parsed as SpotifyStreamingHistoryItem[]);
			pushErrors(result);
		} else {
			totalErrors++;
			if (allErrorDetails.length < MAX_ERROR_DETAILS) {
				allErrorDetails.push(`ZIP: "${filename}" unrecognized format`);
			}
		}
	}

	if (allEvents.length === 0 && totalErrors === 0) {
		throw new Error(
			"Import failed: no Spotify data files found in ZIP (expected StreamingHistory*.json or endsong_*.json)",
		);
	}

	return { events: allEvents, errors: totalErrors, errorDetails: allErrorDetails };
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
