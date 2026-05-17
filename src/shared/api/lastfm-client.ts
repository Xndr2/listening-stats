import type { AppError } from "../errors";
import type { WorldScope, WorldTrack, WorldWindow } from "../types/world-charts";

// ── User data types (for Last.fm as a stats provider) ──

export interface LfmRecentTrack {
	name: string;
	artist: string;
	album: string;
	albumArt?: string;
	playedAt: number; // Unix ms
}

export interface LfmTopTrack {
	name: string;
	artist: string;
	playCount: number;
	album?: string;
	albumArt?: string;
}

export interface LfmTopArtist {
	name: string;
	playCount: number;
	imageUrl?: string;
}

export interface LfmTopAlbum {
	name: string;
	artist: string;
	playCount: number;
	imageUrl?: string;
}

export interface LfmUserInfo {
	username: string;
	totalScrobbles: number;
	registered: string;
	imageUrl?: string;
}

const BASE = "https://ws.audioscrobbler.com/2.0/";

const COUNTRY_MAP: Record<string, string> = {
	us: "united states",
	gb: "united kingdom",
	jp: "japan",
};

export type LastfmResult = { ok: true; data: WorldTrack[] } | { ok: false; status: number; message: string };

interface LastfmRawTrack {
	name: string;
	artist: { name: string } | string;
	playcount?: string;
	listeners?: string;
}

function formatPlays(raw: string | undefined): string {
	const n = Number(raw ?? "0");
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
	return String(n);
}

function trackId(name: string, artist: string): string {
	return `lfm-${name}-${artist}`.replace(/\s+/g, "-").toLowerCase();
}

function mapTracks(raw: LastfmRawTrack[]): WorldTrack[] {
	return raw.map((t) => {
		const artist = typeof t.artist === "string" ? t.artist : t.artist.name;
		return {
			id: trackId(t.name, artist),
			title: t.name,
			artist,
			country: "",
			plays: formatPlays(t.playcount ?? t.listeners),
			delta: 0,
		};
	});
}

interface LastfmRawArtist {
	name: string;
	playcount?: string;
	listeners?: string;
}

function mapArtists(raw: LastfmRawArtist[]): WorldTrack[] {
	return raw.map((a) => ({
		id: `lfm-artist-${a.name}`.replace(/\s+/g, "-").toLowerCase(),
		title: a.name,
		artist: "",
		country: "",
		plays: formatPlays(a.listeners ?? a.playcount),
		delta: 0,
	}));
}

async function fetchChart(
	scope: WorldScope,
	apiKey: string,
	worldMethod: string,
	geoMethod: string,
	parseResponse: (json: Record<string, unknown>) => WorldTrack[],
): Promise<LastfmResult> {
	const params = new URLSearchParams({
		api_key: apiKey,
		format: "json",
		limit: "50",
	});

	params.set("method", scope === "world" ? worldMethod : geoMethod);
	if (scope !== "world") {
		params.set("country", COUNTRY_MAP[scope] ?? scope);
	}

	try {
		const res = await fetch(`${BASE}?${params.toString()}`);

		if (!res.ok) {
			return { ok: false, status: res.status, message: `HTTP ${res.status}` };
		}

		const json = await res.json();
		return { ok: true, data: parseResponse(json) };
	} catch (err) {
		return { ok: false, status: 0, message: String(err) };
	}
}

export async function lastfmGetCharts(scope: WorldScope, _window: WorldWindow, apiKey: string): Promise<LastfmResult> {
	return fetchChart(scope, apiKey, "chart.gettoptracks", "geo.gettoptracks", (json) => {
		const raw = json?.tracks as { track?: unknown } | undefined;
		return mapTracks(Array.isArray(raw?.track) ? raw.track : []);
	});
}

export async function lastfmGetArtistCharts(
	scope: WorldScope,
	_window: WorldWindow,
	apiKey: string,
): Promise<LastfmResult> {
	return fetchChart(scope, apiKey, "chart.gettopartists", "geo.gettopartists", (json) => {
		const raw = json?.topartists as { artist?: unknown } | undefined;
		return mapArtists(Array.isArray(raw?.artist) ? raw.artist : []);
	});
}

export function classifyLastfmError(status: number, message: string, resetAt?: number): AppError {
	if (status === 403) {
		return { variant: "InvalidApiKey", message, retryable: false };
	}
	if (status === 429) {
		return { variant: "RateLimited", message, retryable: false, resetAt };
	}
	if (status >= 500 && status <= 599) {
		return { variant: "ServiceDown", message, retryable: true };
	}
	if (status === 0) {
		return { variant: "NetworkError", message, retryable: true };
	}
	return { variant: "Unknown", message, retryable: true };
}

export type LastfmValidation = { valid: true } | { valid: false; reason: "invalid_key" | "network" };

export async function validateLastfmKey(apiKey: string): Promise<LastfmValidation> {
	const result = await lastfmGetCharts("world", "today", apiKey);
	if (result.ok) return { valid: true };
	if (result.status === 403) return { valid: false, reason: "invalid_key" };
	return { valid: false, reason: "network" };
}

// ── User data API (for Last.fm stats provider) ──

const LASTFM_PLACEHOLDER_HASHES = ["2a96cbd8b46e442fc41c2b86b821562f", "c6f59c1e5e7240a4c0d427abd71f3dbb"];

function isPlaceholderImage(url: string): boolean {
	return LASTFM_PLACEHOLDER_HASHES.some((h) => url.includes(h));
}

function bestImage(images: Array<{ size: string; "#text": string }> | undefined): string | undefined {
	const img = images?.find((i) => i.size === "large")?.["#text"]?.trim();
	return img && !isPlaceholderImage(img) ? img : undefined;
}

async function lastfmUserFetch<T>(apiKey: string, method: string, params: Record<string, string>): Promise<T> {
	const url = new URL(BASE);
	url.searchParams.set("api_key", apiKey);
	url.searchParams.set("format", "json");
	url.searchParams.set("method", method);
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}

	const res = await fetch(url.toString());
	if (!res.ok) {
		if (res.status === 403) throw new Error("Invalid Last.fm API key");
		if (res.status === 429) throw new Error("Last.fm rate limited");
		throw new Error(`Last.fm API error: ${res.status}`);
	}
	const data = await res.json();
	if (data.error) {
		throw new Error(data.message || `Last.fm error ${data.error}`);
	}
	return data as T;
}

export async function lastfmGetUserInfo(apiKey: string, username: string): Promise<LfmUserInfo> {
	const data = await lastfmUserFetch<any>(apiKey, "user.getinfo", { user: username });
	const user = data.user;
	return {
		username: user.name,
		totalScrobbles: parseInt(user.playcount, 10) || 0,
		registered: user.registered?.["#text"] || "",
		imageUrl: bestImage(user.image),
	};
}

export async function lastfmGetRecentTracks(
	apiKey: string,
	username: string,
	limit = 50,
	page = 1,
	from?: number,
	to?: number,
): Promise<LfmRecentTrack[]> {
	const params: Record<string, string> = {
		user: username,
		limit: String(limit),
		page: String(page),
	};
	if (from !== undefined) params.from = String(Math.floor(from / 1000));
	if (to !== undefined) params.to = String(Math.floor(to / 1000));

	const data = await lastfmUserFetch<any>(apiKey, "user.getrecenttracks", params);
	const tracks: any[] = data.recenttracks?.track || [];
	return tracks
		.filter((t: any) => t.date || t["@attr"]?.nowplaying)
		.map((t: any) => ({
			name: t.name,
			artist: t.artist?.["#text"] || t.artist?.name || "",
			album: t.album?.["#text"] || "",
			albumArt: bestImage(t.image),
			playedAt: t.date?.uts ? parseInt(t.date.uts, 10) * 1000 : Date.now(),
		}));
}

export async function lastfmGetTopTracks(
	apiKey: string,
	username: string,
	period: string,
	limit = 200,
): Promise<LfmTopTrack[]> {
	const data = await lastfmUserFetch<any>(apiKey, "user.gettoptracks", {
		user: username,
		period,
		limit: String(limit),
	});
	const tracks: any[] = data.toptracks?.track || [];
	return tracks.map((t: any) => ({
		name: t.name,
		artist: t.artist?.name || "",
		playCount: parseInt(t.playcount, 10) || 0,
		albumArt: bestImage(t.image),
	}));
}

export async function lastfmGetTopArtists(
	apiKey: string,
	username: string,
	period: string,
	limit = 100,
): Promise<LfmTopArtist[]> {
	const data = await lastfmUserFetch<any>(apiKey, "user.gettopartists", {
		user: username,
		period,
		limit: String(limit),
	});
	const artists: any[] = data.topartists?.artist || [];
	return artists.map((a: any) => ({
		name: a.name,
		playCount: parseInt(a.playcount, 10) || 0,
		imageUrl: bestImage(a.image),
	}));
}

export async function lastfmGetTopAlbums(
	apiKey: string,
	username: string,
	period: string,
	limit = 100,
): Promise<LfmTopAlbum[]> {
	const data = await lastfmUserFetch<any>(apiKey, "user.gettopalbums", {
		user: username,
		period,
		limit: String(limit),
	});
	const albums: any[] = data.topalbums?.album || [];
	return albums.map((a: any) => ({
		name: a.name,
		artist: a.artist?.name || "",
		playCount: parseInt(a.playcount, 10) || 0,
		imageUrl: bestImage(a.image),
	}));
}
