import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeResponse(status: number, body: unknown = null): Response {
	const bodyStr = body !== null ? JSON.stringify(body) : null;
	return new Response(bodyStr, { status });
}

const LASTFM_RESPONSE = {
	tracks: {
		track: [
			{
				name: "Espresso",
				artist: { name: "Sabrina Carpenter" },
				playcount: "12400000",
				listeners: "500000",
			},
			{
				name: "Beautiful Things",
				artist: { name: "Benson Boone" },
				playcount: "9800000",
				listeners: "400000",
			},
		],
	},
};

function deleteDb(): Promise<void> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase("listening-stats-lastfm-cache");
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

beforeEach(async () => {
	localStorage.clear();
	vi.resetModules();
	await deleteDb();
});

afterEach(async () => {
	vi.unstubAllGlobals();
	localStorage.clear();
	await deleteDb();
});

describe("getCharts  -  mock mode", () => {
	it("returns WORLD_TRACKS when no API key is set", async () => {
		const { getCharts, WORLD_TRACKS } = await import("../app/world-charts-service");
		const tracks = getCharts("world", "today");
		if (tracks instanceof Promise) {
			const resolved = await tracks;
			expect(resolved).toEqual(WORLD_TRACKS);
		} else {
			expect(tracks).toEqual([...WORLD_TRACKS]);
		}
	});
});

describe("WORLD_ARTISTS mock data", () => {
	it("has at least 8 entries", async () => {
		const { WORLD_ARTISTS } = await import("../app/world-charts-service");
		expect(WORLD_ARTISTS.length).toBeGreaterThanOrEqual(8);
	});

	it("each entry has id, title, plays, delta fields", async () => {
		const { WORLD_ARTISTS } = await import("../app/world-charts-service");
		for (const a of WORLD_ARTISTS) {
			expect(typeof a.id).toBe("string");
			expect(typeof a.title).toBe("string");
			expect(typeof a.plays).toBe("string");
			expect(typeof a.delta).toBe("number");
		}
	});

	it("artist ids are unique", async () => {
		const { WORLD_ARTISTS } = await import("../app/world-charts-service");
		const ids = WORLD_ARTISTS.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("getArtistChartsAsync", () => {
	it("returns mock artists when no API key is set", async () => {
		const { getArtistChartsAsync, WORLD_ARTISTS } = await import("../app/world-charts-service");
		const result = await getArtistChartsAsync("world", "today");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual([...WORLD_ARTISTS]);
		}
	});
});

describe("getChartsAsync  -  real mode", () => {
	it("fetches from Last.fm API when API key is set", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, LASTFM_RESPONSE));
		vi.stubGlobal("fetch", fetchMock);

		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.LASTFM_API_KEY, "test-key");

		const { getChartsAsync } = await import("../app/world-charts-service");
		const result = await getChartsAsync("world", "today");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.length).toBe(2);
			expect(result.data[0].title).toBe("Espresso");
		}
	});

	it("returns cached data on second call within TTL", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, LASTFM_RESPONSE));
		vi.stubGlobal("fetch", fetchMock);

		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.LASTFM_API_KEY, "test-key");

		const { getChartsAsync } = await import("../app/world-charts-service");
		await getChartsAsync("world", "today");
		await getChartsAsync("world", "today");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns error result on API failure", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(403, { message: "Invalid API key" }));
		vi.stubGlobal("fetch", fetchMock);

		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.LASTFM_API_KEY, "bad-key");

		const { getChartsAsync } = await import("../app/world-charts-service");
		const result = await getChartsAsync("world", "today");
		expect(result.ok).toBe(false);
	});

	it("falls back to mock data when no API key", async () => {
		const { getChartsAsync, WORLD_TRACKS } = await import("../app/world-charts-service");
		const result = await getChartsAsync("world", "today");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual([...WORLD_TRACKS]);
		}
	});
});
