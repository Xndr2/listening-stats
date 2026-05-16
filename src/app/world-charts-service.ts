export type {
	WorldChartDataSource,
	WorldScope,
	WorldTrack,
	WorldWindow,
} from "../shared/types/world-charts";

import type { WorldChartDataSource, WorldScope, WorldTrack, WorldWindow } from "../shared/types/world-charts";
import {
	enrichWorldTracksWithMytopImages,
	fetchMytopImageLookups,
	fetchMytopWorldArtists,
	fetchMytopWorldTracks,
} from "./mytopspotify-charts";

const CHARTS_API = "https://api.stats.fm/api/v1";

export type WorldChartResult<T> =
	| { ok: true; data: T; source?: WorldChartDataSource }
	| { ok: false; status: number; message: string };

const RANGE_BY_WINDOW: Record<WorldWindow, string> = {
	today: "today",
	week: "weeks",
	month: "months",
	lifetime: "lifetime",
};

interface ChartTrackPayload {
	position: number;
	streams: number;
	indicator?: string | null;
	track: {
		name: string;
		artists: Array<{ name: string; image?: string }>;
		albums: Array<{ image?: string }>;
		externalIds?: { spotify?: string[]; appleMusic?: string[] };
	};
}

interface ChartArtistPayload {
	position: number;
	streams: number;
	indicator?: string | null;
	artist: {
		name: string;
		image?: string;
	};
}

export const WORLD_TRACKS: readonly WorldTrack[] = [
	{
		id: "w1",
		title: "Espresso",
		artist: "Sabrina Carpenter",
		country: "GL",
		plays: "12.4M",
		delta: +2,
	},
	{
		id: "w2",
		title: "Beautiful Things",
		artist: "Benson Boone",
		country: "GL",
		plays: "9.8M",
		delta: null,
	},
	{ id: "w3", title: "Houdini", artist: "Dua Lipa", country: "GL", plays: "8.2M", delta: +5 },
	{
		id: "w4",
		title: "Lose Control",
		artist: "Teddy Swims",
		country: "GL",
		plays: "7.9M",
		delta: -1,
	},
	{
		id: "w5",
		title: "Cruel Summer",
		artist: "Taylor Swift",
		country: "GL",
		plays: "7.1M",
		delta: -3,
	},
	{
		id: "w6",
		title: "Stick Season",
		artist: "Noah Kahan",
		country: "GL",
		plays: "6.4M",
		delta: +1,
	},
	{ id: "w7", title: "Bad Habit", artist: "Steve Lacy", country: "GL", plays: "5.9M", delta: -2 },
	{ id: "w8", title: "Pedro", artist: "Jaxomy & Agatino", country: "GL", plays: "5.3M", delta: +8 },
];

export const WORLD_ARTISTS: readonly WorldTrack[] = [
	{
		id: "a1",
		title: "Taylor Swift",
		artist: "",
		country: "GL",
		plays: "95.2M listeners",
		delta: null,
	},
	{ id: "a2", title: "The Weeknd", artist: "", country: "GL", plays: "82.1M listeners", delta: +1 },
	{ id: "a3", title: "Bad Bunny", artist: "", country: "GL", plays: "71.4M listeners", delta: -1 },
	{ id: "a4", title: "Drake", artist: "", country: "GL", plays: "63.8M listeners", delta: +2 },
	{
		id: "a5",
		title: "Sabrina Carpenter",
		artist: "",
		country: "GL",
		plays: "58.3M listeners",
		delta: +5,
	},
	{
		id: "a6",
		title: "Billie Eilish",
		artist: "",
		country: "GL",
		plays: "52.7M listeners",
		delta: -2,
	},
	{ id: "a7", title: "Dua Lipa", artist: "", country: "GL", plays: "47.9M listeners", delta: +3 },
	{ id: "a8", title: "BTS", artist: "", country: "GL", plays: "44.1M listeners", delta: -1 },
];

function indicatorDelta(ind: string | undefined | null): number | null {
	if (ind == null) return null;
	const u = String(ind).toUpperCase();
	if (u.includes("UP")) return 1;
	if (u.includes("DOWN")) return -1;
	if (u.includes("NEW")) return 3;
	if (u.includes("NONE") || u === "") return null;
	return null;
}

function formatChartPlays(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
	return String(n);
}

function pickTrackCover(r: ChartTrackPayload): string | undefined {
	const albums = r.track.albums ?? [];
	const pickPreferSpotifyCdn = (url?: string) => {
		if (!url?.startsWith("http")) return undefined;
		if (url.includes("i.scdn.co")) return url;
		return url;
	};
	for (const al of albums) {
		const u = pickPreferSpotifyCdn(al.image);
		if (u) return u;
	}
	const a0 = r.track.artists[0];
	const fromArtist = pickPreferSpotifyCdn(a0?.image);
	if (fromArtist) return fromArtist;
	return undefined;
}

function mapTrackRow(r: ChartTrackPayload): WorldTrack & { spotifyTrackId?: string } {
	const artist = r.track.artists[0]?.name ?? "";
	const art = pickTrackCover(r);
	const spotifyId = r.track.externalIds?.spotify?.[0];
	const base: WorldTrack & { spotifyTrackId?: string } = {
		id: `sfm-t-${r.position}-${r.track.name}`,
		title: r.track.name,
		artist,
		country: "GL",
		plays: formatChartPlays(r.streams),
		delta: indicatorDelta(r.indicator),
		...(spotifyId ? { spotifyTrackId: spotifyId } : {}),
		...(art ? { artUrl: art } : {}),
	};
	return base;
}

function mapArtistRow(r: ChartArtistPayload): WorldTrack {
	const img = r.artist.image;
	return {
		id: `sfm-a-${r.position}-${r.artist.name}`,
		title: r.artist.name,
		artist: "",
		country: "GL",
		plays: `${formatChartPlays(r.streams)} streams`,
		delta: indicatorDelta(r.indicator),
		...(img ? { artUrl: img } : {}),
	};
}

async function fetchChartTracks(range: string): Promise<Array<WorldTrack & { spotifyTrackId?: string }>> {
	const url = `${CHARTS_API}/charts/top/tracks?range=${encodeURIComponent(range)}`;
	const res = await fetch(url, { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: ChartTrackPayload[] };
	const items = json.items ?? [];
	return items.map(mapTrackRow);
}

async function fetchChartArtists(range: string): Promise<WorldTrack[]> {
	const url = `${CHARTS_API}/charts/top/artists?range=${encodeURIComponent(range)}`;
	const res = await fetch(url, { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: ChartArtistPayload[] };
	const items = json.items ?? [];
	return items.map(mapArtistRow);
}

/** Synchronous fallback data (tests, offline). */
export function getCharts(_scope: WorldScope, _window: WorldWindow): WorldTrack[] {
	return [...WORLD_TRACKS];
}

export async function getChartsAsync(_scope: WorldScope, window: WorldWindow): Promise<WorldChartResult<WorldTrack[]>> {
	const range = RANGE_BY_WINDOW[window] ?? "today";
	try {
		const raw = await fetchChartTracks(range);
		if (raw.length === 0) throw new Error("empty");
		let lookups = {
			bySpotifyId: new Map<string, string>(),
			byTitleArtist: new Map<string, string>(),
		};
		try {
			lookups = await fetchMytopImageLookups();
		} catch {
			// optional enrichment
		}
		const data = enrichWorldTracksWithMytopImages(raw, lookups);
		if (data.length === 0) return { ok: true, data: [...WORLD_TRACKS], source: "mock" };
		return { ok: true, data, source: "statsfm" };
	} catch {
		try {
			const data = await fetchMytopWorldTracks();
			if (data.length) return { ok: true, data, source: "mytopspotify" };
		} catch {
			// fall through
		}
		return { ok: true, data: [...WORLD_TRACKS], source: "mock" };
	}
}

export async function getArtistChartsAsync(
	_scope: WorldScope,
	window: WorldWindow,
): Promise<WorldChartResult<WorldTrack[]>> {
	const range = RANGE_BY_WINDOW[window] ?? "today";
	try {
		const data = await fetchChartArtists(range);
		if (data.length === 0) throw new Error("empty");
		return { ok: true, data, source: "statsfm" };
	} catch {
		try {
			const data = await fetchMytopWorldArtists();
			if (data.length) return { ok: true, data, source: "mytopspotify" };
		} catch {
			// fall through
		}
		return { ok: true, data: [...WORLD_ARTISTS], source: "mock" };
	}
}
