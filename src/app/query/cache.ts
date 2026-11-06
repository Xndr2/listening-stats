/**
 * A small query cache: each widget asks for one key, sees cached data at
 * once, and gets fresh data as soon as its own request finishes. Results are
 * also saved to IndexedDB: when a request fails with nothing on screen yet
 * (stats.fm down, offline), that saved copy is shown with the error.
 *
 * Entries are replaced (never mutated) so useSyncExternalStore sees changes.
 */
import { v3Get, v3Put } from "../../shared/storage/v3-db";

export type Status = "loading" | "success" | "error";

export interface Entry<T = unknown> {
	status: Status;
	data?: T;
	error?: unknown;
	/** When `data` was fetched (ms). */
	fetchedAt?: number;
	/** A request is running while older data is shown. */
	refreshing: boolean;
}

interface Slot {
	entry: Entry;
	listeners: Set<() => void>;
	inflight?: Promise<void>;
	fetcher?: (signal: AbortSignal) => Promise<unknown>;
	persist: boolean;
	stale: boolean;
	/** Bumped by every invalidation; a fetch that started before a bump is outdated. */
	gen: number;
}

const slots = new Map<string, Slot>();
const LOADING: Entry = { status: "loading", refreshing: false };
/** Fresh data younger than this isn't refetched just because a widget mounted. */
const FRESH_MS = 60_000;

function slot(key: string): Slot {
	let s = slots.get(key);
	if (!s) {
		s = { entry: LOADING, listeners: new Set(), persist: false, stale: true, gen: 0 };
		slots.set(key, s);
	}
	return s;
}

function set(key: string, entry: Entry): void {
	const s = slot(key);
	s.entry = entry;
	for (const l of s.listeners) l();
}

export function getEntry<T>(key: string): Entry<T> {
	return slot(key).entry as Entry<T>;
}

export function subscribe(key: string, fn: () => void): () => void {
	const s = slot(key);
	s.listeners.add(fn);
	return () => s.listeners.delete(fn);
}

async function run(key: string): Promise<void> {
	const s = slot(key);
	if (s.inflight || !s.fetcher) return s.inflight;
	const fetcher = s.fetcher;
	const startGen = s.gen;
	const prev = s.entry;
	if (prev.status === "success") set(key, { ...prev, refreshing: true });
	const ctrl = new AbortController();
	s.inflight = (async () => {
		try {
			const data = await fetcher(ctrl.signal);
			// Invalidated while this request ran (e.g. a play was recorded): the
			// result is already outdated, so keep it stale and fetch again below.
			s.stale = s.gen !== startGen;
			set(key, { status: "success", data, fetchedAt: Date.now(), refreshing: s.stale });
			if (s.persist) void v3Put("cache", { data, at: Date.now() }, key).catch(() => {});
		} catch (error) {
			// Keep showing the last good data, or fall back to the saved copy; the
			// widget shows the error next to it.
			const saved =
				s.persist && s.entry.data === undefined
					? await v3Get<{ data: unknown; at: number }>("cache", key).catch(() => undefined)
					: undefined;
			const cur = slot(key).entry;
			if (saved && cur.data === undefined)
				set(key, { status: "success", data: saved.data, fetchedAt: saved.at, error, refreshing: false });
			else set(key, { ...cur, status: cur.data !== undefined ? "success" : "error", error, refreshing: false });
		} finally {
			s.inflight = undefined;
		}
		if (s.gen !== startGen && s.listeners.size > 0) await run(key);
	})();
	return s.inflight;
}

/** Registers the fetcher for `key` and starts it if needed. */
export function ensure(key: string, fetcher: (signal: AbortSignal) => Promise<unknown>, persist: boolean): void {
	const s = slot(key);
	s.fetcher = fetcher;
	s.persist = persist;
	const e = s.entry;
	const fresh = e.status === "success" && !s.stale && Date.now() - (e.fetchedAt ?? 0) < FRESH_MS;
	if (fresh || s.inflight) return;
	void run(key);
}

export function refetch(key: string): Promise<void> {
	const s = slot(key);
	s.stale = true;
	s.gen++;
	if (s.entry.status === "error") set(key, { ...LOADING, refreshing: false });
	return run(key);
}

/** Marks matching keys stale; ones on screen refetch right away. */
export function invalidate(match: (key: string) => boolean): void {
	for (const [key, s] of slots) {
		if (!match(key)) continue;
		s.stale = true;
		s.gen++;
		if (s.listeners.size > 0) void run(key);
	}
}
