/**
 * stats.fm through the provider contract.
 *
 * Every period is sent as an explicit after/before window, so stats.fm offers
 * the same periods as local data. Rank mode maps to orderBy. Free accounts
 * don't get per-item stream counts; perItemCounts() says so and the UI hides
 * those columns instead of showing zeros.
 */

import { getJson } from "../../net/http";
import { withSpotify } from "../../spotify/resolve";
import { dateKey, PERIOD_IDS } from "../periods";
import type { Buckets, DayCount, Provider, QueryArgs, Summary, TopTrack } from "../types";
import {
	readStatsFmConfig,
	SFM_BASE,
	type SfmDateStats,
	type SfmRecent,
	type SfmStreamStats,
	type SfmTopAlbum,
	type SfmTopArtist,
	type SfmTopGenre,
	type SfmTopTrack,
	type SfmTrack,
	sfmItems,
	spotifyUri,
} from "./client";

function username(): string {
	const c = readStatsFmConfig();
	if (!c) throw new Error("stats.fm isn't connected");
	return c.username;
}

function timeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function range(a: QueryArgs): { after: number; before: number } {
	// stats.fm rejects before=0 windows; all time starts at its epoch anyway
	return { after: Math.max(0, a.window.start), before: a.window.end };
}

const orderBy = (a: QueryArgs) => (a.rank === "minutes" ? "TIME" : "COUNT");

const num = (v: number | null | undefined) => (typeof v === "number" ? v : undefined);

/** Spotify uri -> every stats.fm id for that song (stats.fm can hold duplicates). */
const searchedIds = new Map<string, number[]>();

const norm = (s: string) => s.trim().toLowerCase();

/** Finds stats.fm ids for a Spotify track by searching its title. */
async function statsFmIdsFor(
	t: { uri: string; name: string; artistName: string },
	signal?: AbortSignal,
): Promise<number[]> {
	const known = searchedIds.get(t.uri);
	if (known) return known;
	const spotifyId = t.uri.startsWith("spotify:track:") ? t.uri.slice(14) : "";
	if (!spotifyId || !t.name.trim()) return [];
	const qs = new URLSearchParams({ query: t.name.trim(), type: "track", limit: "50" });
	const body = await getJson<{ items?: { tracks?: SfmTrack[] } }>(`${SFM_BASE}/search/elastic?${qs}`, { signal });
	const artist = norm(t.artistName.split(",")[0] ?? "");
	const ids = (body?.items?.tracks ?? [])
		.filter(
			(r) =>
				r.externalIds?.spotify?.includes(spotifyId) ||
				(norm(r.name) === norm(t.name) && !!artist && r.artists.some((a) => norm(a.name) === artist)),
		)
		.map((r) => r.id)
		.filter(Number.isInteger);
	const out = [...new Set(ids)];
	searchedIds.set(t.uri, out);
	return out;
}

/** stats.fm joins artists with ", "; Spotify search matches on the main one. */
const firstArtist = (r: { artistName?: string }) => r.artistName?.split(", ")[0] ?? "";

function trackRow(t: SfmTrack) {
	return {
		uri: spotifyUri("track", t.externalIds?.spotify),
		name: t.name,
		artistName: t.artists.map((a) => a.name).join(", "),
		albumName: t.albums[0]?.name,
		image: t.albums[0]?.image ?? undefined,
	};
}

function toBuckets(
	b: Record<string, { count: number; durationMs: number }> | undefined,
	size: number,
	offset: number,
): Buckets {
	const counts = Array(size).fill(0);
	const durationMs = Array(size).fill(0);
	for (const [k, v] of Object.entries(b ?? {})) {
		const i = Number(k) - offset;
		if (i >= 0 && i < size) {
			counts[i] = v.count;
			durationMs[i] = v.durationMs;
		}
	}
	return { counts, durationMs };
}

async function dateStats(a: { after: number; before: number }, signal?: AbortSignal): Promise<SfmDateStats> {
	return sfmItems<SfmDateStats>(username(), "/streams/stats/dates", { ...a, timeZone: timeZone() }, "object", signal);
}

export const statsFmProvider: Provider = {
	id: "statsfm",
	name: "stats.fm",
	periods: [...PERIOD_IDS],
	perItemCounts: () => readStatsFmConfig()?.isPlus === true,
	rankByMinutes: true,

	async summary(a): Promise<Summary> {
		const u = username();
		const [stats, prev, dates, genres] = await Promise.all([
			sfmItems<SfmStreamStats>(u, "/streams/stats", range(a), "object", a.signal),
			a.window.previous
				? sfmItems<SfmStreamStats>(
						u,
						"/streams/stats",
						{ after: a.window.previous.start, before: a.window.previous.end },
						"object",
						a.signal,
					).catch(() => undefined)
				: Promise.resolve(undefined),
			// Day-of-month buckets only identify days uniquely inside one month.
			a.window.end - a.window.start <= 31 * 86_400_000
				? dateStats(range(a), a.signal).catch(() => undefined)
				: Promise.resolve(undefined),
			sfmItems<SfmTopGenre[]>(u, "/top/genres", { ...range(a), limit: 1 }, "array", a.signal).catch(() => []),
		]);
		const total = stats.count || 1;
		const g = genres[0];
		return {
			plays: stats.count,
			durationMs: stats.durationMs,
			previousDurationMs: prev?.durationMs,
			uniqueTracks: stats.cardinality?.tracks,
			uniqueArtists: stats.cardinality?.artists,
			activeDays: dates?.monthDays ? Object.values(dates.monthDays).filter((d) => d.count > 0).length : undefined,
			windowDays: Math.max(1, Math.ceil((a.window.end - Math.max(a.window.start, 0)) / 86_400_000)),
			topGenre: g ? { name: g.genre.tag, share: (num(g.streams) ?? 0) / total } : undefined,
		};
	},

	async topTracks(a): Promise<TopTrack[]> {
		const items = await sfmItems<SfmTopTrack[]>(
			username(),
			"/top/tracks",
			{ ...range(a), limit: a.limit, orderBy: orderBy(a) },
			"array",
			a.signal,
		);
		return withSpotify(
			"track",
			items.map((it, i) => {
				const row = trackRow(it.track);
				return { rank: i + 1, ...row, count: num(it.streams), durationMs: num(it.playedMs) };
			}),
			firstArtist,
		);
	},

	async topArtists(a) {
		const items = await sfmItems<SfmTopArtist[]>(
			username(),
			"/top/artists",
			{ ...range(a), limit: a.limit, orderBy: orderBy(a) },
			"array",
			a.signal,
		);
		return withSpotify(
			"artist",
			items.map((it, i) => ({
				rank: i + 1,
				uri: spotifyUri("artist", it.artist.externalIds?.spotify),
				name: it.artist.name,
				image: it.artist.image ?? undefined,
				genres: it.artist.genres,
				count: num(it.streams),
				durationMs: num(it.playedMs),
			})),
		);
	},

	async topAlbums(a) {
		const items = await sfmItems<SfmTopAlbum[]>(
			username(),
			"/top/albums",
			{ ...range(a), limit: a.limit, orderBy: orderBy(a) },
			"array",
			a.signal,
		);
		return withSpotify(
			"album",
			items.map((it, i) => ({
				rank: i + 1,
				uri: spotifyUri("album", it.album.externalIds?.spotify),
				name: it.album.name,
				artistName: it.album.artists?.map((x) => x.name).join(", ") ?? "",
				image: it.album.image ?? undefined,
				count: num(it.streams),
				durationMs: num(it.playedMs),
			})),
			firstArtist,
		);
	},

	async topGenres(a) {
		const items = await sfmItems<SfmTopGenre[]>(
			username(),
			"/top/genres",
			{ ...range(a), limit: a.limit },
			"array",
			a.signal,
		);
		const measure = (g: SfmTopGenre) => (a.rank === "minutes" ? num(g.playedMs) : num(g.streams)) ?? 0;
		const sum = items.reduce((s, g) => s + measure(g), 0) || 1;
		// stats.fm ignores `limit` here; share is over all genres, then trim.
		return items.slice(0, a.limit).map((g, i) => ({
			rank: i + 1,
			name: g.genre.tag,
			count: num(g.streams),
			durationMs: num(g.playedMs),
			share: measure(g) / sum,
		}));
	},

	async recent({ limit, signal }) {
		const items = await sfmItems<SfmRecent[]>(username(), "/streams/recent", { limit }, "array", signal);
		// stats.fm ignores `limit` here too
		return withSpotify(
			"track",
			items.slice(0, limit).map((r) => ({ ...trackRow(r.track), playedAt: Date.parse(r.endTime) || 0 })),
			firstArtist,
		);
	},

	async hourly(a) {
		return toBuckets((await dateStats(range(a), a.signal)).hours, 24, 0);
	},

	async weekday(a) {
		// stats.fm weekdays are ISO: 1 = Monday ... 7 = Sunday
		return toBuckets((await dateStats(range(a), a.signal)).weekDays, 7, 1);
	},

	async daily({ days, signal }): Promise<DayCount[]> {
		// One request per calendar month; monthDays is unique within a month.
		const today = new Date();
		const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
		const months: Date[] = [];
		for (
			let m = new Date(first.getFullYear(), first.getMonth(), 1);
			m <= today;
			m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
		) {
			months.push(m);
		}
		const byDate = new Map<string, { count: number; durationMs: number }>();
		await Promise.all(
			months.map(async (m) => {
				const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
				const stats = await dateStats({ after: m.getTime(), before: next.getTime() }, signal);
				for (const [day, v] of Object.entries(stats.monthDays ?? {})) {
					byDate.set(dateKey(new Date(m.getFullYear(), m.getMonth(), Number(day)).getTime()), v);
				}
			}),
		);
		const out: DayCount[] = [];
		for (let i = 0; i < days; i++) {
			const key = dateKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
			const v = byDate.get(key);
			out.push({ date: key, count: v?.count ?? 0, durationMs: v?.durationMs ?? 0 });
		}
		return out;
	},

	async playCount({ track, window, signal }) {
		const ids = await statsFmIdsFor(track, signal);
		if (!ids.length) return null;
		const params: Record<string, string | number> = { ids: ids.join(",") };
		if (window) Object.assign(params, { after: Math.max(0, window.start), before: window.end });
		else params.range = "lifetime";
		const stats = await sfmItems<Record<string, { count?: number }>>(
			username(),
			"/streams/tracks/list/stats",
			params,
			"object",
			signal,
		);
		return Object.values(stats).reduce((s, v) => s + (Number(v?.count) || 0), 0);
	},
};
