export type { WorldTrack, WorldScope, WorldWindow } from "../shared/types/world-charts";
import type { WorldScope, WorldTrack, WorldWindow } from "../shared/types/world-charts";
import { lastfmGetCharts, lastfmGetArtistCharts, type LastfmResult } from "../shared/api/lastfm-client";
import { lastfmCache, chartCacheKey, artistCacheKey } from "../shared/api/lastfm-cache";
import { LS_KEYS } from "../shared/constants/storage-keys";

export const WORLD_TRACKS: readonly WorldTrack[] = [
	{ id: "w1", title: "Espresso", artist: "Sabrina Carpenter", country: "US", plays: "12.4M", delta: +2 },
	{ id: "w2", title: "Beautiful Things", artist: "Benson Boone", country: "US", plays: "9.8M", delta: 0 },
	{ id: "w3", title: "Houdini", artist: "Dua Lipa", country: "GB", plays: "8.2M", delta: +5 },
	{ id: "w4", title: "Lose Control", artist: "Teddy Swims", country: "US", plays: "7.9M", delta: -1 },
	{ id: "w5", title: "Cruel Summer", artist: "Taylor Swift", country: "US", plays: "7.1M", delta: -3 },
	{ id: "w6", title: "Stick Season", artist: "Noah Kahan", country: "US", plays: "6.4M", delta: +1 },
	{ id: "w7", title: "Bad Habit", artist: "Steve Lacy", country: "US", plays: "5.9M", delta: -2 },
	{ id: "w8", title: "Pedro", artist: "Jaxomy & Agatino", country: "IT", plays: "5.3M", delta: +8 },
];

export const WORLD_ARTISTS: readonly WorldTrack[] = [
	{ id: "a1", title: "Taylor Swift", artist: "", country: "US", plays: "95.2M", delta: 0 },
	{ id: "a2", title: "The Weeknd", artist: "", country: "CA", plays: "82.1M", delta: +1 },
	{ id: "a3", title: "Bad Bunny", artist: "", country: "PR", plays: "71.4M", delta: -1 },
	{ id: "a4", title: "Drake", artist: "", country: "CA", plays: "63.8M", delta: +2 },
	{ id: "a5", title: "Sabrina Carpenter", artist: "", country: "US", plays: "58.3M", delta: +5 },
	{ id: "a6", title: "Billie Eilish", artist: "", country: "US", plays: "52.7M", delta: -2 },
	{ id: "a7", title: "Dua Lipa", artist: "", country: "GB", plays: "47.9M", delta: +3 },
	{ id: "a8", title: "BTS", artist: "", country: "KR", plays: "44.1M", delta: -1 },
];

export function getCharts(_scope: WorldScope, _window: WorldWindow): WorldTrack[] {
	return [...WORLD_TRACKS];
}

async function fetchWithCache(
	scope: WorldScope,
	window: WorldWindow,
	fallback: readonly WorldTrack[],
	cacheKeyFn: (s: WorldScope, w: WorldWindow) => string,
	apiFn: (s: WorldScope, w: WorldWindow, key: string) => Promise<LastfmResult>,
): Promise<LastfmResult> {
	const apiKey = localStorage.getItem(LS_KEYS.LASTFM_API_KEY);
	if (!apiKey) {
		return { ok: true, data: [...fallback] };
	}

	const key = cacheKeyFn(scope, window);
	const cached = await lastfmCache.get(key);
	if (cached) {
		return { ok: true, data: cached };
	}

	const result = await apiFn(scope, window, apiKey);
	if (result.ok) {
		await lastfmCache.set(key, result.data);
	}
	return result;
}

export function getChartsAsync(scope: WorldScope, window: WorldWindow): Promise<LastfmResult> {
	return fetchWithCache(scope, window, WORLD_TRACKS, chartCacheKey, lastfmGetCharts);
}

export function getArtistChartsAsync(scope: WorldScope, window: WorldWindow): Promise<LastfmResult> {
	return fetchWithCache(scope, window, WORLD_ARTISTS, artistCacheKey, lastfmGetArtistCharts);
}
