export type {
	WorldChartDataSource,
	WorldIndicator,
	WorldScope,
	WorldTrack,
	WorldWindow,
} from "../shared/types/world-charts";

import type {
	WorldChartDataSource,
	WorldIndicator,
	WorldScope,
	WorldTrack,
	WorldWindow,
} from "../shared/types/world-charts";
import {
	enrichWorldTracksWithMytopImages,
	fetchMytopImageLookups,
	fetchMytopWorldArtists,
	fetchMytopWorldTracks,
} from "./mytopspotify-charts";
import { enrichTracksWithSpotifyIds, WORLD_SPOTIFY_ENRICH_LIMIT } from "./world-spotify-actions";

const CHARTS_API = "https://api.stats.fm/api/v1";
const CHART_LIMIT = 50;

export type WorldChartResult<T> =
	| { ok: true; data: T; source?: WorldChartDataSource }
	| { ok: false; status: number; message: string };

const RANGE_BY_WINDOW: Partial<Record<WorldWindow, string>> = {
	today: "today",
	week: "weeks",
};

export const STATS_FM_SUPPORTED_WINDOWS: readonly WorldWindow[] = ["today", "week"] as const;

interface ChartTrackPayload {
	position: number;
	streams: number;
	indicator?: string | null;
	track: {
		id: number;
		name: string;
		durationMs?: number;
		explicit?: boolean;
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
		followers?: number;
		genres?: string[];
		externalIds?: { spotify?: string[] };
	};
}

interface ChartAlbumPayload {
	position: number;
	streams: number;
	indicator?: string | null;
	album: {
		name: string;
		image?: string;
		releaseDate?: number;
		artists?: Array<{ name: string }>;
		externalIds?: { spotify?: string[] };
	};
}

export function isStatsFmWindowSupported(window: WorldWindow): boolean {
	return STATS_FM_SUPPORTED_WINDOWS.includes(window);
}

function unsupportedWindowResult(window: WorldWindow): WorldChartResult<WorldTrack[]> {
	const label = window === "month" ? "This month" : window === "lifetime" ? "All-time" : window;
	return {
		ok: false,
		status: 503,
		message: `${label} charts are not available from stats.fm (only Today and This Week are supported).`,
	};
}

export const WORLD_TRACKS: readonly WorldTrack[] = [
	{
		id: "w1",
		title: "Espresso",
		artist: "Sabrina Carpenter",
		country: "GL",
		plays: "12.4M",
		delta: 2,
		indicator: "UP",
	},
	{
		id: "w2",
		title: "Beautiful Things",
		artist: "Benson Boone",
		country: "GL",
		plays: "9.8M",
		delta: null,
		indicator: "NONE",
	},
	{ id: "w3", title: "Houdini", artist: "Dua Lipa", country: "GL", plays: "8.2M", delta: 5, indicator: "UP" },
	{
		id: "w4",
		title: "Lose Control",
		artist: "Teddy Swims",
		country: "GL",
		plays: "7.9M",
		delta: -1,
		indicator: "DOWN",
	},
	{
		id: "w5",
		title: "Cruel Summer",
		artist: "Taylor Swift",
		country: "GL",
		plays: "7.1M",
		delta: -3,
		indicator: "DOWN",
	},
	{
		id: "w6",
		title: "Stick Season",
		artist: "Noah Kahan",
		country: "GL",
		plays: "6.4M",
		delta: 1,
		indicator: "UP",
	},
	{ id: "w7", title: "Bad Habit", artist: "Steve Lacy", country: "GL", plays: "5.9M", delta: -2, indicator: "DOWN" },
	{ id: "w8", title: "Pedro", artist: "Jaxomy & Agatino", country: "GL", plays: "5.3M", delta: 8, indicator: "NEW" },
	{
		id: "w9",
		title: "Bird of a Feather",
		artist: "Billie Eilish",
		country: "GL",
		plays: "5.0M",
		delta: 1,
		indicator: "UP",
	},
	{
		id: "w10",
		title: "A Bar Song",
		artist: "Shaboozey",
		country: "GL",
		plays: "4.8M",
		delta: null,
		indicator: "NONE",
	},
];

export const WORLD_ARTISTS: readonly WorldTrack[] = [
	{
		id: "a1",
		title: "Taylor Swift",
		artist: "",
		country: "GL",
		plays: "95.2M",
		delta: null,
		indicator: "NONE",
		genres: ["pop"],
	},
	{
		id: "a2",
		title: "The Weeknd",
		artist: "",
		country: "GL",
		plays: "82.1M",
		delta: 1,
		indicator: "UP",
		genres: ["r&b"],
	},
	{
		id: "a3",
		title: "Bad Bunny",
		artist: "",
		country: "GL",
		plays: "71.4M",
		delta: -1,
		indicator: "DOWN",
		genres: ["latin"],
	},
	{
		id: "a4",
		title: "Drake",
		artist: "",
		country: "GL",
		plays: "63.8M",
		delta: 2,
		indicator: "UP",
		genres: ["hip-hop/rap", "rap"],
	},
	{
		id: "a5",
		title: "Sabrina Carpenter",
		artist: "",
		country: "GL",
		plays: "58.3M",
		delta: 5,
		indicator: "NEW",
		genres: ["pop"],
	},
	{
		id: "a6",
		title: "Billie Eilish",
		artist: "",
		country: "GL",
		plays: "52.7M",
		delta: -2,
		indicator: "DOWN",
		genres: ["alternative"],
	},
	{
		id: "a7",
		title: "Dua Lipa",
		artist: "",
		country: "GL",
		plays: "47.9M",
		delta: 3,
		indicator: "UP",
		genres: ["pop"],
	},
	{
		id: "a8",
		title: "BTS",
		artist: "",
		country: "GL",
		plays: "44.1M",
		delta: -1,
		indicator: "DOWN",
		genres: ["k-pop"],
	},
	{
		id: "a9",
		title: "Kendrick Lamar",
		artist: "",
		country: "GL",
		plays: "41.0M",
		delta: 2,
		indicator: "UP",
		genres: ["hip-hop/rap"],
	},
	{
		id: "a10",
		title: "Ariana Grande",
		artist: "",
		country: "GL",
		plays: "39.5M",
		delta: null,
		indicator: "NONE",
		genres: ["pop"],
	},
];

export const WORLD_ALBUMS: readonly WorldTrack[] = [
	{
		id: "al1",
		title: "THE TORTURED POETS DEPARTMENT",
		artist: "Taylor Swift",
		country: "GL",
		plays: "4.2M",
		delta: 1,
		indicator: "UP",
		albumYear: 2024,
	},
	{
		id: "al2",
		title: "HIT ME HARD AND SOFT",
		artist: "Billie Eilish",
		country: "GL",
		plays: "3.8M",
		delta: null,
		indicator: "NONE",
		albumYear: 2024,
	},
	{
		id: "al3",
		title: "Short n' Sweet",
		artist: "Sabrina Carpenter",
		country: "GL",
		plays: "3.5M",
		delta: 3,
		indicator: "NEW",
		albumYear: 2024,
	},
	{
		id: "al4",
		title: "GNX",
		artist: "Kendrick Lamar",
		country: "GL",
		plays: "3.1M",
		delta: -1,
		indicator: "DOWN",
		albumYear: 2024,
	},
	{
		id: "al5",
		title: "CHROMAKOPIA",
		artist: "Tyler, The Creator",
		country: "GL",
		plays: "2.9M",
		delta: 2,
		indicator: "UP",
		albumYear: 2024,
	},
	{
		id: "al6",
		title: "Radical Optimism",
		artist: "Dua Lipa",
		country: "GL",
		plays: "2.6M",
		delta: -2,
		indicator: "DOWN",
		albumYear: 2024,
	},
	{
		id: "al7",
		title: "EUSEXUA",
		artist: "FKA twigs",
		country: "GL",
		plays: "2.4M",
		delta: null,
		indicator: "NONE",
		albumYear: 2025,
	},
	{
		id: "al8",
		title: "ICEMAN",
		artist: "Drake",
		country: "GL",
		plays: "2.2M",
		delta: 1,
		indicator: "UP",
		albumYear: 2025,
	},
	{
		id: "al9",
		title: "BRAT",
		artist: "Charli xcx",
		country: "GL",
		plays: "2.0M",
		delta: -1,
		indicator: "DOWN",
		albumYear: 2024,
	},
	{
		id: "al10",
		title: "Romance",
		artist: "Fontaines D.C.",
		country: "GL",
		plays: "1.8M",
		delta: null,
		indicator: "NONE",
		albumYear: 2024,
	},
];

function parseIndicator(ind: string | undefined | null): WorldIndicator | null {
	if (ind == null) return null;
	const u = String(ind).toUpperCase();
	if (u === "UP" || u.includes("UP")) return "UP";
	if (u === "DOWN" || u.includes("DOWN")) return "DOWN";
	if (u === "NEW" || u.includes("NEW")) return "NEW";
	if (u === "NONE" || u === "") return null;
	return null;
}

function indicatorDelta(ind: WorldIndicator | null): number | null {
	if (ind === "UP") return 1;
	if (ind === "DOWN") return -1;
	if (ind === "NEW") return 3;
	return null;
}

function formatChartPlays(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
	return String(n);
}

function parseAlbumReleaseYear(releaseDate: number | undefined): number | undefined {
	if (releaseDate == null) return undefined;
	const ms = releaseDate > 1e12 ? releaseDate : releaseDate * 1000;
	const year = new Date(ms).getFullYear();
	const current = new Date().getFullYear();
	if (!Number.isFinite(year) || year < 1900 || year > current + 1) return undefined;
	return year;
}

export function formatDuration(ms: number | undefined): string {
	if (!ms) return "";
	const s = Math.round(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
	return pickPreferSpotifyCdn(a0?.image);
}

function chartUrl(kind: "tracks" | "artists" | "albums", range: string): string {
	const url = new URL(`${CHARTS_API}/charts/top/${kind}`);
	url.searchParams.set("range", range);
	url.searchParams.set("limit", String(CHART_LIMIT));
	return url.toString();
}

function mapTrackRow(r: ChartTrackPayload): WorldTrack {
	const artist = r.track.artists.map((a) => a.name).join(", ");
	const art = pickTrackCover(r);
	const spotifyId = r.track.externalIds?.spotify?.[0];
	const indicator = parseIndicator(r.indicator);
	return {
		id: `sfm-t-${r.position}-${r.track.name}`,
		title: r.track.name,
		artist,
		country: "GL",
		plays: formatChartPlays(r.streams),
		delta: indicatorDelta(indicator),
		indicator,
		statsFmTrackId: r.track.id,
		...(spotifyId ? { spotifyTrackId: spotifyId } : {}),
		...(art ? { artUrl: art } : {}),
		...(r.track.durationMs != null ? { durationMs: r.track.durationMs } : {}),
		...(r.track.explicit ? { explicit: true } : {}),
	};
}

function mapArtistRow(r: ChartArtistPayload): WorldTrack {
	const img = r.artist.image;
	const indicator = parseIndicator(r.indicator);
	const genres = r.artist.genres?.slice(0, 2);
	const spotifyArtistId = r.artist.externalIds?.spotify?.[0];
	return {
		id: `sfm-a-${r.position}-${r.artist.name}`,
		title: r.artist.name,
		artist: "",
		country: "GL",
		plays: formatChartPlays(r.streams),
		delta: indicatorDelta(indicator),
		indicator,
		...(img ? { artUrl: img } : {}),
		...(genres?.length ? { genres } : {}),
		...(spotifyArtistId ? { spotifyArtistId } : {}),
	};
}

function mapAlbumRow(r: ChartAlbumPayload): WorldTrack {
	const img = r.album.image;
	const indicator = parseIndicator(r.indicator);
	const primaryArtist = r.album.artists?.[0]?.name ?? "";
	const albumYear = parseAlbumReleaseYear(r.album.releaseDate);
	const spotifyAlbumId = r.album.externalIds?.spotify?.[0];
	return {
		id: `sfm-al-${r.position}-${r.album.name}`,
		title: r.album.name,
		artist: primaryArtist,
		country: "GL",
		plays: formatChartPlays(r.streams),
		delta: indicatorDelta(indicator),
		indicator,
		...(img ? { artUrl: img } : {}),
		...(albumYear ? { albumYear } : {}),
		...(spotifyAlbumId ? { spotifyAlbumId } : {}),
	};
}

async function fetchChartTracks(range: string): Promise<WorldTrack[]> {
	const res = await fetch(chartUrl("tracks", range), { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: ChartTrackPayload[] };
	return (json.items ?? []).map((row) => mapTrackRow(row));
}

async function fetchChartArtists(range: string): Promise<WorldTrack[]> {
	const res = await fetch(chartUrl("artists", range), { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: ChartArtistPayload[] };
	return (json.items ?? []).map((row) => mapArtistRow(row));
}

async function fetchChartAlbums(range: string): Promise<WorldTrack[]> {
	const res = await fetch(chartUrl("albums", range), { headers: { Accept: "application/json" } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = (await res.json()) as { items?: ChartAlbumPayload[] };
	return (json.items ?? []).map((row) => mapAlbumRow(row));
}

/** Synchronous fallback data (tests, offline). */
export function getCharts(_scope: WorldScope, _window: WorldWindow): WorldTrack[] {
	return [...WORLD_TRACKS];
}

export async function getChartsAsync(
	_scope: WorldScope,
	window: WorldWindow,
): Promise<WorldChartResult<WorldTrack[]>> {
	if (!isStatsFmWindowSupported(window)) return unsupportedWindowResult(window);
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
		const withArt = enrichWorldTracksWithMytopImages(raw, lookups);
		const data = await enrichTracksWithSpotifyIds(withArt, { max: WORLD_SPOTIFY_ENRICH_LIMIT });
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
	if (!isStatsFmWindowSupported(window)) return unsupportedWindowResult(window);
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

export async function getAlbumChartsAsync(
	_scope: WorldScope,
	window: WorldWindow,
): Promise<WorldChartResult<WorldTrack[]>> {
	if (!isStatsFmWindowSupported(window)) return unsupportedWindowResult(window);
	const range = RANGE_BY_WINDOW[window] ?? "today";
	try {
		const data = await fetchChartAlbums(range);
		if (data.length === 0) throw new Error("empty");
		return { ok: true, data, source: "statsfm" };
	} catch {
		return { ok: true, data: [...WORLD_ALBUMS], source: "mock" };
	}
}
