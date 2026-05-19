import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeResponse(status: number, body: unknown = null): Response {
	const bodyStr = body !== null ? JSON.stringify(body) : null;
	return new Response(bodyStr, { status });
}

const SFM_TRACKS_RESPONSE = {
	items: [
		{
			position: 1,
			streams: 222,
			indicator: "NONE",
			track: {
				id: 12345,
				name: "Unit Test Track",
				artists: [{ name: "Unit Artist" }],
				albums: [{ image: "https://example.com/cover.jpg" }],
				externalIds: { spotify: ["unit-test-spotify"] },
			},
		},
	],
};

const SFM_ARTISTS_RESPONSE = {
	items: [
		{
			position: 1,
			streams: 999,
			indicator: "UP",
			artist: { name: "Top Artist", image: "https://example.com/a.jpg" },
		},
	],
};

beforeEach(() => {
	localStorage.clear();
	vi.resetModules();
});

afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
});

describe("getCharts (sync fallback)", () => {
	it("returns WORLD_TRACKS (10 entries)", async () => {
		const { getCharts, WORLD_TRACKS } = await import("../app/world-charts-service");
		expect(getCharts("world", "today")).toEqual([...WORLD_TRACKS]);
		expect(WORLD_TRACKS).toHaveLength(10);
	});
});

describe("getChartsAsync", () => {
	it("maps stats.fm chart payload", async () => {
		const fetchMock = vi.fn((url: string | URL) => {
			const u = url.toString();
			if (u.includes("/charts/top/tracks")) return Promise.resolve(makeResponse(200, SFM_TRACKS_RESPONSE));
			if (u.includes("mytopspotify")) return Promise.resolve(makeResponse(200, { data: [] }));
			return Promise.resolve(makeResponse(200, { item: { externalIds: { spotify: [] } } }));
		});
		vi.stubGlobal("fetch", fetchMock);

		const { getChartsAsync } = await import("../app/world-charts-service");
		const result = await getChartsAsync("world", "today");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].title).toBe("Unit Test Track");
			expect(result.data[0].artist).toBe("Unit Artist");
			expect(result.data[0].artUrl).toBe("https://example.com/cover.jpg");
			expect(result.data[0].delta).toBeNull();
			expect(result.source).toBe("statsfm");
		}
		expect(fetchMock).toHaveBeenCalled();
	});

	it("falls back to WORLD_TRACKS when fetch fails", async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(new Error("network"));
		vi.stubGlobal("fetch", fetchMock);

		const { getChartsAsync, WORLD_TRACKS } = await import("../app/world-charts-service");
		const result = await getChartsAsync("world", "today");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual([...WORLD_TRACKS]);
			expect(result.source).toBe("mock");
		}
	});
});

describe("getArtistChartsAsync", () => {
	it("maps stats.fm artist chart payload", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, SFM_ARTISTS_RESPONSE));
		vi.stubGlobal("fetch", fetchMock);

		const { getArtistChartsAsync } = await import("../app/world-charts-service");
		const result = await getArtistChartsAsync("world", "week");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].title).toBe("Top Artist");
			expect(result.data[0].delta).toBe(1);
		}
	});
});

describe("WORLD_ARTISTS mock data", () => {
	it("has at least 8 entries", async () => {
		const { WORLD_ARTISTS } = await import("../app/world-charts-service");
		expect(WORLD_ARTISTS.length).toBeGreaterThanOrEqual(8);
	});
});
