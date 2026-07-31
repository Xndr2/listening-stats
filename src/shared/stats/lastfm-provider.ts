import {
	type LfmRecentTrack,
	type LfmTopAlbum,
	type LfmTopArtist,
	type LfmTopTrack,
	lastfmGetRecentTracks,
	lastfmGetTopAlbums,
	lastfmGetTopArtists,
	lastfmGetTopTracks,
} from "../api/lastfm-client";
import { LS_KEYS } from "../constants/storage-keys";
import type { Period, RecentPlay, StatsResult, TopAlbum, TopArtist, TopGenre, TopTrack } from "../types/stats";
import { LASTFM_PERIODS } from "./periods";
import type { WaveCallback } from "./progressive";
import type { ProviderInfo, StatsProvider } from "./provider";
import { statsCache } from "./stats-cache";

const CACHE_KEY_PREFIX = "lastfm";
const STREAK_LOOKBACK_PAGES = 20;
const RECENT_PAGE_SIZE = 200;
const RECENT_PLAYS_LIMIT = 12;

export interface LastfmProviderConfig {
	apiKey: string;
	username: string;
}

function cacheKey(periodId: string): string {
	return `${CACHE_KEY_PREFIX}:${periodId}`;
}

function toLocalDateKey(timestampMs: number): string {
	const d = new Date(timestampMs);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreakFromRecent(tracks: LfmRecentTrack[]): number {
	const dateSet = new Set(tracks.map((t) => toLocalDateKey(t.playedAt)));
	if (dateSet.size === 0) return 0;

	const now = new Date();
	const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = toLocalDateKey(cursor.getTime());

	if (!dateSet.has(todayKey)) {
		cursor.setDate(cursor.getDate() - 1);
		if (!dateSet.has(toLocalDateKey(cursor.getTime()))) {
			return 0;
		}
	}

	let streak = 0;
	while (dateSet.has(toLocalDateKey(cursor.getTime()))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

class LastfmProvider implements StatsProvider {
	private config: LastfmProviderConfig | null = null;

	getProviderInfo(): ProviderInfo {
		return {
			id: "lastfm",
			name: "Last.fm",
			description: "Stats from Last.fm scrobbles",
			capabilities: {
				hasActivityData: true,
				hasConsistencyData: false,
				hasGenreData: false,
				hasStreakData: true,
				hasSkipRate: false,
				tier: "n/a",
			},
		};
	}

	getSupportedPeriods(): Period[] {
		return LASTFM_PERIODS;
	}

	async calculateStats(period: Period): Promise<StatsResult> {
		if (!this.config) {
			await this.init();
			if (!this.config) {
				throw new Error("LastfmProvider not configured  -  call init() first");
			}
		}

		const key = cacheKey(period.id);
		const cached = statsCache.get<StatsResult>(key);
		if (cached) return cached;

		const { apiKey, username } = this.config;
		const apiPeriod = period.id;

		const [tracksRes, artistsRes, albumsRes, recentRes] = await Promise.allSettled([
			lastfmGetTopTracks(apiKey, username, apiPeriod, 200),
			lastfmGetTopArtists(apiKey, username, apiPeriod, 100),
			lastfmGetTopAlbums(apiKey, username, apiPeriod, 100),
			lastfmGetRecentTracks(apiKey, username, RECENT_PAGE_SIZE, 1),
		]);

		const tracks: LfmTopTrack[] = tracksRes.status === "fulfilled" ? tracksRes.value : [];
		const artists: LfmTopArtist[] = artistsRes.status === "fulfilled" ? artistsRes.value : [];
		const albums: LfmTopAlbum[] = albumsRes.status === "fulfilled" ? albumsRes.value : [];
		const recentAll: LfmRecentTrack[] = recentRes.status === "fulfilled" ? recentRes.value : [];

		const playEvents = recentAll.filter((t) => !Number.isNaN(t.playedAt));
		const totalPlays = tracks.reduce((s, t) => s + t.playCount, 0) || playEvents.length;

		// Total duration: Last.fm doesn't provide per-track duration,
		// estimate from average track length (3.5 min = 210000 ms) * total plays
		const avgTrackMs = 210000;
		const totalDuration = totalPlays * avgTrackMs;

		// Top tracks
		const topTracks: TopTrack[] = tracks.map((t, i) => ({
			rank: i + 1,
			trackUri: `lfm:track:${t.artist}:${t.name}`,
			trackName: t.name,
			artistName: t.artist,
			artistUri: `lfm:artist:${t.artist}`,
			albumName: t.album ?? "",
			albumUri: "",
			albumArt: t.albumArt,
			count: t.playCount,
			durationMs: 0,
		}));

		// Top artists
		const topArtists: TopArtist[] = artists.map((a, i) => ({
			rank: i + 1,
			artistUri: `lfm:artist:${a.name}`,
			artistName: a.name,
			count: a.playCount,
			durationMs: 0,
			imageUrl: a.imageUrl ?? null,
		}));

		// Top albums
		const topAlbums: TopAlbum[] = albums.map((a, i) => ({
			rank: i + 1,
			albumUri: `lfm:album:${a.artist}:${a.name}`,
			albumName: a.name,
			artistName: a.artist,
			count: a.playCount,
			durationMs: 0,
			albumArt: a.imageUrl,
		}));

		// Genres: Last.fm doesn't provide genre data natively, return empty
		const topGenres: TopGenre[] = [];

		// Recent plays (last 12)
		const recentPlays: RecentPlay[] = playEvents.slice(0, RECENT_PLAYS_LIMIT).map((t) => ({
			trackUri: `lfm:track:${t.artist}:${t.name}`,
			trackName: t.name,
			artistName: t.artist,
			albumArt: t.albumArt,
			playedAt: t.playedAt,
		}));

		// Hourly distribution from recent tracks
		const hourlyDistribution = new Array(24).fill(0) as number[];
		for (const event of playEvents) {
			const hour = new Date(event.playedAt).getHours();
			hourlyDistribution[hour]++;
		}
		const peakHour = playEvents.length > 0 ? hourlyDistribution.indexOf(Math.max(...hourlyDistribution)) : 0;

		// Weekday distribution (Mon=0..Sun=6)
		const weekdayDistribution = new Array(7).fill(0) as number[];
		for (const event of playEvents) {
			const jsDay = new Date(event.playedAt).getDay();
			const idx = jsDay === 0 ? 6 : jsDay - 1;
			weekdayDistribution[idx]++;
		}
		const peakWeekday = playEvents.length > 0 ? weekdayDistribution.indexOf(Math.max(...weekdayDistribution)) : 0;

		// Streak: paginate through recent tracks. A failure mid-pagination
		// (e.g. rate limit) must not discard the stats fetched above - use
		// whatever pages we managed to get.
		const allStreakTracks = [...recentAll];
		try {
			for (let page = 2; page <= STREAK_LOOKBACK_PAGES; page++) {
				const pageTracks = await lastfmGetRecentTracks(apiKey, username, RECENT_PAGE_SIZE, page);
				if (pageTracks.length === 0) break;
				allStreakTracks.push(...pageTracks);
			}
		} catch (err) {
			console.warn("[listening-stats] Last.fm streak pagination stopped early:", err);
		}
		const streak = computeStreakFromRecent(allStreakTracks);

		// Listening days
		const listeningDays = new Set(allStreakTracks.map((t) => toLocalDateKey(t.playedAt))).size;

		// Daily play counts (53 weeks lookback from recent tracks)
		const dailyCountMap = new Map<string, number>();
		for (const t of allStreakTracks) {
			const key = toLocalDateKey(t.playedAt);
			dailyCountMap.set(key, (dailyCountMap.get(key) ?? 0) + 1);
		}
		const dailyPlayCounts = Array.from(dailyCountMap.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));

		const uniqueTrackCount = tracks.length;
		const uniqueArtistCount = artists.length;

		const result: StatsResult = {
			topTracks,
			topArtists,
			topAlbums,
			topGenres,
			totalPlays,
			totalDuration,
			listeningDays,
			recentPlays,
			hourlyDistribution,
			peakHour,
			skipRate: 0,
			uniqueTrackCount,
			uniqueArtistCount,
			streak,
			weekdayDistribution,
			peakWeekday,
			dailyPlayCounts,
		};

		statsCache.set(key, result);
		return result;
	}

	async calculateStatsProgressive(period: Period, onWave: WaveCallback): Promise<StatsResult> {
		const result = await this.calculateStats(period);
		onWave(result, 1);
		onWave(result, 2);
		onWave(result, 3);
		return result;
	}

	async init(): Promise<void> {
		const raw = localStorage.getItem(LS_KEYS.LASTFM_CONFIG);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as LastfmProviderConfig;
				// Reject malformed shapes so calculateStats never calls the API
				// with an undefined key/username.
				this.config =
					typeof parsed?.apiKey === "string" && parsed.apiKey && typeof parsed?.username === "string" && parsed.username
						? parsed
						: null;
			} catch {
				this.config = null;
			}
		} else {
			this.config = null;
		}
	}

	destroy(): void {
		statsCache.invalidate();
	}
}

export const lastfmProvider = new LastfmProvider();
