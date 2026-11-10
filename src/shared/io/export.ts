/**
 * Exports. JSON is the full backup (play history plus settings); CSV is the
 * same history in v2's column layout so either version can read it back.
 * Neither ever contains provider credentials.
 */
import { APP_VERSION } from "../constants/app";
import { V2_KEYS } from "../constants/storage-keys";
import { SETTINGS } from "../settings/registry";
import { allPlayEvents } from "../storage/play-events";
import type { PlayEvent } from "../types/play-event";
import { csvField } from "./csv";

/**
 * Only real settings go into a backup: every key the settings registry owns,
 * plus v2's preferences blob. Credentials, the device id, caches and health
 * data stay on the device.
 */
const EXPORTED_KEYS = new Set<string>([...Object.values(SETTINGS).map((d) => d.key), V2_KEYS.PREFERENCES]);
const NEVER = new Set<string>([V2_KEYS.LASTFM_API_KEY, V2_KEYS.LASTFM_CONFIG, V2_KEYS.STATSFM_CONFIG]);

export interface V3Export {
	format: "listening-stats";
	version: 3;
	appVersion: string;
	exportedAt: number;
	count: number;
	settings: Record<string, string>;
	events: PlayEvent[];
}

function exportableSettings(): Record<string, string> {
	const out: Record<string, string> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !EXPORTED_KEYS.has(k) || NEVER.has(k)) continue;
		const v = localStorage.getItem(k);
		if (v !== null) out[k] = v;
	}
	return out;
}

export async function buildJsonExport(): Promise<V3Export> {
	const events = (await allPlayEvents()).map(({ id: _id, resolvedAt: _r, ...e }) => e);
	return {
		format: "listening-stats",
		version: 3,
		appVersion: APP_VERSION,
		exportedAt: Date.now(),
		count: events.length,
		settings: exportableSettings(),
		events,
	};
}

export async function buildCsvExport(): Promise<string> {
	const head =
		"Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At,Type,Track URI,Artist URI,Album URI,Album Art";
	const rows = (await allPlayEvents()).map((e) =>
		[
			csvField(e.trackName),
			csvField(e.artistName),
			csvField(e.albumName),
			e.durationMs,
			e.playedMs,
			new Date(e.startedAt).toISOString(),
			new Date(e.endedAt).toISOString(),
			e.type ?? "play",
			csvField(e.trackUri),
			csvField(e.artistUri),
			csvField(e.albumUri),
			csvField(e.albumArt ?? ""),
		].join(","),
	);
	return `${head}\n${rows.join("\n")}\n`;
}

export function saveFile(content: string, name: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
