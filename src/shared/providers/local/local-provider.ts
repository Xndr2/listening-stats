/**
 * Local provider: everything computed from the play history on this device.
 *
 * Two cached passes, both thrown away when anything writes new plays:
 *  - a window aggregate per period (top lists, hours, weekdays)
 *  - one all-time index (first time each artist was heard, daily totals)
 */
import { allArtistRecords } from "../../storage/artists";
import { countTrackPlays, forEachPlayEventChunk, lastWriteAt, recentPlayEvents } from "../../storage/play-events";
import { dateKey, PERIOD_IDS, windowDays } from "../periods";
import type { Buckets, DayCount, Provider, QueryArgs, Summary, TopGenre } from "../types";
import { type Aggregate, addRows, artistKey, emptyAggregate, isPlay, ranked, streakFrom } from "./aggregate";

interface AllTimeIndex {
	firstPlayAt: number | undefined;
	artistFirstSeen: Map<string, number>;
	daily: Map<string, { count: number; ms: number }>;
}

let cacheStamp = -1;
const windowCache = new Map<string, Promise<Aggregate>>();
let indexCache: Promise<AllTimeIndex> | null = null;

function freshCache(): void {
	const stamp = lastWriteAt();
	if (stamp !== cacheStamp) {
		cacheStamp = stamp;
		windowCache.clear();
		indexCache = null;
	}
}

function aggregateRange(start: number, end: number): Promise<Aggregate> {
	freshCache();
	const key = `${start}:${end}`;
	let p = windowCache.get(key);
	if (!p) {
		p = (async () => {
			const agg = emptyAggregate();
			await forEachPlayEventChunk(start, end, (rows) => addRows(agg, rows));
			return agg;
		})();
		p.catch(() => windowCache.delete(key));
		// Windows end at "now", so keys rarely repeat; keep the map small.
		if (windowCache.size > 16) windowCache.delete(windowCache.keys().next().value as string);
		windowCache.set(key, p);
	}
	return p;
}

/** Windows ending at "now" change every millisecond; round so widgets share one pass. */
function stableEnd(end: number): number {
	return Math.ceil(end / 60_000) * 60_000;
}

const forWindow = (a: QueryArgs) => aggregateRange(a.window.start, stableEnd(a.window.end));

function allTimeIndex(): Promise<AllTimeIndex> {
	freshCache();
	if (!indexCache) {
		indexCache = (async () => {
			const idx: AllTimeIndex = { firstPlayAt: undefined, artistFirstSeen: new Map(), daily: new Map() };
			await forEachPlayEventChunk(0, Number.MAX_SAFE_INTEGER, (rows) => {
				for (const e of rows) {
					if (!isPlay(e)) continue;
					idx.firstPlayAt ??= e.startedAt;
					const ak = artistKey(e);
					if (!idx.artistFirstSeen.has(ak)) idx.artistFirstSeen.set(ak, e.startedAt);
					const k = dateKey(e.startedAt);
					const d = idx.daily.get(k);
					if (d) {
						d.count++;
						d.ms += e.playedMs || 0;
					} else idx.daily.set(k, { count: 1, ms: e.playedMs || 0 });
				}
			});
			return idx;
		})();
		indexCache.catch(() => {
			indexCache = null;
		});
	}
	return indexCache;
}

async function genreCounts(agg: Aggregate, rank: QueryArgs["rank"]): Promise<TopGenre[]> {
	const records = await allArtistRecords();
	const totals = new Map<string, { count: number; ms: number }>();
	for (const a of agg.artists.values()) {
		const genres = records.get(a.uri)?.genres ?? [];
		for (const g of genres) {
			const t = totals.get(g) ?? { count: 0, ms: 0 };
			t.count += a.count;
			t.ms += a.ms;
			totals.set(g, t);
		}
	}
	const measure = rank === "minutes" ? "ms" : "count";
	const sum = [...totals.values()].reduce((s, t) => s + t[measure], 0) || 1;
	return ranked(
		[...totals].map(([name, t]) => ({ name, ...t })),
		rank,
		Number.MAX_SAFE_INTEGER,
	).map((g, i) => ({ rank: i + 1, name: g.name, count: g.count, durationMs: g.ms, share: g[measure] / sum }));
}

export const localProvider: Provider = {
	id: "local",
	name: "Local",
	periods: [...PERIOD_IDS],
	perItemCounts: () => true,
	rankByMinutes: true,

	async summary(a): Promise<Summary> {
		const [agg, idx] = await Promise.all([forWindow(a), allTimeIndex()]);
		const prev = a.window.previous
			? await aggregateRange(a.window.previous.start, stableEnd(a.window.previous.end))
			: undefined;
		let newArtists = 0;
		for (const key of agg.artists.keys()) {
			const first = idx.artistFirstSeen.get(key);
			if (first !== undefined && first >= a.window.start) newArtists++;
		}
		const genres = await genreCounts(agg, a.rank).catch(() => []);
		const total = agg.plays + agg.skips;
		return {
			plays: agg.plays,
			durationMs: agg.durationMs,
			previousDurationMs: prev?.durationMs,
			uniqueTracks: agg.tracks.size,
			uniqueArtists: agg.artists.size,
			newArtists,
			activeDays: agg.days.size,
			windowDays: windowDays(a.window, idx.firstPlayAt),
			streak: streakFrom(new Set(idx.daily.keys()), Date.now()),
			skipRate: total ? agg.skips / total : 0,
			topGenre: genres[0] ? { name: genres[0].name, share: genres[0].share } : undefined,
		};
	},

	async topTracks(a) {
		return ranked((await forWindow(a)).tracks.values(), a.rank, a.limit).map((t, i) => ({
			rank: i + 1,
			uri: t.uri,
			name: t.name,
			artistName: t.artistName,
			artistUri: t.artistUri,
			albumName: t.albumName,
			albumUri: t.albumUri,
			image: t.image,
			count: t.count,
			durationMs: t.ms,
		}));
	},

	async topArtists(a) {
		const [agg, records] = await Promise.all([forWindow(a), allArtistRecords()]);
		return ranked(agg.artists.values(), a.rank, a.limit).map((r, i) => {
			const rec = records.get(r.uri);
			return {
				rank: i + 1,
				uri: r.uri,
				name: r.name,
				count: r.count,
				durationMs: r.ms,
				image: rec?.imageUrl ?? undefined,
				genres: rec?.genres,
			};
		});
	},

	async topAlbums(a) {
		return ranked((await forWindow(a)).albums.values(), a.rank, a.limit).map((r, i) => ({
			rank: i + 1,
			uri: r.uri,
			name: r.name,
			artistName: r.artistName,
			image: r.image,
			count: r.count,
			durationMs: r.ms,
		}));
	},

	async topGenres(a) {
		return (await genreCounts(await forWindow(a), a.rank)).slice(0, a.limit);
	},

	async recent({ limit }) {
		const rows = await recentPlayEvents(limit * 2);
		return rows
			.filter(isPlay)
			.slice(0, limit)
			.map((e) => ({
				uri: e.trackUri,
				name: e.trackName,
				artistName: e.artistName,
				image: e.albumArt,
				playedAt: e.startedAt,
			}));
	},

	async hourly(a): Promise<Buckets> {
		const agg = await forWindow(a);
		return { counts: agg.hourCounts, durationMs: agg.hourMs };
	},

	async weekday(a): Promise<Buckets> {
		const agg = await forWindow(a);
		return { counts: agg.weekdayCounts, durationMs: agg.weekdayMs };
	},

	async daily({ days }): Promise<DayCount[]> {
		const idx = await allTimeIndex();
		const out: DayCount[] = [];
		const today = new Date();
		for (let i = days - 1; i >= 0; i--) {
			const key = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i).getTime());
			const d = idx.daily.get(key);
			out.push({ date: key, count: d?.count ?? 0, durationMs: d?.ms ?? 0 });
		}
		return out;
	},

	async playCount({ track, window }) {
		return countTrackPlays(track.uri, window?.start ?? 0, window?.end ?? Number.MAX_SAFE_INTEGER);
	},
};
