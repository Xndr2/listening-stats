import type { WorldScope, WorldTrack, WorldWindow } from "../types/world-charts";

const DB_NAME = "listening-stats-lastfm-cache";
const STORE_NAME = "charts";
const DB_VERSION = 1;

interface CacheEntry {
	key: string;
	data: WorldTrack[];
	expiry: number;
}

export function chartCacheKey(scope: WorldScope, window: WorldWindow): string {
	return `tracks:${scope}:${window}`;
}

export function artistCacheKey(scope: WorldScope, window: WorldWindow): string {
	return `artists:${scope}:${window}`;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export class LastfmCache {
	private ttlMs: number;

	constructor(ttlMs = 10 * 60 * 1000) {
		this.ttlMs = ttlMs;
	}

	async get(key: string): Promise<WorldTrack[] | null> {
		try {
			const db = await openDb();
			const entry = await new Promise<CacheEntry | undefined>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readonly");
				const store = tx.objectStore(STORE_NAME);
				const req = store.get(key);
				req.onsuccess = () => resolve(req.result as CacheEntry | undefined);
				req.onerror = () => reject(req.error);
			});
			db.close();
			if (!entry) return null;
			if (Date.now() > entry.expiry) return null;
			return entry.data;
		} catch {
			return null;
		}
	}

	async set(key: string, data: WorldTrack[]): Promise<void> {
		try {
			const db = await openDb();
			const entry: CacheEntry = { key, data, expiry: Date.now() + this.ttlMs };
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				const req = store.put(entry);
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
			});
			db.close();
		} catch {
			// cache write failure is non-critical
		}
	}

	async invalidate(): Promise<void> {
		try {
			const db = await openDb();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				const req = store.clear();
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
			});
			db.close();
		} catch {
			// cache clear failure is non-critical
		}
	}

	async deleteDatabase(): Promise<void> {
		try {
			await new Promise<void>((resolve, reject) => {
				const req = indexedDB.deleteDatabase(DB_NAME);
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
				req.onblocked = () => resolve();
			});
		} catch {
			// database deletion failure is non-critical during wipe
		}
	}
}

export const lastfmCache = new LastfmCache();
