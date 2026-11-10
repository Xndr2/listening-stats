/**
 * The contract every data source implements.
 *
 * Instead of one big "stats" call, a provider answers small queries, one per
 * dashboard widget, so each widget can show its data as soon as it arrives.
 * A provider that can't answer a query leaves the method out, and the layout
 * shows a different widget in that slot.
 */
import type { ProviderId, RankMode } from "../settings/registry";
import type { PeriodId, PeriodWindow } from "./periods";

export interface QueryArgs {
	window: PeriodWindow;
	rank: RankMode;
	limit: number;
	signal?: AbortSignal;
}

/** count/durationMs are undefined when the source doesn't know them (stats.fm free). */
interface Ranked {
	rank: number;
	count?: number;
	durationMs?: number;
}

export interface TopTrack extends Ranked {
	uri: string;
	name: string;
	artistName: string;
	artistUri?: string;
	albumName?: string;
	albumUri?: string;
	image?: string;
}

export interface TopArtist extends Ranked {
	uri: string;
	name: string;
	image?: string;
	genres?: string[];
}

export interface TopAlbum extends Ranked {
	uri: string;
	name: string;
	artistName: string;
	image?: string;
}

export interface TopGenre extends Ranked {
	name: string;
	/** 0..1 of all genre-tagged plays in the window */
	share: number;
}

export interface RecentPlay {
	uri: string;
	name: string;
	artistName: string;
	image?: string;
	playedAt: number;
}

export interface Summary {
	plays: number;
	/** Undefined when the source doesn't track listening time (Last.fm). */
	durationMs?: number;
	/** Same measure for the previous window of equal length; undefined for all time. */
	previousDurationMs?: number;
	uniqueTracks?: number;
	uniqueArtists?: number;
	newArtists?: number;
	activeDays?: number;
	/** Days in the window so far (for "6 of 7 days"). */
	windowDays: number;
	streak?: number;
	skipRate?: number;
	topGenre?: { name: string; share: number };
}

/** Plays and minutes per bucket. hour: 24 buckets; weekday: 7, Monday first. */
export interface Buckets {
	counts: number[];
	durationMs: number[];
	/** True when only part of the window could be fetched (Last.fm page cap). */
	partial?: boolean;
}

export interface DayCount {
	/** Local date, YYYY-MM-DD */
	date: string;
	count: number;
	durationMs: number;
	/** The source couldn't load this day (Last.fm page cap); not the same as no music. */
	unknown?: boolean;
}

/** Last.fm and some imports carry no Spotify uri; the UI resolves these on click. */
export const isPlayableUri = (uri: string | undefined): uri is string => !!uri && uri.startsWith("spotify:");

export interface Provider {
	id: ProviderId;
	name: string;
	/** Periods this provider can answer, in display order. */
	periods: PeriodId[];
	/** True when top lists carry real per-item play counts. */
	perItemCounts(): boolean;
	/** False when the source can only rank by play count. */
	rankByMinutes: boolean;

	summary?(a: QueryArgs): Promise<Summary>;
	topTracks?(a: QueryArgs): Promise<TopTrack[]>;
	topArtists?(a: QueryArgs): Promise<TopArtist[]>;
	topAlbums?(a: QueryArgs): Promise<TopAlbum[]>;
	topGenres?(a: QueryArgs): Promise<TopGenre[]>;
	recent?(a: { limit: number; signal?: AbortSignal }): Promise<RecentPlay[]>;
	hourly?(a: QueryArgs): Promise<Buckets>;
	weekday?(a: QueryArgs): Promise<Buckets>;
	/** Per-day totals for the last `days` days, for the heatmap. */
	daily?(a: { days: number; signal?: AbortSignal }): Promise<DayCount[]>;
	/** How often one track was played, all time or inside `window`. null = unknown. */
	playCount?(a: {
		track: { uri: string; name: string; artistName: string };
		window?: PeriodWindow;
		signal?: AbortSignal;
	}): Promise<number | null>;
}

export type QueryName = Exclude<keyof Provider, "id" | "name" | "periods" | "perItemCounts" | "rankByMinutes">;

export function supports(p: Provider, q: QueryName): boolean {
	return typeof p[q] === "function";
}
