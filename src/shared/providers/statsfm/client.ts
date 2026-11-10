/**
 * stats.fm public API (api.stats.fm/api/v1). Only public profile data; no
 * login. Responses are checked for the fields we read before they're used.
 */
import { V2_KEYS } from "../../constants/storage-keys";
import { getJson, HttpError } from "../../net/http";

export const SFM_BASE = "https://api.stats.fm/api/v1";

/** v2's saved connection (same key and shape). */
export interface StatsFmConfig {
	username: string;
	isPlus: boolean;
	connectedAt?: number;
	lastValidated?: number;
}

export function readStatsFmConfig(): StatsFmConfig | null {
	try {
		const raw = localStorage.getItem(V2_KEYS.STATSFM_CONFIG);
		if (!raw) return null;
		const c = JSON.parse(raw) as Partial<StatsFmConfig>;
		if (typeof c.username !== "string" || !c.username) return null;
		return { ...c, username: c.username, isPlus: c.isPlus === true };
	} catch {
		return null;
	}
}

export function writeStatsFmConfig(c: StatsFmConfig | null): void {
	if (c) localStorage.setItem(V2_KEYS.STATSFM_CONFIG, JSON.stringify(c));
	else localStorage.removeItem(V2_KEYS.STATSFM_CONFIG);
}

/** stats.fm usernames / custom ids: letters, digits, - _ . (keeps the URL path safe). */
export function isValidUsername(u: string): boolean {
	return /^[A-Za-z0-9._-]{2,64}$/.test(u);
}

// --- response shapes (only fields we use) -----------------------------------

export interface SfmTrack {
	id: number;
	name: string;
	durationMs?: number;
	artists: Array<{ id: number; name: string; image?: string | null }>;
	albums: Array<{ id: number; name: string; image?: string | null }>;
	externalIds?: { spotify?: string[] };
}

export interface SfmArtist {
	id: number;
	name: string;
	image?: string | null;
	genres?: string[];
	followers?: number;
	externalIds?: { spotify?: string[] };
}

export interface SfmAlbum {
	id: number;
	name: string;
	image?: string | null;
	artists?: Array<{ name: string }>;
	externalIds?: { spotify?: string[] };
}

interface Ranked {
	position: number;
	streams: number | null;
	playedMs: number | null;
}

export type SfmTopTrack = Ranked & { track: SfmTrack };
export type SfmTopArtist = Ranked & { artist: SfmArtist };
export type SfmTopAlbum = Ranked & { album: SfmAlbum };
export type SfmTopGenre = Ranked & { genre: { tag: string } };
export interface SfmRecent {
	endTime: string;
	track: SfmTrack;
}
export interface SfmStreamStats {
	count: number;
	durationMs: number;
	cardinality?: { tracks?: number; artists?: number; albums?: number };
}
type Bucket = Record<string, { count: number; durationMs: number }>;
export interface SfmDateStats {
	hours?: Bucket;
	weekDays?: Bucket;
	monthDays?: Bucket;
}
export interface SfmUser {
	id: string;
	customId?: string;
	displayName: string;
	image?: string | null;
	isPlus?: boolean;
	timezone?: string;
}

function userPath(username: string): string {
	if (!isValidUsername(username)) throw new HttpError("not-found", "That doesn't look like a stats.fm username");
	return `${SFM_BASE}/users/${encodeURIComponent(username)}`;
}

/** GET users/<u>/<path>?<params> and return `.items`, checked to be the right kind. */
export async function sfmItems<T>(
	username: string,
	path: string,
	params: Record<string, string | number>,
	expect: "array" | "object",
	signal?: AbortSignal,
): Promise<T> {
	const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
	const url = `${userPath(username)}${path}${qs.size ? `?${qs}` : ""}`;
	const body = await getJson<{ items?: unknown }>(url, { signal });
	const items = body?.items;
	const ok = expect === "array" ? Array.isArray(items) : !!items && typeof items === "object" && !Array.isArray(items);
	if (!ok) throw new HttpError("bad-response", "stats.fm sent an unexpected response");
	return items as T;
}

export async function fetchSfmUser(username: string, signal?: AbortSignal): Promise<SfmUser> {
	const body = await getJson<{ item?: SfmUser }>(userPath(username), { signal });
	if (!body?.item || typeof body.item.displayName !== "string") {
		throw new HttpError("bad-response", "stats.fm sent an unexpected profile");
	}
	return body.item;
}

export function spotifyUri(kind: "track" | "artist" | "album", ids: string[] | undefined): string {
	const id = ids?.[0];
	return id && /^[A-Za-z0-9]{10,30}$/.test(id) ? `spotify:${kind}:${id}` : "";
}
