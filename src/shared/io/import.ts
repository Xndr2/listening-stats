/**
 * Import: parse, clean, drop what we already have, insert in one go.
 * A play counts as already stored when the same track has a row starting
 * within 90 seconds of it (Spotify's export and the tracker disagree on the
 * exact start by a few seconds).
 */
import { playThresholdMs } from "../settings/registry";
import { bulkAddPlayEvents, forEachPlayEventChunk } from "../storage/play-events";
import type { PlayEvent } from "../types/play-event";
import { type Parsed, parseImport } from "./formats";
import { syntheticUris } from "./synthetic-uris";
import { cleanEvent } from "./validate";

export const MAX_FILE_BYTES = 300 * 1024 * 1024;
const SAME_PLAY_MS = 90_000;

export interface ImportResult {
	format: string;
	imported: number;
	duplicates: number;
	ignored: number;
	errors: number;
	/** First few rejection reasons, for the UI. */
	errorDetails: string[];
}

/**
 * Index of start times per track, bucketed by 90 s, so a duplicate check only
 * looks at three tiny buckets instead of every play of that track (a file
 * with a million plays of one song must not freeze Spotify).
 */
type Index = Map<string, number[]>;
const bucketKey = (uri: string, t: number) => `${uri}|${Math.floor(t / SAME_PLAY_MS)}`;

function isDuplicate(index: Index, e: PlayEvent): boolean {
	const b = Math.floor(e.startedAt / SAME_PLAY_MS);
	for (const k of [b - 1, b, b + 1]) {
		const times = index.get(`${e.trackUri}|${k}`);
		if (times?.some((t) => Math.abs(t - e.startedAt) < SAME_PLAY_MS)) return true;
	}
	return false;
}

function remember(index: Index, e: PlayEvent): void {
	const key = bucketKey(e.trackUri, e.startedAt);
	const list = index.get(key);
	if (list) list.push(e.startedAt);
	else index.set(key, [e.startedAt]);
}

const breathe = () => new Promise((r) => setTimeout(r, 0));

export async function importRows(parsed: Parsed): Promise<ImportResult> {
	const res: ImportResult = {
		format: parsed.format,
		imported: 0,
		duplicates: 0,
		ignored: parsed.ignored,
		errors: 0,
		errorDetails: [],
	};
	const clean: PlayEvent[] = [];
	for (let i = 0; i < parsed.rows.length; i++) {
		const e = cleanEvent(parsed.rows[i]);
		if (typeof e === "string") {
			res.errors++;
			if (res.errorDetails.length < 5) res.errorDetails.push(`Row ${i + 1}: ${e}`);
			continue;
		}
		// Rows without uris get the same stand-in ids v2 used, so they group by song.
		if (!e.trackUri || !e.artistUri) {
			const s = await syntheticUris(e.trackName, e.artistName, e.albumName);
			e.trackUri ||= s.trackUri;
			e.artistUri ||= s.artistUri;
			e.albumUri ||= s.albumUri;
		}
		clean.push(e);
		if (i % 5000 === 4999) await breathe();
	}
	if (clean.length === 0) return res;

	// Existing rows in the import's time span, indexed by track.
	let min = Number.POSITIVE_INFINITY;
	let max = 0;
	for (const e of clean) {
		min = Math.min(min, e.startedAt);
		max = Math.max(max, e.startedAt);
	}
	const index: Index = new Map();
	await forEachPlayEventChunk(min - SAME_PLAY_MS, max + SAME_PLAY_MS, (rows) => {
		for (const r of rows) remember(index, r);
	});

	const fresh: PlayEvent[] = [];
	for (let i = 0; i < clean.length; i++) {
		const e = clean[i];
		if (i % 5000 === 4999) await breathe();
		if (isDuplicate(index, e)) {
			res.duplicates++;
			continue;
		}
		remember(index, e);
		fresh.push(e);
	}
	// Insert in slices so one huge import doesn't hold a single giant transaction.
	for (let i = 0; i < fresh.length; i += 5000) res.imported += await bulkAddPlayEvents(fresh.slice(i, i + 5000));
	return res;
}

export async function importFile(file: {
	name: string;
	size: number;
	arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<ImportResult> {
	if (file.size > MAX_FILE_BYTES)
		throw new Error("That file is over 300 MB. Split it or import the zip from Spotify instead.");
	// Spotify exports have no "skip" flag; use the user's own play threshold.
	const parsed = await parseImport(file.name, await file.arrayBuffer(), playThresholdMs(0) || 30_000);
	return importRows(parsed);
}
