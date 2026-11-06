/**
 * Last.fm API (ws.audioscrobbler.com/2.0). Needs the user's own API key, as
 * in v2. Last.fm reports some errors as HTTP 200 with an `error` field, so
 * every response goes through `lfmCall`.
 */
import { V2_KEYS } from "../../constants/storage-keys";
import { getJson, HttpError } from "../../net/http";

const BASE = "https://ws.audioscrobbler.com/2.0/";

export interface LastFmConfig {
	apiKey: string;
	username: string;
}

/** v2 stored { apiKey, username } in lastfm-provider and the key alone in lastfm-api-key. */
export function readLastFmConfig(): LastFmConfig | null {
	try {
		const raw = localStorage.getItem(V2_KEYS.LASTFM_CONFIG);
		const c = raw ? (JSON.parse(raw) as Partial<LastFmConfig>) : {};
		const apiKey = c.apiKey || localStorage.getItem(V2_KEYS.LASTFM_API_KEY) || "";
		if (!apiKey || typeof c.username !== "string" || !c.username) return null;
		return { apiKey, username: c.username };
	} catch {
		return null;
	}
}

export function writeLastFmConfig(c: LastFmConfig | null): void {
	if (c) {
		localStorage.setItem(V2_KEYS.LASTFM_CONFIG, JSON.stringify(c));
		localStorage.setItem(V2_KEYS.LASTFM_API_KEY, c.apiKey);
	} else {
		localStorage.removeItem(V2_KEYS.LASTFM_CONFIG);
		localStorage.removeItem(V2_KEYS.LASTFM_API_KEY);
	}
}

export const isValidApiKey = (k: string) => /^[a-f0-9]{32}$/i.test(k.trim());
export const isValidLfmUsername = (u: string) => /^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(u.trim());

// Last.fm error codes we treat specially
const ERR_INVALID_KEY = 10;
const ERR_NOT_FOUND = 6;
const ERR_RATE = 29;

export async function lfmCall<T>(
	method: string,
	params: Record<string, string | number>,
	cfg: LastFmConfig,
	signal?: AbortSignal,
): Promise<T> {
	const qs = new URLSearchParams({
		method,
		user: cfg.username,
		api_key: cfg.apiKey,
		format: "json",
		...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
	});
	let body: T & { error?: number; message?: string };
	try {
		body = await getJson(`${BASE}?${qs}`, { signal });
	} catch (e) {
		// 403 from Last.fm = bad key; give the user something to act on
		if (e instanceof HttpError && e.kind === "auth")
			throw new HttpError("auth", "Last.fm didn't accept the API key", e.status);
		throw e;
	}
	if (typeof body?.error === "number") {
		if (body.error === ERR_INVALID_KEY) throw new HttpError("auth", "Last.fm didn't accept the API key");
		if (body.error === ERR_NOT_FOUND) throw new HttpError("not-found", "Last.fm doesn't know that user");
		if (body.error === ERR_RATE) throw new HttpError("rate-limited", "Last.fm asked us to slow down");
		throw new HttpError("server", `Last.fm error ${body.error}`);
	}
	return body;
}

// --- shapes ---------------------------------------------------------------

export interface LfmImage {
	size: string;
	"#text": string;
}

export interface LfmTrack {
	name: string;
	artist: { "#text"?: string; name?: string };
	album?: { "#text"?: string };
	image?: LfmImage[];
	playcount?: string;
	date?: { uts: string };
	"@attr"?: { nowplaying?: string; rank?: string };
}

export interface LfmArtist {
	name: string;
	playcount?: string;
	image?: LfmImage[];
}

export interface LfmAlbum {
	name: string;
	artist: { "#text"?: string; name?: string };
	playcount?: string;
	image?: LfmImage[];
}

/** Last.fm's placeholder star image: treat as no image. */
const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

export function lfmImage(images: LfmImage[] | undefined): string | undefined {
	const url = images?.find((i) => i.size === "extralarge")?.["#text"] || images?.at(-1)?.["#text"];
	return url && !url.includes(PLACEHOLDER) && url.startsWith("https://") ? url : undefined;
}

export const lfmArtistName = (a: { "#text"?: string; name?: string }) => a["#text"] ?? a.name ?? "";

export const asArray = <T>(v: T | T[] | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
