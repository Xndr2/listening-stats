import type { PlayEvent } from "../types/play-event";
import type {
	Period,
	StatsResult,
	TopTrack,
	TopArtist,
	TopAlbum,
	TopGenre,
	RecentPlay,
} from "../types/stats";
import type { StatsProvider, ProviderInfo } from "./provider";
import type { WaveCallback } from "./progressive";
import { LOCAL_PERIODS, getAdjacentPeriod, getPriorPeriodBoundaries } from "./periods";
import { statsCache } from "./stats-cache";
import { enrichArtists } from "./artist-enrichment";
import { db } from "../storage/db";

const CACHE_KEY_PREFIX = "local";
const RECENT_PLAYS_LIMIT = 12;
const STREAK_LOOKBACK_DAYS = 400;

function cacheKey(periodId: string): string {
	return `${CACHE_KEY_PREFIX}:${periodId}`;
}

function toLocalDateKey(timestampMs: number): string {
	const d = new Date(timestampMs);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prevDay(d: Date): Date {
	// Use Date constructor with day-1  -  JavaScript handles month/year rollover correctly
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
}

function computeLocalStreak(events: PlayEvent[]): number {
	if (events.length === 0) return 0;

	// Build a Set of local date keys from all event startedAt values
	const dateset = new Set<string>(events.map((e) => toLocalDateKey(e.startedAt)));

	// Start cursor at today (local midnight)  -  use constructor to stay DST-safe
	const now = new Date();
	let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = toLocalDateKey(cursor.getTime());

	// Grace period: if today has no events, move cursor back one day
	if (!dateset.has(todayKey)) {
		cursor = prevDay(cursor);
		const cursorKey = toLocalDateKey(cursor.getTime());
		if (!dateset.has(cursorKey)) {
			return 0;
		}
	}

	// Walk backwards counting consecutive days present in the set
	// Use prevDay() (not ms arithmetic) to handle DST transitions correctly
	let streak = 0;
	while (dateset.has(toLocalDateKey(cursor.getTime()))) {
		streak++;
		cursor = prevDay(cursor);
	}

	return streak;
}

export class LocalProvider implements StatsProvider {
	getProviderInfo(): ProviderInfo {
		return {
			id: "local",
			name: "Local",
			description: "Stats from locally tracked plays",
			capabilities: {
				hasActivityData: true,
				hasConsistencyData: true,
				hasGenreData: true,
				hasStreakData: true,
				hasSkipRate: false,
				tier: "n/a",
			},
		};
	}

	getSupportedPeriods(): Period[] {
		return LOCAL_PERIODS;
	}

	async calculateStats(period: Period): Promise<StatsResult> {
		const key = cacheKey(period.id);

		// Check cache first (per STATS-01)
		const cached = statsCache.get<StatsResult>(key);
		if (cached) return cached;

		// Query bounded events using startedAt index
		const { start, end } = period.getBoundaries();
		const events: PlayEvent[] =
			end === Number.MAX_SAFE_INTEGER
				? await db.playEvents.toArray()
				: await db.playEvents.where("startedAt").between(start, end).toArray();

		// Prior window vs current: new artists + prior total duration (not all-time; separate query from streak window).
		const priorBoundaries = getPriorPeriodBoundaries(period);
		let newArtistCount: number | undefined;
		let priorPeriodTotalDuration: number | undefined;

		if (priorBoundaries) {
			const priorEvents = await db.playEvents
				.where("startedAt")
				.between(priorBoundaries.start, priorBoundaries.end)
				.toArray();

			if (priorEvents.length > 0) {
				const priorArtistIds = new Set(priorEvents.map((e) => e.artistUri));
				const currentArtistIds = new Set(events.map((e) => e.artistUri));
				let newCount = 0;
				for (const id of currentArtistIds) {
					if (!priorArtistIds.has(id)) newCount++;
				}
				newArtistCount = newCount;
				priorPeriodTotalDuration = priorEvents.reduce((sum, e) => sum + e.playedMs, 0);
			}
		}

		// Streak uses a fixed recent lookback, not the selected period
		const streakCutoff = Date.now() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
		const streakEvents = await db.playEvents.where("startedAt").above(streakCutoff).toArray();
		const streak = computeLocalStreak(streakEvents);

		// Aggregate tracks, artists, albums
		const trackMap = new Map<
			string,
			{
				trackUri: string;
				trackName: string;
				artistName: string;
				artistUri: string;
				albumName: string;
				albumUri: string;
				albumArt?: string;
				count: number;
				durationMs: number;
			}
		>();
		const artistMap = new Map<
			string,
			{ name: string; uri: string; count: number; durationMs: number }
		>();
		const albumMap = new Map<
			string,
			{ name: string; uri: string; artistName: string; albumArt?: string; count: number; durationMs: number }
		>();

		for (const event of events) {
			// Track aggregation
			const t = trackMap.get(event.trackUri);
			if (t) {
				t.count++;
				t.durationMs += event.playedMs;
			} else {
				trackMap.set(event.trackUri, {
					trackUri: event.trackUri,
					trackName: event.trackName,
					artistName: event.artistName,
					artistUri: event.artistUri,
					albumName: event.albumName,
					albumUri: event.albumUri,
					albumArt: event.albumArt,
					count: 1,
					durationMs: event.playedMs,
				});
			}

			// Artist aggregation
			const a = artistMap.get(event.artistUri);
			if (a) {
				a.count++;
				a.durationMs += event.playedMs;
			} else {
				artistMap.set(event.artistUri, {
					name: event.artistName,
					uri: event.artistUri,
					count: 1,
					durationMs: event.playedMs,
				});
			}

			// Album aggregation
			const al = albumMap.get(event.albumUri);
			if (al) {
				al.count++;
				al.durationMs += event.playedMs;
			} else {
				albumMap.set(event.albumUri, {
					name: event.albumName,
					uri: event.albumUri,
					artistName: event.artistName,
					albumArt: event.albumArt,
					count: 1,
					durationMs: event.playedMs,
				});
			}
		}

		// Sort and rank tracks
		const topTracks: TopTrack[] = Array.from(trackMap.values())
			.sort((a, b) => b.count - a.count)
			.map((t, i) => ({ rank: i + 1, ...t }));

		// Sort and rank artists
		const topArtists: TopArtist[] = Array.from(artistMap.values())
			.sort((a, b) => b.count - a.count)
			.map((a, i) => ({
				rank: i + 1,
				artistUri: a.uri,
				artistName: a.name,
				count: a.count,
				durationMs: a.durationMs,
			}));

		// Sort and rank albums
		const topAlbums: TopAlbum[] = Array.from(albumMap.values())
			.sort((a, b) => b.count - a.count)
			.map((a, i) => ({
				rank: i + 1,
				albumUri: a.uri,
				albumName: a.name,
				artistName: a.artistName,
				albumArt: a.albumArt,
				count: a.count,
				durationMs: a.durationMs,
			}));

		// Recent plays (last 12 by startedAt descending)
		const sorted = [...events].sort((a, b) => b.startedAt - a.startedAt);
		const recentPlays: RecentPlay[] = sorted.slice(0, RECENT_PLAYS_LIMIT).map((e) => ({
			trackUri: e.trackUri,
			trackName: e.trackName,
			artistName: e.artistName,
			albumArt: e.albumArt,
			playedAt: e.startedAt,
		}));

		const totalDuration = events.reduce((sum, e) => sum + e.playedMs, 0);

		// Hourly distribution (24-element array, index = local hour)
		const hourlyDistribution = new Array(24).fill(0) as number[];
		for (const event of events) {
			const hour = new Date(event.startedAt).getHours();
			hourlyDistribution[hour]++;
		}

		// Peak hour: index of max value, or 0 if no plays
		const peakHour =
			events.length > 0 ? hourlyDistribution.indexOf(Math.max(...hourlyDistribution)) : 0;

		// Weekday distribution (7-element, Mon=0 through Sun=6)
		const weekdayDistribution = new Array(7).fill(0) as number[];
		for (const event of events) {
			const jsDay = new Date(event.startedAt).getDay(); // 0=Sun..6=Sat
			const idx = jsDay === 0 ? 6 : jsDay - 1; // -> 0=Mon..6=Sun
			weekdayDistribution[idx]++;
		}
		const peakWeekday = events.length > 0
			? weekdayDistribution.indexOf(Math.max(...weekdayDistribution))
			: 0;

		// Daily play counts for heatmap (53 weeks lookback)
		const dailyCountMap = new Map<string, number>();
		for (const event of streakEvents) {
			const key = toLocalDateKey(event.startedAt);
			dailyCountMap.set(key, (dailyCountMap.get(key) ?? 0) + 1);
		}
		const dailyPlayCounts = Array.from(dailyCountMap.entries())
			.map(([date, count]) => ({ date, count }))
			.sort((a, b) => a.date.localeCompare(b.date));

		// Skip rate: count skip events vs total events
		const skipCount = events.filter((e) => e.type === "skip").length;
		const totalEvents = events.length;
		const skipRate = totalEvents > 0 ? skipCount / totalEvents : 0;

		// Unique counts from existing maps
		const uniqueTrackCount = trackMap.size;
		const uniqueArtistCount = artistMap.size;

		// Get artist URIs for enrichment
		const artistUris = topArtists.map((a) => a.artistUri);

		// Fire enrichment (populates db.artists for unenriched)
		await enrichArtists(artistUris);

		// Read enriched data for genre aggregation
		const enrichedArtists = await db.artists.where("uri").anyOf(artistUris).toArray();
		const enrichedMap = new Map(enrichedArtists.map((a) => [a.uri, a]));

		// Merge enrichment into topArtists
		for (const ta of topArtists) {
			const enriched = enrichedMap.get(ta.artistUri);
			if (enriched) {
				ta.genres = enriched.genres;
				ta.imageUrl = enriched.imageUrl;
			}
		}

		// Aggregate genres across all top artists
		const genreCount = new Map<string, number>();
		for (const artist of enrichedArtists) {
			for (const genre of artist.genres) {
				genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
			}
		}
		const topGenres: TopGenre[] = Array.from(genreCount.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([genre, count], i) => ({ rank: i + 1, genre, count }));

		const result: StatsResult = {
			topTracks,
			topArtists,
			topAlbums,
			topGenres,
			totalPlays: events.length,
			totalDuration,
			recentPlays,
			hourlyDistribution,
			peakHour,
			skipRate,
			uniqueTrackCount,
			uniqueArtistCount,
			streak,
			weekdayDistribution,
			peakWeekday,
			dailyPlayCounts,
			newArtistCount,
			priorPeriodTotalDuration,
		};

		statsCache.set(key, result);

		// Warm adjacent period in background
		const adjacent = getAdjacentPeriod(period.id);
		if (adjacent) {
			this.calculateStats(adjacent).catch(() => {});
		}

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
		statsCache.setupInvalidationListeners();
	}

	destroy(): void {
		statsCache.invalidate();
	}
}

export const localProvider = new LocalProvider();
