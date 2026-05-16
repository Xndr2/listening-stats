import { db } from "../storage/db";
import type { PlayEvent } from "../types/play-event";
import type { Period, RecentPlay, StatsResult, TopAlbum, TopArtist, TopGenre, TopTrack } from "../types/stats";
import { normalizeSpotifyImageUrl } from "../util/spotify-image-url";
import { enrichArtists, isSpotifyArtistUri } from "./artist-enrichment";
import { getAdjacentPeriod, getPriorPeriodBoundaries, LOCAL_PERIODS } from "./periods";
import type { WaveCallback } from "./progressive";
import type { ProviderInfo, StatsProvider } from "./provider";
import { statsCache } from "./stats-cache";

const CACHE_KEY_PREFIX = "local";
const RECENT_PLAYS_LIMIT = 12;
const STREAK_LOOKBACK_DAYS = 400;

async function mergeArtistImagesFromDb(stats: StatsResult): Promise<void> {
	const uris = [...new Set(stats.topArtists.map((a) => a.artistUri).filter(isSpotifyArtistUri))];
	if (uris.length === 0) return;
	const rows = await db.artists.where("uri").anyOf(uris).toArray();
	const byUri = new Map(rows.map((r) => [r.uri, r]));
	for (const ta of stats.topArtists) {
		const row = byUri.get(ta.artistUri);
		const img = normalizeSpotifyImageUrl(row?.imageUrl ?? undefined) ?? row?.imageUrl;
		if (img?.trim() && !ta.imageUrl?.trim()) ta.imageUrl = img;
	}
}

function isQualifyingPlay(e: PlayEvent): boolean {
	return e.type !== "skip";
}

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
		if (cached) {
			await mergeArtistImagesFromDb(cached);
			return cached;
		}

		// Query bounded events using startedAt index
		const { start, end } = period.getBoundaries();
		const events: PlayEvent[] =
			end === Number.MAX_SAFE_INTEGER
				? await db.playEvents.toArray()
				: await db.playEvents.where("startedAt").between(start, end).toArray();

		const playEvents = events.filter(isQualifyingPlay);

		// Prior window vs current: new artists + prior total duration (not all-time; separate query from streak window).
		const priorBoundaries = getPriorPeriodBoundaries(period);
		let newArtistCount: number | undefined;
		let priorPeriodTotalDuration: number | undefined;

		if (priorBoundaries) {
			const priorEventsRaw = await db.playEvents
				.where("startedAt")
				.between(priorBoundaries.start, priorBoundaries.end)
				.toArray();
			const priorEvents = priorEventsRaw.filter(isQualifyingPlay);

			const currentArtistIds = new Set(playEvents.map((e) => e.artistUri));
			if (priorEvents.length > 0) {
				const priorArtistIds = new Set(priorEvents.map((e) => e.artistUri));
				let newCount = 0;
				for (const id of currentArtistIds) {
					if (!priorArtistIds.has(id)) newCount++;
				}
				newArtistCount = newCount;
				priorPeriodTotalDuration = priorEvents.reduce((sum, e) => sum + e.playedMs, 0);
			} else {
				newArtistCount = currentArtistIds.size;
			}
		} else {
			newArtistCount = 0;
		}

		// Streak uses a fixed recent lookback, not the selected period
		const streakCutoff = Date.now() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
		const streakEventsRaw = await db.playEvents.where("startedAt").above(streakCutoff).toArray();
		const streakEvents = streakEventsRaw.filter(isQualifyingPlay);
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
		const artistMap = new Map<string, { name: string; uri: string; count: number; durationMs: number }>();
		const albumMap = new Map<
			string,
			{
				name: string;
				uri: string;
				artistName: string;
				albumArt?: string;
				count: number;
				durationMs: number;
			}
		>();

		for (const event of playEvents) {
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
					albumArt: normalizeSpotifyImageUrl(event.albumArt),
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
					albumArt: normalizeSpotifyImageUrl(event.albumArt),
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
		const sorted = [...playEvents].sort((a, b) => b.startedAt - a.startedAt);
		const recentPlays: RecentPlay[] = sorted.slice(0, RECENT_PLAYS_LIMIT).map((e) => ({
			trackUri: e.trackUri,
			trackName: e.trackName,
			artistName: e.artistName,
			albumArt: normalizeSpotifyImageUrl(e.albumArt),
			playedAt: e.startedAt,
		}));

		const totalDuration = playEvents.reduce((sum, e) => sum + e.playedMs, 0);

		const listeningDays = playEvents.length > 0 ? new Set(playEvents.map((e) => toLocalDateKey(e.startedAt))).size : 0;

		// Hourly distribution (24-element array, index = local hour)
		const hourlyDistribution = new Array(24).fill(0) as number[];
		for (const event of playEvents) {
			const hour = new Date(event.startedAt).getHours();
			hourlyDistribution[hour]++;
		}

		// Peak hour: index of max value, or 0 if no plays
		const peakHour = playEvents.length > 0 ? hourlyDistribution.indexOf(Math.max(...hourlyDistribution)) : 0;

		// Weekday distribution (7-element, Mon=0 through Sun=6)
		const weekdayDistribution = new Array(7).fill(0) as number[];
		for (const event of playEvents) {
			const jsDay = new Date(event.startedAt).getDay(); // 0=Sun..6=Sat
			const idx = jsDay === 0 ? 6 : jsDay - 1; // -> 0=Mon..6=Sun
			weekdayDistribution[idx]++;
		}
		const peakWeekday = playEvents.length > 0 ? weekdayDistribution.indexOf(Math.max(...weekdayDistribution)) : 0;

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
				ta.imageUrl = normalizeSpotifyImageUrl(enriched.imageUrl ?? undefined) ?? enriched.imageUrl ?? undefined;
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
			totalPlays: playEvents.length,
			totalDuration,
			listeningDays,
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
