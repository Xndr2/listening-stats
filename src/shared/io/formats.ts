/**
 * Recognises and parses every history format LS accepts:
 *  - v3 export (JSON, format "listening-stats")
 *  - v2 backup ({ version: 1, events })
 *  - v1/v2 raw JSON array of play events
 *  - v1 and v2 CSV exports
 *  - Spotify's "Extended streaming history" (zip, or one of its JSON files)
 * Output rows are unvalidated; import.ts cleans them.
 */
import { splitCsvRow } from "./csv";
import { syntheticUris } from "./synthetic-uris";
import { ZipError, zipTexts } from "./zip";

export interface Parsed {
	format: string;
	rows: unknown[];
	/** Rows dropped on purpose (podcasts, zero-length), not errors. */
	ignored: number;
}

export class ImportFormatError extends Error {}

const V1_CSV = "Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At";
const V2_CSV = `${V1_CSV},Type,Track URI,Artist URI,Album URI,Album Art`;

const unformula = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

async function parseCsv(text: string): Promise<Parsed> {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const header = (lines[0] ?? "").replace(/^﻿/, "").trim();
	const isV2 = header === V2_CSV;
	if (!isV2 && header !== V1_CSV) {
		if (/^(Period|Rank),/.test(header)) {
			throw new ImportFormatError("This CSV is a stats summary, not play history. Export your play history instead.");
		}
		throw new ImportFormatError("This CSV isn't a Listening Stats play history export.");
	}
	const rows: unknown[] = [];
	for (const line of lines.slice(1)) {
		const f = splitCsvRow(line).map(unformula);
		if (f.length < 7) {
			rows.push(null); // counted as an error by the cleaner
			continue;
		}
		const [trackName, artistName, albumName, dur, played, started, ended] = f;
		const uris =
			isV2 && f[8]
				? { trackUri: f[8], artistUri: f[9] ?? "", albumUri: f[10] ?? "" }
				: await syntheticUris(trackName, artistName, albumName);
		rows.push({
			trackName,
			artistName,
			albumName,
			durationMs: Number(dur),
			playedMs: Number(played),
			startedAt: Date.parse(started),
			endedAt: Date.parse(ended),
			type: isV2 && f[7] === "skip" ? "skip" : "play",
			albumArt: isV2 ? f[11] : undefined,
			...uris,
		});
	}
	return { format: isV2 ? "Listening Stats CSV" : "Listening Stats v1 CSV", rows, ignored: 0 };
}

interface SpotifyRecord {
	ts?: unknown;
	ms_played?: unknown;
	master_metadata_track_name?: unknown;
	master_metadata_album_artist_name?: unknown;
	master_metadata_album_album_name?: unknown;
	spotify_track_uri?: unknown;
	episode_name?: unknown;
	spotify_episode_uri?: unknown;
}

const isSpotifyRecord = (v: unknown): v is SpotifyRecord =>
	!!v && typeof v === "object" && "ms_played" in v && "ts" in v;

/** Spotify history rows. Only track fields are read: IP, country and device fields are ignored. */
async function fromSpotify(
	records: SpotifyRecord[],
	skipBelowMs: number,
): Promise<{ rows: unknown[]; ignored: number }> {
	const rows: unknown[] = [];
	let ignored = 0;
	for (const r of records) {
		const name = r.master_metadata_track_name;
		const played = typeof r.ms_played === "number" ? r.ms_played : 0;
		if (typeof name !== "string" || !name || r.spotify_episode_uri || r.episode_name || played <= 0) {
			ignored++;
			continue;
		}
		const artist = typeof r.master_metadata_album_artist_name === "string" ? r.master_metadata_album_artist_name : "";
		const album = typeof r.master_metadata_album_album_name === "string" ? r.master_metadata_album_album_name : "";
		const synth = await syntheticUris(name, artist, album);
		const endedAt = typeof r.ts === "string" ? Date.parse(r.ts) : Number.NaN; // ts = when the stream ended
		rows.push({
			trackName: name,
			artistName: artist,
			albumName: album,
			trackUri: typeof r.spotify_track_uri === "string" ? r.spotify_track_uri : synth.trackUri,
			artistUri: synth.artistUri,
			albumUri: synth.albumUri,
			durationMs: 0,
			playedMs: played,
			startedAt: endedAt - played,
			endedAt,
			type: played < skipBelowMs ? "skip" : "play",
		});
	}
	return { rows, ignored };
}

const SPOTIFY_FILE = /(^|\/)(Streaming_History_Audio_[^/]*|endsong_\d+)\.json$/i;

export async function parseImport(name: string, data: ArrayBuffer, skipBelowMs: number): Promise<Parsed> {
	const lower = name.toLowerCase();
	if (lower.endsWith(".zip")) {
		const rows: unknown[] = [];
		let ignored = 0;
		let found = 0;
		try {
			// One file at a time: its text is dropped before the next is unpacked.
			for await (const f of zipTexts(data, (n) => SPOTIFY_FILE.test(n))) {
				found++;
				const j: unknown = JSON.parse(f.text);
				if (!Array.isArray(j)) continue;
				const part = await fromSpotify(j.filter(isSpotifyRecord), skipBelowMs);
				for (const r of part.rows) rows.push(r);
				ignored += part.ignored;
			}
		} catch (e) {
			if (e instanceof ZipError) throw new ImportFormatError(e.message);
			if (e instanceof SyntaxError) throw new ImportFormatError("A history file in the zip isn't valid JSON.");
			throw new ImportFormatError("Couldn't read the zip file.");
		}
		if (found === 0) {
			throw new ImportFormatError(
				'No streaming history found in the zip. Request "Extended streaming history" from Spotify.',
			);
		}
		return { format: "Spotify streaming history", rows, ignored };
	}
	const text = new TextDecoder().decode(data);
	if (lower.endsWith(".csv")) return parseCsv(text);
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new ImportFormatError("The file isn't valid JSON or CSV.");
	}
	if (json && typeof json === "object" && !Array.isArray(json)) {
		const o = json as Record<string, unknown>;
		if (o.format === "listening-stats" && Array.isArray(o.events))
			return { format: "Listening Stats v3 export", rows: o.events, ignored: 0 };
		if (o.version === 1 && Array.isArray(o.events))
			return { format: "Listening Stats v2 backup", rows: o.events, ignored: 0 };
		if ("topTracks" in o || "totalPlays" in o) {
			throw new ImportFormatError("This is a stats summary export, not play history.");
		}
	}
	if (Array.isArray(json)) {
		if (json.length > 0 && isSpotifyRecord(json[0])) {
			return { format: "Spotify streaming history", ...(await fromSpotify(json.filter(isSpotifyRecord), skipBelowMs)) };
		}
		return { format: "Listening Stats JSON", rows: json, ignored: 0 };
	}
	throw new ImportFormatError("Listening Stats doesn't recognise this file.");
}
