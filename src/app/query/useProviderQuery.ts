/**
 * Query helpers bound to the current provider and period. The key includes
 * everything that changes the answer, so switching period or rank shows that
 * combination's cached data immediately (if any) and fetches it otherwise.
 */
import { useEffect } from "react";
import { EVENTS, listen } from "../../shared/constants/events";
import { type Provider, type QueryArgs, type QueryName, supports } from "../../shared/providers/types";
import { useApp } from "../state";
import { invalidate } from "./cache";
import { type QueryResult, useQuery } from "./useQuery";

type ArgQuery = "summary" | "topTracks" | "topArtists" | "topAlbums" | "topGenres" | "hourly" | "weekday";
type Result<Q extends QueryName> = Awaited<ReturnType<NonNullable<Provider[Q]>>>;

/** For queries that take the period window (most of them). */
export function usePeriodQuery<Q extends ArgQuery>(
	q: Q,
	limit = 10,
	enabled = true,
): QueryResult<Result<Q>> & { supported: boolean } {
	const { provider, window, rank, scope, source } = useApp();
	const supported = supports(provider, q);
	const key = supported && enabled ? `${scope}:${q}:${rank}:${limit}` : null;
	const res = useQuery<Result<Q>>(
		key,
		(signal) => {
			const args: QueryArgs = { window, rank, limit, signal };
			const fn = provider[q] as (a: QueryArgs) => Promise<Result<Q>>;
			return fn.call(provider, args);
		},
		{ keep: `${source}:${q}` },
	);
	return { ...res, supported };
}

/** stats.fm and Last.fm can't tell us about new plays, so ask them again this often. */
const REMOTE_REFRESH_MS = 5 * 60_000;

/**
 * Keeps the page live: local results refetch after each recorded play, the
 * others on a timer. Only widgets on screen refetch; the rest just go stale.
 */
export function useLiveData(): void {
	useEffect(() => {
		const stop = listen(EVENTS.PLAY_RECORDED, () => invalidate((k) => k.startsWith("local:")));
		const t = setInterval(() => invalidate((k) => !k.startsWith("local:")), REMOTE_REFRESH_MS);
		return () => {
			stop();
			clearInterval(t);
		};
	}, []);
}
