interface CacheEntry {
	data: unknown;
	expiry: number;
}

export class ApiCache {
	private store = new Map<string, CacheEntry>();
	private ttlMs: number;

	constructor(ttlMs = 5 * 60 * 1000) {
		this.ttlMs = ttlMs;
	}

	get<T>(key: string): T | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiry) {
			// Keep entry for stale reads  -  do NOT delete yet
			return null;
		}
		return entry.data as T;
	}

	getStale<T>(key: string): T | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		return entry.data as T;
	}

	set<T>(key: string, data: T): void {
		this.store.set(key, { data, expiry: Date.now() + this.ttlMs });
	}

	invalidate(key?: string): void {
		if (key !== undefined) {
			this.store.delete(key);
		} else {
			this.store.clear();
		}
	}
}

export const apiCache = new ApiCache();
