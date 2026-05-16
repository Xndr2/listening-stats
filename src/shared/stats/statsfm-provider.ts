import { type SfmResult, type StatsFmConfig, sfmCircuitBreaker, sfmGet, validateUsername } from "../api/statsfm-client";
import { LS_KEYS } from "../constants/storage-keys";
import { classifyStatsFmError, StatsFmError } from "../errors";
import type { Period, RecentPlay, StatsResult, TopAlbum, TopArtist, TopGenre, TopTrack } from "../types/stats";
import type {
	SfmDateStats,
	SfmPerDayStats,
	SfmRecentStream,
	SfmStreamStats,
	SfmTopAlbum,
	SfmTopArtist,
	SfmTopGenre,
	SfmTopTrack,
} from "../types/statsfm";
import { getPriorPeriodBoundaries, STATSFM_PERIODS, STATSFM_PERIODS_PLUS } from "./periods";
import type { WaveCallback } from "./progressive";
import type { ProviderInfo, StatsProvider } from "./provider";
import { statsCache } from "./stats-cache";

const CACHE_KEY_PREFIX = "statsfm";
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Normalize an ISO date string to local YYYY-MM-DD for reliable date-key comparison.
 * Falls back to slicing the first 10 characters if the Date constructor fails.
 */
function toLocalYmd(dateStr: string): string {
	const d = new Date(dateStr);
	if (!Number.isFinite(d.getTime())) return dateStr.slice(0, 10);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreakFromDays(days: Record<string, { count: number; durationMs: number }>): number {
	const dateSet = new Set(
		Object.entries(days)
			.filter(([, d]) => d.count > 0)
			.map(([k]) => toLocalYmd(k))
			.filter((s) => s.length === 10),
	);
	if (dateSet.size === 0) return 0;

	const now = new Date();
	const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = toLocalYmd(cursor.toISOString());

	if (!dateSet.has(todayKey)) {
		cursor.setDate(cursor.getDate() - 1);
		if (!dateSet.has(toLocalYmd(cursor.toISOString()))) {
			return 0;
		}
	}

	let streak = 0;
	while (dateSet.has(toLocalYmd(cursor.toISOString()))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

function prefixUri(id: string | undefined, type: "track" | "artist" | "album"): string | undefined {
	if (!id) return undefined;
	if (id.startsWith("spotify:")) return id;
	return `spotify:${type}:${id}`;
}

function cacheKey(periodId: string): string {
	return `${CACHE_KEY_PREFIX}:${periodId}`;
}

function extractData<T>(result: PromiseSettledResult<SfmResult<T>>): T | null {
	if (result.status === "fulfilled" && result.value.ok) {
		return result.value.data;
	}
	return null;
}

function extractFailure(result: PromiseSettledResult<SfmResult<unknown>>): { status: number; message: string } | null {
	if (result.status === "fulfilled" && !result.value.ok) {
		return { status: result.value.status, message: result.value.message };
	}
	if (result.status === "rejected") {
		return { status: 0, message: String(result.reason) };
	}
	return null;
}

function genresFromArtists(artists: SfmTopArtist[]): TopGenre[] {
	// Weighted: multiply each genre occurrence by ta.streams
	const weighted = new Map<string, number>();
	for (const ta of artists) {
		for (const genre of ta.artist.genres) {
			weighted.set(genre, (weighted.get(genre) ?? 0) + +(ta.streams ?? 0));
		}
	}
	const hasWeight = [...weighted.values()].some((c) => c > 0);
	if (hasWeight) {
		return Array.from(weighted.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([genre, count], i) => ({ rank: i + 1, genre, count }));
	}
	// Fallback: unweighted (1 per artist per genre) when streams are missing/zero
	const unweighted = new Map<string, number>();
	for (const ta of artists) {
		for (const genre of ta.artist.genres) {
			unweighted.set(genre, (unweighted.get(genre) ?? 0) + 1);
		}
	}
	return Array.from(unweighted.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([genre, count], i) => ({ rank: i + 1, genre, count }));
}

/** Prefer stats.fm `/top/genres` when the API returns rows with non-zero counts (works even when artist.genres[] is empty). */
function topGenresFromApiOrArtists(apiRows: SfmTopGenre[] | null | undefined, artists: SfmTopArtist[]): TopGenre[] {
	const rows = apiRows ?? [];
	if (rows.length > 0) {
		const mapped = [...rows]
			.sort((a, b) => b.streams - a.streams)
			.map((g, i) => ({
				rank: i + 1,
				genre: g.genre.tag,
				count: +(g.streams ?? 0),
			}));
		const totalCount = mapped.reduce((s, g) => s + g.count, 0);
		if (totalCount > 0) return mapped;
	}
	return genresFromArtists(artists);
}

function deriveAlbumsFromTracks(tracks: SfmTopTrack[]): TopAlbum[] {
	const albumMap = new Map<
		string,
		{
			albumName: string;
			artistName: string;
			albumArt: string;
			albumUri: string;
			streams: number;
		}
	>();

	for (const tt of tracks) {
		const album = tt.track.albums[0];
		if (!album) continue;
		const key = album.name;
		const existing = albumMap.get(key);
		const artistName = tt.track.artists[0]?.name ?? "";
		const albumUri = prefixUri(album.externalIds?.spotify?.[0], "album") ?? "";
		const streams = tt.streams ?? 0;
		if (existing) {
			existing.streams += streams;
		} else {
			albumMap.set(key, {
				albumName: album.name,
				artistName,
				albumArt: album.image,
				albumUri,
				streams,
			});
		}
	}

	return Array.from(albumMap.values())
		.sort((a, b) => b.streams - a.streams)
		.map((a, i) => ({
			rank: i + 1,
			albumUri: a.albumUri || `listening-stats:album:${a.albumName}${a.artistName}`,
			albumName: a.albumName,
			artistName: a.artistName,
			albumArt: a.albumArt,
			count: a.streams,
			durationMs: 0,
		}));
}

export class StatsFmProvider implements StatsProvider {
	private config: StatsFmConfig | null = null;

	getProviderInfo(): ProviderInfo {
		const isPlus = this.config?.isPlus ?? false;
		return {
			id: "statsfm",
			name: "stats.fm",
			description: "Stats from stats.fm",
			capabilities: {
				hasActivityData: true,
				hasConsistencyData: true,
				hasGenreData: true,
				hasStreakData: false,
				hasSkipRate: false,
				tier: isPlus ? "plus" : "free",
			},
		};
	}

	getSupportedPeriods(): Period[] {
		return this.config?.isPlus ? STATSFM_PERIODS_PLUS : STATSFM_PERIODS;
	}

	async calculateStats(period: Period): Promise<StatsResult> {
		if (!this.config) {
			await this.init();
			if (!this.config) {
				throw new Error("StatsFmProvider not configured  -  call init() first");
			}
		}

		const key = cacheKey(period.id);
		const cached = statsCache.get<StatsResult>(key);
		if (cached) return cached;

		// stats.fm API uses named range values, not after/before timestamps
		const RANGE_MAP: Record<string, string> = {
			"sfm-today": "today",
			"sfm-weeks": "weeks",
			"sfm-months": "months",
			"sfm-all-time": "lifetime",
		};

		const range = RANGE_MAP[period.id];
		if (!range) {
			throw new Error(`Unknown stats.fm period: ${period.id}`);
		}

		const rangeParams: Record<string, string> = { range };

		const username = this.config.username;
		const isPlus = this.config.isPlus;

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Prior-window top artists for new-artist count (skipped when no prior boundaries).
		const priorBoundaries = getPriorPeriodBoundaries(period);
		const priorPromise: Promise<SfmResult<SfmTopArtist[]>> = priorBoundaries
			? sfmGet<SfmTopArtist[]>(`/users/${username}/top/artists`, {
					after: String(priorBoundaries.start),
					before: String(priorBoundaries.end),
					limit: "200",
				})
			: Promise.resolve({ ok: false, status: 0, message: "skipped" } as SfmResult<SfmTopArtist[]>);

		const [tracksRes, artistsRes, genresRes, statsRes, recentRes, albumsRes, perDayRes, datesRes, priorArtistsRes] =
			await Promise.allSettled([
				sfmGet<SfmTopTrack[]>(`/users/${username}/top/tracks`, rangeParams),
				sfmGet<SfmTopArtist[]>(`/users/${username}/top/artists`, rangeParams),
				sfmGet<SfmTopGenre[]>(`/users/${username}/top/genres`, rangeParams),
				sfmGet<SfmStreamStats>(`/users/${username}/streams/stats`, rangeParams),
				sfmGet<SfmRecentStream[]>(`/users/${username}/streams/recent`, { limit: "12" }),
				isPlus
					? sfmGet<SfmTopAlbum[]>(`/users/${username}/top/albums`, rangeParams)
					: Promise.resolve({ ok: false, status: 0, message: "skipped" } as SfmResult<SfmTopAlbum[]>),
				sfmGet<SfmPerDayStats>(`/users/${username}/streams/stats/per-day`, {
					range: "lifetime",
					timeZone,
				}),
				sfmGet<SfmDateStats>(`/users/${username}/streams/stats/dates`, {
					range,
					timeZone,
				}),
				priorPromise,
			]);

		const tracksErr = extractFailure(tracksRes);
		const artistsErr = extractFailure(artistsRes);
		const statsErr = extractFailure(statsRes);
		if (tracksErr && artistsErr && statsErr) {
			const resetAt = sfmCircuitBreaker.getResetAt() ?? undefined;
			throw new StatsFmError(classifyStatsFmError(tracksErr.status, tracksErr.message, resetAt));
		}

		// Extract fulfilled data with fallbacks
		const tracks = extractData<SfmTopTrack[]>(tracksRes) ?? [];
		const artists = extractData<SfmTopArtist[]>(artistsRes) ?? [];
		const apiGenreRows = extractData<SfmTopGenre[]>(genresRes) ?? [];

		// Diff artist Spotify IDs vs prior window (externalIds.spotify[0]; skip rows without ID).
		const priorArtists = extractData<SfmTopArtist[]>(priorArtistsRes) ?? [];
		let newArtistCount = 0;
		if (priorBoundaries) {
			const currentIds = new Set(
				artists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			if (priorArtists.length > 0) {
				const priorIds = new Set(
					priorArtists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
				);
				let count = 0;
				for (const id of currentIds) {
					if (!priorIds.has(id)) count++;
				}
				newArtistCount = count;
			} else {
				newArtistCount = currentIds.size;
			}
		}

		const streamStats = extractData<SfmStreamStats>(statsRes);
		const recent = extractData<SfmRecentStream[]>(recentRes) ?? [];
		const albumsData = extractData<SfmTopAlbum[]>(albumsRes) ?? [];
		const perDayData = extractData<SfmPerDayStats>(perDayRes);
		const listeningDays = perDayData?.days
			? Object.values(perDayData.days).filter((d) => d.count > 0).length
			: undefined;
		const streak = perDayData?.days ? computeStreakFromDays(perDayData.days) : 0;
		const dailyPlayCounts = perDayData?.days
			? Object.entries(perDayData.days)
					.map(([date, d]) => ({ date: toLocalYmd(date), count: d.count }))
					.sort((a, b) => a.date.localeCompare(b.date))
			: undefined;

		// Sum lifetime per-day durations falling in the prior window (same perDay payload).
		let priorPeriodTotalDuration: number | undefined;
		if (priorBoundaries && perDayData?.days) {
			let sum = 0;
			for (const [ymd, day] of Object.entries(perDayData.days)) {
				const ts = new Date(ymd).getTime();
				if (Number.isFinite(ts) && ts >= priorBoundaries.start && ts < priorBoundaries.end) {
					sum += day.durationMs;
				}
			}
			if (sum > 0) priorPeriodTotalDuration = sum;
		}

		const dateItems = extractData<SfmDateStats>(datesRes);

		// hourlyDistribution: 24-element array from hours map (keys 0-23)
		const hourlyDistribution = new Array(24).fill(0) as number[];
		if (dateItems?.hours) {
			for (const [key, val] of Object.entries(dateItems.hours)) {
				const hr = Number(key);
				if (hr >= 0 && hr < 24) hourlyDistribution[hr] = val.count;
			}
		}
		const peakHour = hourlyDistribution.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);

		// weekdayDistribution: 7-element array, index 0=Monday through 6=Sunday
		// API weekDays keys: 1=Monday through 7=Sunday -> subtract 1 for zero-indexed array
		let weekdayDistribution: number[] | undefined;
		let peakWeekday: number | undefined;
		const hasDateData =
			dateItems != null &&
			(Object.keys(dateItems.hours ?? {}).length > 0 || Object.keys(dateItems.weekDays ?? {}).length > 0);

		if (hasDateData && dateItems?.weekDays) {
			weekdayDistribution = new Array(7).fill(0) as number[];
			for (const [key, val] of Object.entries(dateItems.weekDays)) {
				const idx = Number(key) - 1; // 1-7 -> 0-6
				if (idx >= 0 && idx < 7) weekdayDistribution[idx] = val.count;
			}
			peakWeekday = weekdayDistribution.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
		}

		// Map tracks
		const topTracks: TopTrack[] = tracks.map((tt) => {
			const streams = tt.streams ?? 0;
			return {
				rank: tt.position,
				trackUri:
					prefixUri(tt.track.externalIds?.spotify?.[0], "track") ??
					`listening-stats:track:${tt.track.name}${tt.track.artists[0]?.name ?? ""}`,
				trackName: tt.track.name,
				artistName: tt.track.artists[0]?.name ?? "",
				artistUri:
					prefixUri(tt.track.artists[0]?.externalIds?.spotify?.[0], "artist") ??
					`listening-stats:artist:${tt.track.artists[0]?.name ?? ""}`,
				albumName: tt.track.albums[0]?.name ?? "",
				albumUri: prefixUri(tt.track.albums[0]?.externalIds?.spotify?.[0], "album") ?? "",
				albumArt: tt.track.albums[0]?.image,
				count: streams,
				durationMs: tt.track.durationMs * streams,
			};
		});

		// Genres from stats.fm artist payload (no extra Spotify batch here)
		const topArtists: TopArtist[] = artists.map((ta) => ({
			rank: ta.position,
			artistUri: prefixUri(ta.artist.externalIds?.spotify?.[0], "artist") ?? `listening-stats:artist:${ta.artist.name}`,
			artistName: ta.artist.name,
			count: ta.streams ?? 0,
			durationMs: ta.playedMs ?? 0,
			genres: ta.artist.genres,
			imageUrl: ta.artist.image ?? null,
		}));

		// Albums: Plus uses API response, Free derives from topTracks
		const topAlbums: TopAlbum[] = isPlus
			? albumsData.map((ab) => ({
					rank: ab.position,
					albumUri:
						prefixUri(ab.album.externalIds?.spotify?.[0], "album") ??
						`listening-stats:album:${ab.album.name}${ab.album.artists[0]?.name ?? ""}`,
					albumName: ab.album.name,
					artistName: ab.album.artists[0]?.name ?? "",
					albumArt: ab.album.image,
					count: ab.streams ?? 0,
					durationMs: 0,
				}))
			: deriveAlbumsFromTracks(tracks);

		const topGenres: TopGenre[] = topGenresFromApiOrArtists(apiGenreRows, artists);

		// Recent plays
		const recentPlays: RecentPlay[] = recent.map((s) => ({
			trackUri:
				prefixUri(s.track.externalIds?.spotify?.[0], "track") ??
				`listening-stats:track:${s.track.name}${s.track.artists[0]?.name ?? ""}`,
			trackName: s.track.name,
			artistName: s.track.artists[0]?.name ?? "",
			albumArt: s.track.albums[0]?.image,
			playedAt: new Date(s.endTime).getTime() || Date.now(),
		}));

		const result: StatsResult = {
			topTracks,
			topArtists,
			topAlbums,
			topGenres,
			totalPlays: streamStats?.count ?? 0,
			totalDuration: streamStats?.durationMs ?? 0,
			recentPlays,
			hourlyDistribution,
			peakHour,
			skipRate: 0,
			uniqueTrackCount: streamStats?.cardinality.tracks ?? 0,
			uniqueArtistCount: streamStats?.cardinality.artists ?? 0,
			streak,
			listeningDays,
			weekdayDistribution,
			peakWeekday,
			hasListeningPatterns: hasDateData,
			dailyPlayCounts,
			newArtistCount,
			priorPeriodTotalDuration,
		};

		statsCache.set(key, result);
		return result;
	}

	async calculateStatsProgressive(period: Period, onWave: WaveCallback): Promise<StatsResult> {
		if (!this.config) {
			await this.init();
			if (!this.config) {
				throw new Error("StatsFmProvider not configured  -  call init() first");
			}
		}

		const key = cacheKey(period.id);
		const cached = statsCache.get<StatsResult>(key);
		if (cached) {
			onWave(cached, 1);
			onWave(cached, 2);
			onWave(cached, 3);
			return cached;
		}

		const RANGE_MAP: Record<string, string> = {
			"sfm-today": "today",
			"sfm-weeks": "weeks",
			"sfm-months": "months",
			"sfm-all-time": "lifetime",
		};
		const range = RANGE_MAP[period.id];
		if (!range) throw new Error(`Unknown stats.fm period: ${period.id}`);

		const rangeParams: Record<string, string> = { range };
		const username = this.config.username;
		const isPlus = this.config.isPlus;
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		const priorBoundaries = getPriorPeriodBoundaries(period);
		const priorPromise: Promise<SfmResult<SfmTopArtist[]>> = priorBoundaries
			? sfmGet<SfmTopArtist[]>(`/users/${username}/top/artists`, {
					after: String(priorBoundaries.start),
					before: String(priorBoundaries.end),
					limit: "200",
				})
			: Promise.resolve({ ok: false, status: 0, message: "skipped" } as SfmResult<SfmTopArtist[]>);

		// Fire ALL API calls concurrently for max parallelism
		const statsPromise = sfmGet<SfmStreamStats>(`/users/${username}/streams/stats`, rangeParams);
		const recentPromise = sfmGet<SfmRecentStream[]>(`/users/${username}/streams/recent`, {
			limit: "12",
		});
		const tracksPromise = sfmGet<SfmTopTrack[]>(`/users/${username}/top/tracks`, rangeParams);
		const artistsPromise = sfmGet<SfmTopArtist[]>(`/users/${username}/top/artists`, rangeParams);
		const genresPromise = sfmGet<SfmTopGenre[]>(`/users/${username}/top/genres`, rangeParams);
		const albumsPromise = isPlus
			? sfmGet<SfmTopAlbum[]>(`/users/${username}/top/albums`, rangeParams)
			: Promise.resolve({ ok: false, status: 0, message: "skipped" } as SfmResult<SfmTopAlbum[]>);
		const perDayPromise = sfmGet<SfmPerDayStats>(`/users/${username}/streams/stats/per-day`, {
			range: "lifetime",
			timeZone,
		});
		const datesPromise = sfmGet<SfmDateStats>(`/users/${username}/streams/stats/dates`, {
			range,
			timeZone,
		});

		// ── Wave 1: overview basics + recent plays ──
		const [statsRes, recentRes] = await Promise.allSettled([statsPromise, recentPromise]);
		const streamStats = extractData<SfmStreamStats>(statsRes);
		const recent = extractData<SfmRecentStream[]>(recentRes) ?? [];

		const recentPlays: RecentPlay[] = recent.map((s) => ({
			trackUri:
				prefixUri(s.track.externalIds?.spotify?.[0], "track") ??
				`listening-stats:track:${s.track.name}${s.track.artists[0]?.name ?? ""}`,
			trackName: s.track.name,
			artistName: s.track.artists[0]?.name ?? "",
			albumArt: s.track.albums[0]?.image,
			playedAt: new Date(s.endTime).getTime() || Date.now(),
		}));

		onWave(
			{
				totalPlays: streamStats?.count ?? 0,
				totalDuration: streamStats?.durationMs ?? 0,
				uniqueTrackCount: streamStats?.cardinality.tracks ?? 0,
				uniqueArtistCount: streamStats?.cardinality.artists ?? 0,
				skipRate: 0,
				recentPlays,
			},
			1,
		);

		// ── Wave 2: truly progressive partial hydration ──
		let tracks: SfmTopTrack[] = [];
		let artists: SfmTopArtist[] = [];
		let albumsData: SfmTopAlbum[] = [];
		let perDayData: SfmPerDayStats | null = null;
		let priorArtists: SfmTopArtist[] = [];

		let topTracks: TopTrack[] = [];
		let topArtists: TopArtist[] = [];
		let topAlbums: TopAlbum[] = [];
		let topGenres: TopGenre[] = [];
		let streak: number | undefined;
		let listeningDays: number | undefined;
		let dailyPlayCounts: Array<{ date: string; count: number }> | undefined;
		let newArtistCount: number | undefined;
		let priorPeriodTotalDuration: number | undefined;
		let priorArtistsReady = !priorBoundaries;

		const emitNewArtistCount = () => {
			if (!priorBoundaries) {
				newArtistCount = 0;
				onWave({ newArtistCount }, 2);
				return;
			}
			if (!priorArtistsReady) return;
			if (artists.length === 0) {
				newArtistCount = 0;
				onWave({ newArtistCount }, 2);
				return;
			}
			const currentIds = new Set(
				artists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			if (priorArtists.length > 0) {
				const priorIds = new Set(
					priorArtists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
				);
				let count = 0;
				for (const id of currentIds) {
					if (!priorIds.has(id)) count++;
				}
				newArtistCount = count;
			} else {
				newArtistCount = currentIds.size;
			}
			onWave({ newArtistCount }, 2);
		};

		const wave2Tasks: Promise<void>[] = [
			tracksPromise.then((res) => {
				tracks = res.ok ? res.data : [];
				topTracks = tracks.map((tt) => {
					const streams = tt.streams ?? 0;
					return {
						rank: tt.position,
						trackUri:
							prefixUri(tt.track.externalIds?.spotify?.[0], "track") ??
							`listening-stats:track:${tt.track.name}${tt.track.artists[0]?.name ?? ""}`,
						trackName: tt.track.name,
						artistName: tt.track.artists[0]?.name ?? "",
						artistUri:
							prefixUri(tt.track.artists[0]?.externalIds?.spotify?.[0], "artist") ??
							`listening-stats:artist:${tt.track.artists[0]?.name ?? ""}`,
						albumName: tt.track.albums[0]?.name ?? "",
						albumUri: prefixUri(tt.track.albums[0]?.externalIds?.spotify?.[0], "album") ?? "",
						albumArt: tt.track.albums[0]?.image,
						count: streams,
						durationMs: tt.track.durationMs * streams,
					};
				});
				onWave({ topTracks }, 2);
				if (!isPlus) {
					topAlbums = deriveAlbumsFromTracks(tracks);
					onWave({ topAlbums }, 2);
				}
			}),
			Promise.all([artistsPromise, genresPromise]).then(([res, gRes]) => {
				artists = res.ok ? res.data : [];
				topArtists = artists.map((ta) => ({
					rank: ta.position,
					artistUri:
						prefixUri(ta.artist.externalIds?.spotify?.[0], "artist") ?? `listening-stats:artist:${ta.artist.name}`,
					artistName: ta.artist.name,
					count: ta.streams ?? 0,
					durationMs: ta.playedMs ?? 0,
					genres: ta.artist.genres,
					imageUrl: ta.artist.image ?? null,
				}));
				onWave({ topArtists }, 2);

				const apiRows = gRes.ok ? gRes.data : null;
				topGenres = topGenresFromApiOrArtists(apiRows, artists);
				onWave({ topGenres }, 2);
				emitNewArtistCount();
			}),
			albumsPromise.then((res) => {
				if (!isPlus) return;
				albumsData = res.ok ? res.data : [];
				topAlbums = albumsData.map((ab) => ({
					rank: ab.position,
					albumUri:
						prefixUri(ab.album.externalIds?.spotify?.[0], "album") ??
						`listening-stats:album:${ab.album.name}${ab.album.artists[0]?.name ?? ""}`,
					albumName: ab.album.name,
					artistName: ab.album.artists[0]?.name ?? "",
					albumArt: ab.album.image,
					count: ab.streams ?? 0,
					durationMs: 0,
				}));
				onWave({ topAlbums }, 2);
			}),
			perDayPromise.then((res) => {
				perDayData = res.ok ? res.data : null;
				listeningDays = perDayData?.days ? Object.values(perDayData.days).filter((d) => d.count > 0).length : undefined;
				streak = perDayData?.days ? computeStreakFromDays(perDayData.days) : 0;
				dailyPlayCounts = perDayData?.days
					? Object.entries(perDayData.days)
							.map(([date, d]) => ({ date: toLocalYmd(date), count: d.count }))
							.sort((a, b) => a.date.localeCompare(b.date))
					: undefined;

				if (priorBoundaries && perDayData?.days) {
					let sum = 0;
					for (const [ymd, day] of Object.entries(perDayData.days)) {
						const ts = new Date(ymd).getTime();
						if (Number.isFinite(ts) && ts >= priorBoundaries.start && ts < priorBoundaries.end) {
							sum += day.durationMs;
						}
					}
					if (sum > 0) priorPeriodTotalDuration = sum;
				}
				onWave({ streak, listeningDays, dailyPlayCounts, priorPeriodTotalDuration }, 2);
			}),
			priorPromise.then((res) => {
				priorArtists = res.ok ? res.data : [];
				priorArtistsReady = true;
				emitNewArtistCount();
			}),
		];

		await Promise.allSettled(wave2Tasks);

		// ── Wave 3: activity (hourly/weekday distributions) ──
		const [datesRes] = await Promise.allSettled([datesPromise]);
		const datesFailure = extractFailure(datesRes);
		const dateItems = extractData<SfmDateStats>(datesRes);

		const hourlyDistribution = new Array(24).fill(0) as number[];
		if (dateItems?.hours) {
			for (const [k, val] of Object.entries(dateItems.hours)) {
				const hr = Number(k);
				if (hr >= 0 && hr < 24) hourlyDistribution[hr] = val.count;
			}
		}
		const peakHour = hourlyDistribution.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);

		let weekdayDistribution: number[] | undefined;
		let peakWeekday: number | undefined;
		const hasDateData =
			dateItems != null &&
			(Object.keys(dateItems.hours ?? {}).length > 0 || Object.keys(dateItems.weekDays ?? {}).length > 0);

		if (hasDateData && dateItems?.weekDays) {
			weekdayDistribution = new Array(7).fill(0) as number[];
			for (const [k, val] of Object.entries(dateItems.weekDays)) {
				const idx = Number(k) - 1;
				if (idx >= 0 && idx < 7) weekdayDistribution[idx] = val.count;
			}
			peakWeekday = weekdayDistribution.reduce((maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx), 0);
		}

		if (datesFailure) {
			onWave(
				{
					hourlyDistribution: new Array(24).fill(0) as number[],
					peakHour: 0,
					hasListeningPatterns: false,
				},
				3,
				classifyStatsFmError(datesFailure.status, datesFailure.message),
			);
		} else {
			onWave(
				{
					hourlyDistribution,
					peakHour,
					weekdayDistribution,
					peakWeekday,
					hasListeningPatterns: hasDateData,
				},
				3,
			);
		}

		// Build full result (no cache write  -  caller decides via cache gating)
		return {
			topTracks,
			topArtists,
			topAlbums,
			topGenres,
			totalPlays: streamStats?.count ?? 0,
			totalDuration: streamStats?.durationMs ?? 0,
			recentPlays,
			hourlyDistribution,
			peakHour,
			skipRate: 0,
			uniqueTrackCount: streamStats?.cardinality.tracks ?? 0,
			uniqueArtistCount: streamStats?.cardinality.artists ?? 0,
			streak,
			listeningDays,
			weekdayDistribution,
			peakWeekday,
			hasListeningPatterns: hasDateData,
			dailyPlayCounts,
			newArtistCount,
			priorPeriodTotalDuration,
		};
	}

	async init(): Promise<void> {
		const raw = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
		if (!raw) return;

		this.config = JSON.parse(raw) as StatsFmConfig;

		const isStale = Date.now() - this.config.lastValidated > TWENTY_FOUR_HOURS;
		if (isStale) {
			const vr = await validateUsername(this.config.username);
			if (vr.valid) {
				this.config.isPlus = vr.isPlus;
				this.config.lastValidated = Date.now();
				localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(this.config));
			}
			// If validation fails, keep existing isPlus  -  graceful degradation
		}
	}

	destroy(): void {
		statsCache.invalidate();
	}
}

export const statsfmProvider = new StatsFmProvider();
