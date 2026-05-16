import type { AppError } from "../errors";
import type { WorldScope, WorldTrack, WorldWindow } from "../types/world-charts";

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
