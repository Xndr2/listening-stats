import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { type Entry, ensure, getEntry, refetch, subscribe } from "./cache";

export interface QueryResult<T> extends Entry<T> {
	retry(): void;
}

const IDLE: Entry = { status: "loading", refreshing: false };

/**
 * Subscribes a component to one cached query. `key` null = disabled (the
 * widget isn't supported by the current provider, or is hidden).
 *
 * `keep` names what the data is (source + query, without period or rank).
 * While a new key with the same `keep` loads, the previous data stays up, so
 * charts move from the old values instead of dropping to a skeleton.
 */
export function useQuery<T>(
	key: string | null,
	fetcher: (signal: AbortSignal) => Promise<T>,
	opts: { persist?: boolean; keep?: string } = {},
): QueryResult<T> {
	// The latest fetcher without re-subscribing on every render.
	const fetchRef = useRef(fetcher);
	fetchRef.current = fetcher;

	const sub = useCallback((fn: () => void) => (key ? subscribe(key, fn) : () => {}), [key]);
	const snap = useCallback(() => (key ? getEntry<T>(key) : (IDLE as Entry<T>)), [key]);
	const entry = useSyncExternalStore(sub, snap);
	const last = useRef<{ keep?: string; entry: Entry<T> }>(undefined);
	if (entry.data !== undefined) last.current = { keep: opts.keep, entry };
	const shown =
		key && entry.status === "loading" && opts.keep && last.current?.keep === opts.keep
			? { ...last.current.entry, refreshing: true }
			: entry;

	useEffect(() => {
		if (key) ensure(key, (signal) => fetchRef.current(signal), opts.persist ?? true);
	}, [key, opts.persist]);

	const retry = useCallback(() => {
		if (key) void refetch(key);
	}, [key]);

	return { ...shown, retry };
}
