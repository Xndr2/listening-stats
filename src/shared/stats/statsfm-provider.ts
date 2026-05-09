import {
	type SfmResult,
	type StatsFmConfig,
	sfmCircuitBreaker,
	sfmGet,
	validateUsername,
} from "../api/statsfm-client";
import { LS_KEYS } from "../constants/storage-keys";
import { classifyStatsFmError, StatsFmError } from "../errors";
import type {
	Period,
	RecentPlay,
	StatsResult,
	TopAlbum,
	TopArtist,
	TopGenre,
	TopTrack,
} from "../types/stats";
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

function extractFailure(
	result: PromiseSettledResult<SfmResult<unknown>>,
): { status: number; message: string } | null {
	if (result.status === "fulfilled" && !result.value.ok) {
		return { status: result.value.status, message: result.value.message };
	}
	if (result.status === "rejected") {
		return { status: 0, message: String(result.reason) };
	}
	return null;
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
		if (existing) {
			existing.streams += tt.streams;
		} else {
			albumMap.set(key, {
				albumName: album.name,
				artistName,
				albumArt: album.image,
				albumUri,
				streams: tt.streams,
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
				hasActivityData: false,
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

		const [
			tracksRes,
			artistsRes,
			_genresRes,
			statsRes,
			recentRes,
			albumsRes,
			perDayRes,
			datesRes,
			priorArtistsRes,
		] = await Promise.allSettled([
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
			sfmGet<{ items: SfmDateStats }>(`/users/${username}/streams/stats/dates`, {
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

		// Diff artist Spotify IDs vs prior window (externalIds.spotify[0]; skip rows without ID).
		const priorArtists = extractData<SfmTopArtist[]>(priorArtistsRes) ?? [];
		let newArtistCount: number | undefined;
		if (priorArtists.length > 0) {
			const currentIds = new Set(
				artists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			const priorIds = new Set(
				priorArtists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			let count = 0;
			for (const id of currentIds) {
				if (!priorIds.has(id)) count++;
			}
			newArtistCount = count;
		}

		const streamStats = extractData<SfmStreamStats>(statsRes);
		const recent = extractData<SfmRecentStream[]>(recentRes) ?? [];
		const albumsData = extractData<SfmTopAlbum[]>(albumsRes) ?? [];
		const perDayData = extractData<SfmPerDayStats>(perDayRes);
		const listeningDays = perDayData?.days
			? Object.values(perDayData.days).filter((d) => d.count > 0).length
			: undefined;

		const dailyPlayCounts = perDayData?.days
			? Object.entries(perDayData.days)
					.map(([date, d]) => ({ date, count: d.count }))
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

		const datesData = extractData<{ items: SfmDateStats }>(datesRes);
		const dateItems = datesData?.items;

		// hourlyDistribution: 24-element array from hours map (keys 0-23)
		const hourlyDistribution = new Array(24).fill(0) as number[];
		if (dateItems?.hours) {
			for (const [key, val] of Object.entries(dateItems.hours)) {
				const hr = Number(key);
				if (hr >= 0 && hr < 24) hourlyDistribution[hr] = val.count;
			}
		}
		const peakHour = hourlyDistribution.reduce(
			(maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
			0,
		);

		// weekdayDistribution: 7-element array, index 0=Monday through 6=Sunday
		// API weekDays keys: 1=Monday through 7=Sunday -> subtract 1 for zero-indexed array
		let weekdayDistribution: number[] | undefined;
		let peakWeekday: number | undefined;
		const hasDateData =
			dateItems != null &&
			(Object.keys(dateItems.hours ?? {}).length > 0 ||
				Object.keys(dateItems.weekDays ?? {}).length > 0);

		if (hasDateData && dateItems?.weekDays) {
			weekdayDistribution = new Array(7).fill(0) as number[];
			for (const [key, val] of Object.entries(dateItems.weekDays)) {
				const idx = Number(key) - 1; // 1-7 -> 0-6
				if (idx >= 0 && idx < 7) weekdayDistribution[idx] = val.count;
			}
			peakWeekday = weekdayDistribution.reduce(
				(maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
				0,
			);
		}

		// Map tracks
		const topTracks: TopTrack[] = tracks.map((tt) => ({
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
			count: tt.streams,
			durationMs: tt.track.durationMs * tt.streams,
		}));

		// Genres from stats.fm artist payload (no extra Spotify batch here)
		const topArtists: TopArtist[] = artists.map((ta) => ({
			rank: ta.position,
			artistUri:
				prefixUri(ta.artist.externalIds?.spotify?.[0], "artist") ??
				`listening-stats:artist:${ta.artist.name}`,
			artistName: ta.artist.name,
			count: ta.streams,
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
					count: ab.streams,
					durationMs: 0,
				}))
			: deriveAlbumsFromTracks(tracks);

		// Genre counts weighted by stream totals from top artists
		const genreCount = new Map<string, number>();
		for (const ta of artists) {
			for (const genre of ta.artist.genres) {
				genreCount.set(genre, (genreCount.get(genre) ?? 0) + ta.streams);
			}
		}
		const topGenres: TopGenre[] = Array.from(genreCount.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([genre, count], i) => ({ rank: i + 1, genre, count }));

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
			// stats.fm payload has no streak field
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
		const albumsPromise = isPlus
			? sfmGet<SfmTopAlbum[]>(`/users/${username}/top/albums`, rangeParams)
			: Promise.resolve({ ok: false, status: 0, message: "skipped" } as SfmResult<SfmTopAlbum[]>);
		const perDayPromise = sfmGet<SfmPerDayStats>(`/users/${username}/streams/stats/per-day`, {
			range: "lifetime",
			timeZone,
		});
		const datesPromise = sfmGet<{ items: SfmDateStats }>(`/users/${username}/streams/stats/dates`, {
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
		let listeningDays: number | undefined;
		let dailyPlayCounts: Array<{ date: string; count: number }> | undefined;
		let newArtistCount: number | undefined;
		let priorPeriodTotalDuration: number | undefined;

		const emitNewArtistCount = () => {
			if (artists.length === 0 || priorArtists.length === 0) return;
			const currentIds = new Set(
				artists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			const priorIds = new Set(
				priorArtists.map((a) => a.artist.externalIds?.spotify?.[0]).filter((s): s is string => !!s),
			);
			let count = 0;
			for (const id of currentIds) {
				if (!priorIds.has(id)) count++;
			}
			newArtistCount = count;
			onWave({ newArtistCount }, 2);
		};

		const wave2Tasks: Promise<void>[] = [
			tracksPromise.then((res) => {
				tracks = res.ok ? res.data : [];
				topTracks = tracks.map((tt) => ({
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
					count: tt.streams,
					durationMs: tt.track.durationMs * tt.streams,
				}));
				onWave({ topTracks }, 2);
				if (!isPlus) {
					topAlbums = deriveAlbumsFromTracks(tracks);
					onWave({ topAlbums }, 2);
				}
			}),
			artistsPromise.then((res) => {
				artists = res.ok ? res.data : [];
				topArtists = artists.map((ta) => ({
					rank: ta.position,
					artistUri:
						prefixUri(ta.artist.externalIds?.spotify?.[0], "artist") ??
						`listening-stats:artist:${ta.artist.name}`,
					artistName: ta.artist.name,
					count: ta.streams,
					durationMs: ta.playedMs ?? 0,
					genres: ta.artist.genres,
					imageUrl: ta.artist.image ?? null,
				}));
				onWave({ topArtists }, 2);

				const genreCount = new Map<string, number>();
				for (const ta of artists) {
					for (const genre of ta.artist.genres) {
						genreCount.set(genre, (genreCount.get(genre) ?? 0) + ta.streams);
					}
				}
				topGenres = Array.from(genreCount.entries())
					.sort((a, b) => b[1] - a[1])
					.map(([genre, count], i) => ({ rank: i + 1, genre, count }));
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
					count: ab.streams,
					durationMs: 0,
				}));
				onWave({ topAlbums }, 2);
			}),
			perDayPromise.then((res) => {
				perDayData = res.ok ? res.data : null;
				listeningDays = perDayData?.days
					? Object.values(perDayData.days).filter((d) => d.count > 0).length
					: undefined;
				dailyPlayCounts = perDayData?.days
					? Object.entries(perDayData.days)
							.map(([date, d]) => ({ date, count: d.count }))
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
				onWave({ listeningDays, dailyPlayCounts, priorPeriodTotalDuration }, 2);
			}),
			priorPromise.then((res) => {
				priorArtists = res.ok ? res.data : [];
				emitNewArtistCount();
			}),
		];

		await Promise.allSettled(wave2Tasks);

		// ── Wave 3: activity (hourly/weekday distributions) ──
		const [datesRes] = await Promise.allSettled([datesPromise]);
		const datesFailure = extractFailure(datesRes);
		const datesData = extractData<{ items: SfmDateStats }>(datesRes);
		const dateItems = datesData?.items;

		const hourlyDistribution = new Array(24).fill(0) as number[];
		if (dateItems?.hours) {
			for (const [k, val] of Object.entries(dateItems.hours)) {
				const hr = Number(k);
				if (hr >= 0 && hr < 24) hourlyDistribution[hr] = val.count;
			}
		}
		const peakHour = hourlyDistribution.reduce(
			(maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
			0,
		);

		let weekdayDistribution: number[] | undefined;
		let peakWeekday: number | undefined;
		const hasDateData =
			dateItems != null &&
			(Object.keys(dateItems.hours ?? {}).length > 0 ||
				Object.keys(dateItems.weekDays ?? {}).length > 0);

		if (hasDateData && dateItems?.weekDays) {
			weekdayDistribution = new Array(7).fill(0) as number[];
			for (const [k, val] of Object.entries(dateItems.weekDays)) {
				const idx = Number(k) - 1;
				if (idx >= 0 && idx < 7) weekdayDistribution[idx] = val.count;
			}
			peakWeekday = weekdayDistribution.reduce(
				(maxIdx, val, idx, arr) => (val > arr[maxIdx] ? idx : maxIdx),
				0,
			);
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
