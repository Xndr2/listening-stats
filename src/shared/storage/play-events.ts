/**
 * Reads and writes play history. Every write path takes the first-run
 * snapshot first and tells the page that data changed.
 */
import { EVENTS, emit } from "../constants/events";
import { V2_KEYS } from "../constants/storage-keys";
import type { PlayEvent } from "../types/play-event";
import { req, txDone } from "./idb";
import { ensureFirstRunSnapshot } from "./snapshot";
import { getV2Db, PLAY_EVENTS, playIndex } from "./v2-db";

const DEDUP_WINDOW_MS = 3000;

function markWritten(): void {
	try {
		localStorage.setItem(V2_KEYS.LAST_WRITE, String(Date.now()));
	} catch {
		// storage full; the event below still reaches an open page
	}
	emit(EVENTS.PLAY_RECORDED);
}

/** Last time anything wrote play history (any bundle). 0 if never. */
export function lastWriteAt(): number {
	try {
		return Number(localStorage.getItem(V2_KEYS.LAST_WRITE)) || 0;
	} catch {
		return 0;
	}
}

/**
 * Inserts a play unless the same track already has a row starting in the same
 * 3-second bucket (two listeners or a double event). Returns the id, or null
 * when it was a duplicate. Check and insert share one transaction.
 */
export async function addPlayEvent(event: PlayEvent): Promise<number | null> {
	await ensureFirstRunSnapshot();
	const db = await getV2Db();
	const tx = db.transaction(PLAY_EVENTS, "readwrite");
	const store = tx.objectStore(PLAY_EVENTS);
	const bucket = Math.floor(event.startedAt / DEDUP_WINDOW_MS) * DEDUP_WINDOW_MS;
	const nearby = (await req(
		playIndex(store, "startedAt").getAll(IDBKeyRange.bound(bucket, bucket + DEDUP_WINDOW_MS, false, true)),
	)) as PlayEvent[];
	let id: number | null = null;
	if (!nearby.some((e) => e.trackUri === event.trackUri)) {
		const { id: _drop, ...row } = event;
		id = (await req(store.add(row))) as number;
	}
	await txDone(tx);
	if (id !== null) markWritten();
	return id;
}

/** Final played time for a row written when it crossed the threshold. */
export async function updatePlaytime(id: number, playedMs: number, endedAt: number): Promise<void> {
	const db = await getV2Db();
	const tx = db.transaction(PLAY_EVENTS, "readwrite");
	const store = tx.objectStore(PLAY_EVENTS);
	const row = (await req(store.get(id))) as PlayEvent | undefined;
	if (row) store.put({ ...row, playedMs, endedAt });
	await txDone(tx);
	if (row) markWritten();
}

/** Inserts many rows in one transaction (imports). Callers dedup first. */
export async function bulkAddPlayEvents(events: PlayEvent[]): Promise<number> {
	if (events.length === 0) return 0;
	await ensureFirstRunSnapshot();
	const db = await getV2Db();
	const tx = db.transaction(PLAY_EVENTS, "readwrite");
	const store = tx.objectStore(PLAY_EVENTS);
	for (const e of events) {
		const { id: _drop, ...row } = e;
		store.add(row);
	}
	await txDone(tx);
	markWritten();
	return events.length;
}

/** Deletes all play history (the user asked to start over). Snapshot first, as for every write. */
export async function clearPlayEvents(): Promise<void> {
	await ensureFirstRunSnapshot();
	const db = await getV2Db();
	const tx = db.transaction(PLAY_EVENTS, "readwrite");
	tx.objectStore(PLAY_EVENTS).clear();
	await txDone(tx);
	markWritten();
}

export async function countPlayEvents(): Promise<number> {
	const db = await getV2Db();
	return req(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS).count());
}

/**
 * Reads rows with startedAt in [start, end) in chunks, each in its own short
 * transaction, and awaits `onChunk` between them. Yielding to the event loop
 * inside a transaction would auto-commit it, so the yield happens here,
 * between transactions.
 */
export async function forEachPlayEventChunk(
	start: number,
	end: number,
	onChunk: (rows: PlayEvent[]) => void | Promise<void>,
	chunkSize = 2000,
): Promise<void> {
	if (end <= start) return;
	const db = await getV2Db();
	let from = start;
	// ids already delivered at exactly `from`; rows sharing a timestamp can
	// straddle a chunk boundary
	let seenAtFrom = new Set<number>();
	for (;;) {
		const rows = (await req(
			playIndex(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS), "startedAt").getAll(
				IDBKeyRange.bound(from, end, false, true),
				chunkSize,
			),
		)) as PlayEvent[];
		const fresh = rows.filter((r) => !(r.startedAt === from && seenAtFrom.has(r.id as number)));
		if (fresh.length > 0) await onChunk(fresh);
		if (rows.length < chunkSize) return;
		const last = rows[rows.length - 1].startedAt;
		if (last === from && fresh.length === 0) {
			// A whole chunk shares one timestamp and we've seen it all: read that
			// timestamp in one go and move past it, or we'd loop forever.
			const same = (await req(
				playIndex(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS), "startedAt").getAll(IDBKeyRange.only(from)),
			)) as PlayEvent[];
			const rest = same.filter((r) => !seenAtFrom.has(r.id as number));
			if (rest.length > 0) await onChunk(rest);
			from += 1;
			seenAtFrom = new Set();
			continue;
		}
		if (last !== from) seenAtFrom = new Set();
		for (const r of rows) if (r.startedAt === last) seenAtFrom.add(r.id as number);
		from = last;
		await new Promise((r) => setTimeout(r, 0));
	}
}

/** Plays (not skips) of one track, optionally only those starting in [start, end). */
export async function countTrackPlays(trackUri: string, start = 0, end = Number.MAX_SAFE_INTEGER): Promise<number> {
	const db = await getV2Db();
	const rows = (await req(
		playIndex(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS), "trackUri").getAll(trackUri),
	)) as PlayEvent[];
	return rows.filter((r) => r.type !== "skip" && r.startedAt >= start && r.startedAt < end).length;
}

/** The newest `limit` rows, newest first. */
export async function recentPlayEvents(limit: number): Promise<PlayEvent[]> {
	const db = await getV2Db();
	const index = playIndex(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS), "startedAt");
	return new Promise((resolve, reject) => {
		const out: PlayEvent[] = [];
		const cur = index.openCursor(null, "prev");
		cur.onerror = () => reject(cur.error);
		cur.onsuccess = () => {
			const c = cur.result;
			if (!c || out.length >= limit) return resolve(out);
			out.push(c.value as PlayEvent);
			c.continue();
		};
	});
}

/** Every row, in startedAt order. For exports. */
export async function allPlayEvents(): Promise<PlayEvent[]> {
	const out: PlayEvent[] = [];
	await forEachPlayEventChunk(0, Number.MAX_SAFE_INTEGER, (rows) => {
		out.push(...rows);
	});
	return out;
}
