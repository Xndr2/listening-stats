/**
 * Pure aggregation over play rows. No IndexedDB here: the provider streams
 * rows in chunk by chunk and these functions fold them into counters.
 *
 * Plays (type "play", or no type on old imported rows) feed the top lists.
 * Listening time counts everything that was heard, skips included.
 */
import type { RankMode } from "../../settings/registry";
import type { PlayEvent } from "../../types/play-event";
import { dateKey, weekdayIndex } from "../periods";

export interface Counter {
	count: number;
	ms: number;
}

export interface TrackRow extends Counter {
	uri: string;
	name: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	image?: string;
}

export interface ArtistRow extends Counter {
	key: string;
	uri: string;
	name: string;
}

export interface AlbumRow extends Counter {
	uri: string;
	name: string;
	artistName: string;
	image?: string;
}

export interface Aggregate {
	plays: number;
	skips: number;
	durationMs: number;
	tracks: Map<string, TrackRow>;
	artists: Map<string, ArtistRow>;
	albums: Map<string, AlbumRow>;
	hourCounts: number[];
	hourMs: number[];
	weekdayCounts: number[];
	weekdayMs: number[];
	days: Set<string>;
}

export function emptyAggregate(): Aggregate {
	return {
		plays: 0,
		skips: 0,
		durationMs: 0,
		tracks: new Map(),
		artists: new Map(),
		albums: new Map(),
		hourCounts: Array(24).fill(0),
		hourMs: Array(24).fill(0),
		weekdayCounts: Array(7).fill(0),
		weekdayMs: Array(7).fill(0),
		days: new Set(),
	};
}

export const isPlay = (e: PlayEvent) => e.type !== "skip";

/** Imported rows sometimes lack an artist uri; fall back to the name. */
export const artistKey = (e: Pick<PlayEvent, "artistUri" | "artistName">) =>
	e.artistUri || `name:${e.artistName.toLowerCase()}`;

const albumKey = (e: PlayEvent) => e.albumUri || `name:${e.albumName.toLowerCase()}|${e.artistName.toLowerCase()}`;

export function addRows(agg: Aggregate, rows: PlayEvent[]): void {
	for (const e of rows) {
		const ms = Math.max(0, e.playedMs || 0);
		agg.durationMs += ms;
		if (!isPlay(e)) {
			agg.skips++;
			continue;
		}
		agg.plays++;
		const d = new Date(e.startedAt);
		agg.hourCounts[d.getHours()]++;
		agg.hourMs[d.getHours()] += ms;
		const wd = weekdayIndex(e.startedAt);
		agg.weekdayCounts[wd]++;
		agg.weekdayMs[wd] += ms;
		agg.days.add(dateKey(e.startedAt));

		const t = agg.tracks.get(e.trackUri);
		if (t) {
			t.count++;
			t.ms += ms;
			if (!t.image && e.albumArt) t.image = e.albumArt;
		} else {
			agg.tracks.set(e.trackUri, {
				uri: e.trackUri,
				name: e.trackName,
				artistName: e.artistName,
				artistUri: e.artistUri,
				albumName: e.albumName,
				albumUri: e.albumUri,
				image: e.albumArt,
				count: 1,
				ms,
			});
		}

		const ak = artistKey(e);
		const a = agg.artists.get(ak);
		if (a) {
			a.count++;
			a.ms += ms;
		} else agg.artists.set(ak, { key: ak, uri: e.artistUri, name: e.artistName, count: 1, ms });

		if (e.albumName || e.albumUri) {
			const bk = albumKey(e);
			const b = agg.albums.get(bk);
			if (b) {
				b.count++;
				b.ms += ms;
				if (!b.image && e.albumArt) b.image = e.albumArt;
			} else {
				agg.albums.set(bk, {
					uri: e.albumUri,
					name: e.albumName,
					artistName: e.artistName,
					image: e.albumArt,
					count: 1,
					ms,
				});
			}
		}
	}
}

/** Sorted by the rank mode, ties broken by the other measure, then name. */
export function ranked<T extends Counter & { name: string }>(items: Iterable<T>, rank: RankMode, limit: number): T[] {
	const primary = rank === "minutes" ? "ms" : "count";
	const secondary = rank === "minutes" ? "count" : "ms";
	return [...items]
		.sort((a, b) => b[primary] - a[primary] || b[secondary] - a[secondary] || a.name.localeCompare(b.name))
		.slice(0, limit);
}

/** Days in a row with at least one play, ending today (or yesterday, if today has none yet). */
export function streakFrom(days: Set<string>, now: number): number {
	const d = new Date(now);
	let cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	if (!days.has(dateKey(cursor.getTime())))
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
	let n = 0;
	while (days.has(dateKey(cursor.getTime()))) {
		n++;
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
	}
	return n;
}
