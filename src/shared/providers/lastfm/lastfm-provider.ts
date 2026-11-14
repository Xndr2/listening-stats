/**
 * Last.fm through the provider contract.
 *
 * Top lists use the weekly chart methods, which accept any from/to window;
 * all time uses the overall top lists. Last.fm has no listening time, so it
 * ranks by plays only. Hour/weekday/heatmap data comes from paging through
 * scrobbles, capped so a big library doesn't fire hundreds of requests; the
 * result is marked partial when the cap is hit.
 */
import { withSpotify } from "../../spotify/resolve";
import { dateKey, PERIOD_IDS, weekdayIndex } from "../periods";
import type { Buckets, DayCount, Provider, QueryArgs, RecentPlay } from "../types";
import {
	asArray,
	type LastFmConfig,
	type LfmAlbum,
	type LfmArtist,
	type LfmTrack,
	lfmArtistName,
	lfmCall,
	lfmImage,
	readLastFmConfig,
} from "./client";

const PAGE_SIZE = 200;

export const MAX_PAGES = 15;

function cfg(): LastFmConfig {
	const c = readLastFmConfig();
	if (!c) throw new Error("Last.fm isn't connected");
	return c;
}

const sec = (ms: number) => Math.floor(ms / 1000);
const count = (s: string | undefined) => Number.parseInt(s ?? "", 10) || 0;
const isAllTime = (a: QueryArgs) => a.window.id === "all-time";
const win = (a: QueryArgs) => ({ from: sec(Math.max(0, a.window.start)), to: sec(a.window.end) });

/** Scrobbles (oldest page last) in [from, to], up to MAX_PAGES pages. */
async function scrobbles(
	from: number,
	to: number,
	signal?: AbortSignal,
): Promise<{ tracks: LfmTrack[]; partial: boolean }> {
	const c = cfg();
	type Page = { recenttracks: { track: LfmTrack | LfmTrack[]; "@attr": { totalPages: string } } };
	const first = await lfmCall<Page>("user.getrecenttracks", { from, to, limit: PAGE_SIZE, page: 1 }, c, signal);
	const total = count(first.recenttracks["@attr"]?.totalPages);
	const pages = Math.min(total, MAX_PAGES);
	const rest: Page[] = [];
	// A few at a time: Last.fm allows roughly 5 requests a second per key.
	for (let p = 2; p <= pages; p += 4) {
		const batch = [];
		for (let q = p; q < p + 4 && q <= pages; q++) {
			batch.push(lfmCall<Page>("user.getrecenttracks", { from, to, limit: PAGE_SIZE, page: q }, c, signal));
		}
		rest.push(...(await Promise.all(batch)));
	}
	const tracks = [first, ...rest]
		.flatMap((pg) => asArray(pg.recenttracks.track))
		.filter((t) => t.date?.uts && t["@attr"]?.nowplaying !== "true");
	return { tracks, partial: total > MAX_PAGES };
}

function bucketize(tracks: LfmTrack[], kind: "hour" | "weekday"): number[] {
	const out = Array(kind === "hour" ? 24 : 7).fill(0);
	for (const t of tracks) {
		const ms = Number(t.date?.uts) * 1000;
		out[kind === "hour" ? new Date(ms).getHours() : weekdayIndex(ms)]++;
	}
	return out;
}

export const lastFmProvider: Provider = {
	id: "lastfm",
	name: "Last.fm",
	periods: [...PERIOD_IDS],
	perItemCounts: () => true,
	rankByMinutes: () => false,

	async summary(a) {
		const c = cfg();
		type Recent = { recenttracks: { "@attr": { total: string } } };
		const totalIn = (from: number, to: number) =>
			lfmCall<Recent>("user.getrecenttracks", { from, to, limit: 1 }, c, a.signal).then((r) =>
				count(r.recenttracks["@attr"]?.total),
			);
		const w = win(a);
		const [plays, artists] = await Promise.all([
			totalIn(w.from, w.to),
			isAllTime(a)
				? lfmCall<{ user: { artist_count: string } }>("user.getinfo", {}, c, a.signal).then((r) =>
						count(r.user.artist_count),
					)
				: lfmCall<{ weeklyartistchart: { artist: LfmArtist[] } }>("user.getweeklyartistchart", w, c, a.signal).then(
						(r) => asArray(r.weeklyartistchart.artist).length,
					),
		]);
		return {
			plays,
			uniqueArtists: artists,
			windowDays: Math.max(1, Math.ceil((a.window.end - Math.max(0, a.window.start)) / 86_400_000)),
		};
	},

	async topTracks(a) {
		const c = cfg();
		const items = isAllTime(a)
			? asArray(
					(
						await lfmCall<{ toptracks: { track: LfmTrack[] } }>(
							"user.gettoptracks",
							{ period: "overall", limit: a.limit },
							c,
							a.signal,
						)
					).toptracks.track,
				)
			: asArray(
					(await lfmCall<{ weeklytrackchart: { track: LfmTrack[] } }>("user.getweeklytrackchart", win(a), c, a.signal))
						.weeklytrackchart.track,
				);
		return withSpotify(
			"track",
			items.slice(0, a.limit).map((t, i) => ({
				rank: i + 1,
				uri: "",
				name: t.name,
				artistName: lfmArtistName(t.artist),
				image: lfmImage(t.image),
				count: count(t.playcount),
			})),
		);
	},

	async topArtists(a) {
		const c = cfg();
		const items = isAllTime(a)
			? asArray(
					(
						await lfmCall<{ topartists: { artist: LfmArtist[] } }>(
							"user.gettopartists",
							{ period: "overall", limit: a.limit },
							c,
							a.signal,
						)
					).topartists.artist,
				)
			: asArray(
					(
						await lfmCall<{ weeklyartistchart: { artist: LfmArtist[] } }>(
							"user.getweeklyartistchart",
							win(a),
							c,
							a.signal,
						)
					).weeklyartistchart.artist,
				);
		return withSpotify(
			"artist",
			items
				.slice(0, a.limit)
				.map((r, i) => ({ rank: i + 1, uri: "", name: r.name, image: lfmImage(r.image), count: count(r.playcount) })),
		);
	},

	async topAlbums(a) {
		const c = cfg();
		const items = isAllTime(a)
			? asArray(
					(
						await lfmCall<{ topalbums: { album: LfmAlbum[] } }>(
							"user.gettopalbums",
							{ period: "overall", limit: a.limit },
							c,
							a.signal,
						)
					).topalbums.album,
				)
			: asArray(
					(await lfmCall<{ weeklyalbumchart: { album: LfmAlbum[] } }>("user.getweeklyalbumchart", win(a), c, a.signal))
						.weeklyalbumchart.album,
				);
		return withSpotify(
			"album",
			items.slice(0, a.limit).map((r, i) => ({
				rank: i + 1,
				uri: "",
				name: r.name,
				artistName: lfmArtistName(r.artist),
				image: lfmImage(r.image),
				count: count(r.playcount),
			})),
		);
	},

	async recent({ limit, signal }): Promise<RecentPlay[]> {
		const r = await lfmCall<{ recenttracks: { track: LfmTrack[] } }>(
			"user.getrecenttracks",
			{ limit: limit + 1 },
			cfg(),
			signal,
		);
		return withSpotify(
			"track",
			asArray(r.recenttracks.track)
				.filter((t) => t.date?.uts)
				.slice(0, limit)
				.map((t) => ({
					uri: "",
					name: t.name,
					artistName: lfmArtistName(t.artist),
					image: lfmImage(t.image),
					playedAt: Number(t.date?.uts) * 1000,
				})),
		);
	},

	async hourly(a): Promise<Buckets> {
		const w = win(a);
		const { tracks, partial } = await scrobbles(w.from, w.to, a.signal);
		return { counts: bucketize(tracks, "hour"), durationMs: Array(24).fill(0), partial };
	},

	async weekday(a): Promise<Buckets> {
		const w = win(a);
		const { tracks, partial } = await scrobbles(w.from, w.to, a.signal);
		return { counts: bucketize(tracks, "weekday"), durationMs: Array(7).fill(0), partial };
	},

	async playCount({ track, window, signal }) {
		const c = cfg();
		const artist = track.artistName.split(",")[0]?.trim() ?? "";
		if (window) {
			// Scrobbles of this one track inside the window; only the total is needed.
			const r = await lfmCall<{ trackscrobbles?: { "@attr"?: { total?: string } } }>(
				"user.getTrackScrobbles",
				{ artist, track: track.name, limit: 1, ...win({ window } as QueryArgs) },
				c,
				signal,
			);
			const total = r.trackscrobbles?.["@attr"]?.total;
			return total === undefined ? null : count(total);
		}
		const r = await lfmCall<{ track?: { userplaycount?: string } }>(
			"track.getInfo",
			{ artist, track: track.name, autocorrect: 1, username: c.username },
			c,
			signal,
		);
		return r.track?.userplaycount !== undefined ? count(r.track.userplaycount) : null;
	},

	async daily({ days, signal }): Promise<DayCount[]> {
		const today = new Date();
		const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
		const { tracks, partial } = await scrobbles(sec(first.getTime()), sec(Date.now()), signal);
		const byDate = new Map<string, number>();
		let oldest = Number.POSITIVE_INFINITY;
		for (const t of tracks) {
			const ms = Number(t.date?.uts) * 1000;
			oldest = Math.min(oldest, ms);
			const k = dateKey(ms);
			byDate.set(k, (byDate.get(k) ?? 0) + 1);
		}
		// Pages come newest first; when capped, days before the oldest one we got are unknown.
		const loadedFrom = partial && Number.isFinite(oldest) ? dateKey(oldest) : "";
		return Array.from({ length: days }, (_, i) => {
			const date = dateKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
			return {
				date,
				count: byDate.get(date) ?? 0,
				durationMs: 0,
				...(loadedFrom && date < loadedFrom ? { unknown: true } : {}),
			};
		});
	},
};
