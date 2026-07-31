/**
 * Spotify "Extended streaming history" zip import.
 *
 * Users request the export at https://www.spotify.com/account/privacy/
 * (select only "Extended streaming history"). The zip contains
 * `Streaming_History_Audio_*.json` files (older exports: `endsong_*.json`),
 * each a JSON array of stream records.
 *
 * Privacy: records carry IP address, user agent, platform and country fields.
 * Those are deliberately never read here - only track metadata, timestamps
 * and played-ms are mapped into PlayEvents.
 */

import type { ParseResult } from "./import";
import { generateSyntheticUris } from "./synthetic-uris";

// ──────────────────────────────────────────────────────
// Minimal zip reader (stored + deflate entries)
// ──────────────────────────────────────────────────────

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface ZipEntry {
	name: string;
	compressionMethod: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number {
	// EOCD is at the end, preceded by an up-to-64KB comment.
	const minPos = Math.max(0, view.byteLength - 22 - 0xffff);
	for (let pos = view.byteLength - 22; pos >= minPos; pos--) {
		if (view.getUint32(pos, true) === EOCD_SIG) return pos;
	}
	throw new Error("Import failed: not a valid zip file");
}

function readCentralDirectory(buffer: ArrayBuffer): ZipEntry[] {
	const view = new DataView(buffer);
	const eocd = findEndOfCentralDirectory(view);
	const entryCount = view.getUint16(eocd + 10, true);
	const centralOffset = view.getUint32(eocd + 16, true);
	const utf8 = new TextDecoder();

	const entries: ZipEntry[] = [];
	let pos = centralOffset;
	for (let i = 0; i < entryCount; i++) {
		if (view.getUint32(pos, true) !== CENTRAL_SIG) {
			throw new Error("Import failed: corrupt zip central directory");
		}
		const compressionMethod = view.getUint16(pos + 10, true);
		const compressedSize = view.getUint32(pos + 20, true);
		const uncompressedSize = view.getUint32(pos + 24, true);
		const nameLength = view.getUint16(pos + 28, true);
		const extraLength = view.getUint16(pos + 30, true);
		const commentLength = view.getUint16(pos + 32, true);
		const localHeaderOffset = view.getUint32(pos + 42, true);

		if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
			throw new Error("Import failed: zip64 archives are not supported (entry over 4 GB)");
		}

		entries.push({
			name: utf8.decode(new Uint8Array(buffer, pos + 46, nameLength)),
			compressionMethod,
			compressedSize,
			uncompressedSize,
			localHeaderOffset,
		});
		pos += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
	const source = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(data);
			controller.close();
		},
	});
	// TS lib disagreement between BufferSource and Uint8Array stream typings
	const inflater = new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
	const inflated = source.pipeThrough(inflater);
	return new Uint8Array(await new Response(inflated).arrayBuffer());
}

async function readZipEntryText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
	const view = new DataView(buffer);
	const pos = entry.localHeaderOffset;
	if (view.getUint32(pos, true) !== LOCAL_SIG) {
		throw new Error("Import failed: corrupt zip local header");
	}
	// Local header name/extra lengths can differ from the central directory's.
	const nameLength = view.getUint16(pos + 26, true);
	const extraLength = view.getUint16(pos + 28, true);
	const dataStart = pos + 30 + nameLength + extraLength;
	const compressed = new Uint8Array(buffer, dataStart, entry.compressedSize);

	let bytes: Uint8Array;
	if (entry.compressionMethod === 0) {
		bytes = compressed;
	} else if (entry.compressionMethod === 8) {
		bytes = await inflateRaw(compressed);
	} else {
		throw new Error(`Import failed: unsupported zip compression method ${entry.compressionMethod}`);
	}
	return new TextDecoder("utf-8").decode(bytes);
}

// ──────────────────────────────────────────────────────
// Extended streaming history parsing
// ──────────────────────────────────────────────────────

/** Extended history files: current exports and the pre-2023 `endsong_N.json` name. */
const EXTENDED_HISTORY_FILE = /(^|\/)(Streaming_History_Audio[^/]*|endsong(_\d+)?)\.json$/i;

/** Account-data ("non-extended") history files - not importable, detect for a helpful error. */
const ACCOUNT_DATA_FILE = /(^|\/)StreamingHistory(_music)?_?\d*\.json$/i;

/** Below this a stream counts as a skip, not a play (industry-standard 30s rule). */
const PLAY_THRESHOLD_MS = 30_000;

const MAX_ERROR_DETAILS = 10;

export interface SpotifyZipParseResult extends ParseResult {
	/** Extended-history files found and parsed. */
	filesRead: number;
	/** Non-track rows dropped: podcasts/audiobooks/videos and zero-ms rows. */
	ignored: number;
}

interface ExtendedRecord {
	ts?: unknown;
	ms_played?: unknown;
	master_metadata_track_name?: unknown;
	master_metadata_album_artist_name?: unknown;
	master_metadata_album_album_name?: unknown;
	spotify_track_uri?: unknown;
	episode_name?: unknown;
	spotify_episode_uri?: unknown;
}

async function parseExtendedRecords(
	records: unknown[],
	fileName: string,
	result: SpotifyZipParseResult,
): Promise<void> {
	for (const raw of records) {
		if (typeof raw !== "object" || raw === null) {
			result.errors++;
			if (result.errorDetails.length < MAX_ERROR_DETAILS) {
				result.errorDetails.push(`${fileName}: non-object record`);
			}
			continue;
		}
		const r = raw as ExtendedRecord;

		// Podcasts, audiobooks and rows without track metadata are not music plays.
		const trackName = r.master_metadata_track_name;
		if (typeof trackName !== "string" || trackName.length === 0 || r.spotify_episode_uri || r.episode_name) {
			result.ignored++;
			continue;
		}

		const msPlayed = typeof r.ms_played === "number" && Number.isFinite(r.ms_played) ? r.ms_played : -1;
		if (msPlayed <= 0) {
			result.ignored++;
			continue;
		}

		const endedAt = typeof r.ts === "string" ? Date.parse(r.ts) : Number.NaN;
		if (!Number.isFinite(endedAt) || endedAt <= 0) {
			result.errors++;
			if (result.errorDetails.length < MAX_ERROR_DETAILS) {
				result.errorDetails.push(`${fileName}: invalid "ts" value ${JSON.stringify(r.ts).slice(0, 40)}`);
			}
			continue;
		}

		// "ts" is the stream END time (UTC). offline_timestamp is deliberately
		// ignored: its unit flips between s and ms across export eras, and
		// offline-sync rows are duplicated with differing values, which would
		// defeat startedAt-based dedupe.
		const startedAt = endedAt - msPlayed;

		const artistName =
			typeof r.master_metadata_album_artist_name === "string" ? r.master_metadata_album_artist_name : "";
		const albumName = typeof r.master_metadata_album_album_name === "string" ? r.master_metadata_album_album_name : "";

		const uris = await generateSyntheticUris(trackName, artistName, albumName);
		const trackUri =
			typeof r.spotify_track_uri === "string" && r.spotify_track_uri.startsWith("spotify:track:")
				? r.spotify_track_uri
				: uris.trackUri;

		result.events.push({
			trackName,
			artistName,
			albumName,
			durationMs: msPlayed,
			playedMs: msPlayed,
			startedAt,
			endedAt: startedAt + msPlayed,
			trackUri,
			artistUri: uris.artistUri,
			albumUri: uris.albumUri,
			type: msPlayed >= PLAY_THRESHOLD_MS ? "play" : "skip",
		});
	}
}

/**
 * Parse a Spotify privacy-export zip into PlayEvent-shaped objects.
 * Throws with user-facing guidance when the zip is not an extended
 * streaming history export.
 */
export async function parseSpotifyZip(buffer: ArrayBuffer): Promise<SpotifyZipParseResult> {
	const entries = readCentralDirectory(buffer);

	const historyEntries = entries.filter((e) => EXTENDED_HISTORY_FILE.test(e.name));
	if (historyEntries.length === 0) {
		if (entries.some((e) => ACCOUNT_DATA_FILE.test(e.name))) {
			throw new Error(
				'Import failed: this is the "Account data" export, which only covers the last year. Request "Extended streaming history" instead at spotify.com/account/privacy/',
			);
		}
		throw new Error("Import failed: no streaming history files found in this zip");
	}

	const result: SpotifyZipParseResult = {
		events: [],
		errors: 0,
		errorDetails: [],
		filesRead: 0,
		ignored: 0,
	};

	for (const entry of historyEntries) {
		const text = await readZipEntryText(buffer, entry);
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			result.errors++;
			if (result.errorDetails.length < MAX_ERROR_DETAILS) {
				result.errorDetails.push(`${entry.name}: not valid JSON`);
			}
			continue;
		}
		if (!Array.isArray(parsed)) {
			result.errors++;
			if (result.errorDetails.length < MAX_ERROR_DETAILS) {
				result.errorDetails.push(`${entry.name}: expected a JSON array`);
			}
			continue;
		}
		result.filesRead++;
		await parseExtendedRecords(parsed, entry.name, result);
	}

	// Duplicate records across files exist in real exports; importFileEvents
	// dedupes by startedAt + trackName both against the DB and within a batch,
	// but chunked imports lose the cross-chunk view - so dedupe the full set here.
	const seen = new Set<string>();
	const deduped: typeof result.events = [];
	for (const e of result.events) {
		const key = `${e.startedAt}:${e.trackName}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(e);
	}
	result.events = deduped;

	return result;
}
