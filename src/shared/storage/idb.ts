/**
 * The few IndexedDB helpers the storage modules need. No library: Dexie would
 * add ~90 KB and v2 already hit "two Dexie copies" crashes with Marketplace.
 */

export function req<T>(r: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}

export function txDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
	});
}

/**
 * Opens a database. `version` undefined opens whatever exists (creating an
 * empty v1 DB if nothing does, so only pass undefined for a DB known to exist).
 */
export function openDb(
	name: string,
	version: number | undefined,
	upgrade?: (db: IDBDatabase, tx: IDBTransaction, oldVersion: number) => void,
): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const r = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
		r.onupgradeneeded = (e) => {
			if (upgrade && r.transaction) upgrade(r.result, r.transaction, e.oldVersion);
		};
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
		r.onblocked = () => reject(new Error(`Opening ${name} is blocked by another connection`));
	});
}

/** Native version of `name`, or null when it doesn't exist. */
export async function existingVersion(name: string): Promise<number | null> {
	const list = await indexedDB.databases();
	return list.find((d) => d.name === name)?.version ?? null;
}

/**
 * Runs `fn` while holding a lock shared by both bundles (page and extension
 * live in the same window). Falls back to running unlocked where Web Locks
 * don't exist (tests).
 */
export function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
	if (typeof navigator !== "undefined" && navigator.locks?.request) {
		return navigator.locks.request(name, fn) as Promise<T>;
	}
	return fn();
}

/** Memoises an opener and drops the handle when another tab upgrades the DB. */
export function lazyDb(open: () => Promise<IDBDatabase>): { get(): Promise<IDBDatabase>; reset(): void } {
	let pending: Promise<IDBDatabase> | null = null;
	return {
		get() {
			if (!pending) {
				pending = open().then((db) => {
					db.onversionchange = () => {
						db.close();
						pending = null;
					};
					db.onclose = () => {
						pending = null;
					};
					return db;
				});
				pending.catch(() => {
					pending = null;
				});
			}
			return pending;
		},
		reset() {
			pending?.then((db) => db.close()).catch(() => {});
			pending = null;
		},
	};
}
