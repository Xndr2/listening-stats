/**
 * Every imported row passes through here before it can reach the database.
 * Files come from anywhere, so nothing is trusted: types, ranges, lengths,
 * uri shapes and image hosts are all checked, and unknown fields dropped.
 */
import type { PlayEvent } from "../types/play-event";
import { isSafeImageUrl } from "../util/url-allowlist";

const MAX_TEXT = 500;
const EARLIEST = Date.UTC(2006, 0, 1); // before Spotify existed
const MAX_DURATION = 24 * 3_600_000;
const URI = /^(spotify|listening-stats):(track|artist|album|episode|local):[A-Za-z0-9%:+._-]{1,200}$/;

// Control characters in imported names are replaced with spaces.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\u0000-\u001f\u007f]/g;
const text = (v: unknown): string | null => (typeof v === "string" ? v.replace(CONTROL, " ").slice(0, MAX_TEXT) : null);

const int = (v: unknown, min: number, max: number): number | null =>
	typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

export const uriOk = (v: unknown): v is string => typeof v === "string" && (v === "" || URI.test(v));

/** A clean PlayEvent, or a reason the row was rejected. */
export function cleanEvent(raw: unknown, now = Date.now()): PlayEvent | string {
	if (!raw || typeof raw !== "object") return "not an object";
	const r = raw as Record<string, unknown>;
	const trackName = text(r.trackName);
	const artistName = text(r.artistName);
	if (!trackName || artistName === null) return "missing track or artist name";
	const latest = now + 86_400_000;
	const startedAt = int(r.startedAt, EARLIEST, latest);
	if (startedAt === null) return "start time out of range";
	const durationMs = int(r.durationMs, 0, MAX_DURATION) ?? 0;
	const playedMs = int(r.playedMs, 0, MAX_DURATION);
	if (playedMs === null) return "invalid played time";
	const endedAt = int(r.endedAt, startedAt, latest) ?? startedAt + playedMs;
	for (const k of ["trackUri", "artistUri", "albumUri"] as const) {
		if (r[k] !== undefined && !uriOk(r[k])) return `invalid ${k}`;
	}
	const ev: PlayEvent = {
		trackUri: (r.trackUri as string) ?? "",
		trackName,
		artistName,
		artistUri: (r.artistUri as string) ?? "",
		albumName: text(r.albumName) ?? "",
		albumUri: (r.albumUri as string) ?? "",
		durationMs,
		playedMs,
		startedAt,
		endedAt,
		type: r.type === "skip" ? "skip" : "play",
	};
	if (isSafeImageUrl(r.albumArt as string)) ev.albumArt = r.albumArt as string;
	return ev;
}
