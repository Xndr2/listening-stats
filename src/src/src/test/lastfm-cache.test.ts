import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "listening-stats-lastfm-cache";

function deleteDb(): Promise<void> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase(DB_NAME);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

beforeEach(async () => {
	await deleteDb();
});

afterEach(async () => {
	vi.useRealTimers();
	await deleteDb();
});

describe("LastfmCache", () => {
	it("returns null for an uncached key", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(60_000);
		const result = await cache.get("world:today");
		expect(result).toBeNull();
	});

	it("stores and retrieves cached data", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(60_000);
		const data = [{ id: "1", title: "Test", artist: "Artist", country: "", plays: "1M", delta: 0 }];
		await cache.set("world:today", data);
		const result = await cache.get("world:today");
		expect(result).toEqual(data);
	});

	it("returns null for expired entries", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(1);
		const data = [{ id: "1", title: "Test", artist: "A", country: "", plays: "1M", delta: 0 }];
		await cache.set("world:today", data);
		await new Promise((r) => setTimeout(r, 10));
		const result = await cache.get("world:today");
		expect(result).toBeNull();
	});

	it("caches different keys independently", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(60_000);
		const dataA = [{ id: "1", title: "A", artist: "X", country: "", plays: "1M", delta: 0 }];
		const dataB = [{ id: "2", title: "B", artist: "Y", country: "", plays: "2M", delta: 0 }];
		await cache.set("world:today", dataA);
		await cache.set("us:week", dataB);
		expect(await cache.get("world:today")).toEqual(dataA);
		expect(await cache.get("us:week")).toEqual(dataB);
	});

	it("overwrites existing entry on set", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(60_000);
		const old = [{ id: "1", title: "Old", artist: "A", country: "", plays: "1M", delta: 0 }];
		const updated = [{ id: "2", title: "New", artist: "B", country: "", plays: "2M", delta: 0 }];
		await cache.set("world:today", old);
		await cache.set("world:today", updated);
		expect(await cache.get("world:today")).toEqual(updated);
	});

	it("invalidate clears all entries", async () => {
		const { LastfmCache } = await import("../shared/api/lastfm-cache");
		const cache = new LastfmCache(60_000);
		const data = [{ id: "1", title: "A", artist: "X", country: "", plays: "1M", delta: 0 }];
		await cache.set("world:today", data);
		await cache.set("us:week", data);
		await cache.invalidate();
		expect(await cache.get("world:today")).toBeNull();
		expect(await cache.get("us:week")).toBeNull();
	});

	it("cache key is scope+window combination", async () => {
		const { chartCacheKey, artistCacheKey } = await import("../shared/api/lastfm-cache");
		expect(chartCacheKey("world", "today")).toBe("tracks:world:today");
		expect(chartCacheKey("us", "week")).toBe("tracks:us:week");
		expect(chartCacheKey("gb", "today")).toBe("tracks:gb:today");
		expect(artistCacheKey("world", "today")).toBe("artists:world:today");
		expect(artistCacheKey("us", "week")).toBe("artists:us:week");
	});
});
