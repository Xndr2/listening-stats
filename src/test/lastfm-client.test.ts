import { afterEach, describe, expect, it, vi } from "vitest";

function makeResponse(status: number, body: unknown = null): Response {
	const bodyStr = body !== null ? JSON.stringify(body) : null;
	return new Response(bodyStr, { status });
}

afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
});

// ─── Endpoint mapping ───────────────────────────────────────────────────────

describe("lastfmGet  -  endpoint mapping", () => {
	it("calls chart.getTopTracks for scope 'world'", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { tracks: { track: [] } }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		await lastfmGetCharts("world", "today", "test-key");
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("method=chart.gettoptracks");
		expect(url).toContain("api_key=test-key");
		expect(url).toContain("format=json");
	});

	it("calls geo.getTopTracks with country=united+states for scope 'us'", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { tracks: { track: [] } }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		await lastfmGetCharts("us", "today", "test-key");
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("method=geo.gettoptracks");
		expect(url).toContain("country=united+states");
	});

	it("calls geo.getTopTracks with country=united+kingdom for scope 'gb'", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { tracks: { track: [] } }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		await lastfmGetCharts("gb", "today", "test-key");
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("country=united+kingdom");
	});

	it("calls geo.getTopTracks with country=japan for scope 'jp'", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { tracks: { track: [] } }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		await lastfmGetCharts("jp", "today", "test-key");
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("country=japan");
	});

	it("requests limit=50", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { tracks: { track: [] } }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		await lastfmGetCharts("world", "week", "test-key");
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toContain("limit=50");
	});
});

// ─── Response mapping ───────────────────────────────────────────────────────

describe("lastfmGetCharts  -  response mapping", () => {
	it("maps Last.fm track objects to WorldTrack[]", async () => {
		const body = {
			tracks: {
				track: [
					{
						name: "Espresso",
						artist: { name: "Sabrina Carpenter" },
						playcount: "12400000",
						listeners: "500000",
					},
				],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toHaveLength(1);
			expect(result.data[0].title).toBe("Espresso");
			expect(result.data[0].artist).toBe("Sabrina Carpenter");
			expect(result.data[0].plays).toBe("12.4M");
		}
	});

	it("maps geo response (different shape) to WorldTrack[]", async () => {
		const body = {
			tracks: {
				track: [
					{
						name: "Houdini",
						artist: { name: "Dua Lipa" },
						listeners: "300000",
					},
				],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("gb", "today", "test-key");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0].title).toBe("Houdini");
			expect(result.data[0].artist).toBe("Dua Lipa");
		}
	});

	it("generates stable ids from track name + artist", async () => {
		const body = {
			tracks: {
				track: [
					{ name: "A", artist: { name: "B" }, playcount: "100", listeners: "10" },
					{ name: "C", artist: { name: "D" }, playcount: "50", listeners: "5" },
				],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		if (result.ok) {
			expect(result.data[0].id).not.toBe(result.data[1].id);
			expect(typeof result.data[0].id).toBe("string");
		}
	});

	it("formats plays as human-readable (e.g. 12400000 → '12.4M')", async () => {
		const body = {
			tracks: {
				track: [
					{ name: "A", artist: { name: "B" }, playcount: "1500000", listeners: "100" },
					{ name: "C", artist: { name: "D" }, playcount: "950000", listeners: "50" },
					{ name: "E", artist: { name: "F" }, playcount: "1200", listeners: "10" },
				],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		if (result.ok) {
			expect(result.data[0].plays).toBe("1.5M");
			expect(result.data[1].plays).toBe("950K");
			expect(result.data[2].plays).toBe("1.2K");
		}
	});

	it("delta defaults to 0 (Last.fm does not provide rank change)", async () => {
		const body = {
			tracks: {
				track: [{ name: "A", artist: { name: "B" }, playcount: "100", listeners: "10" }],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		if (result.ok) {
			expect(result.data[0].delta).toBe(0);
		}
	});
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("lastfmGetCharts  -  error handling", () => {
	it("returns ok:false with status on HTTP error", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(403, { message: "Invalid API key" }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "bad-key");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(403);
		}
	});

	it("returns ok:false with status 0 on network error", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(0);
		}
	});

	it("returns empty tracks array for malformed response body", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { unexpected: true }));
		vi.stubGlobal("fetch", fetchMock);
		const { lastfmGetCharts } = await import("../shared/api/lastfm-client");
		const result = await lastfmGetCharts("world", "today", "test-key");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual([]);
		}
	});
});

// ─── Error classification ───────────────────────────────────────────────────

describe("classifyLastfmError", () => {
	it("classifies 403 as InvalidApiKey", async () => {
		const { classifyLastfmError } = await import("../shared/api/lastfm-client");
		const err = classifyLastfmError(403, "Invalid API key");
		expect(err.variant).toBe("InvalidApiKey");
		expect(err.retryable).toBe(false);
	});

	it("classifies 404 as Unknown (not UserNotFound  -  no user concept)", async () => {
		const { classifyLastfmError } = await import("../shared/api/lastfm-client");
		const err = classifyLastfmError(404, "Not found");
		expect(err.variant).toBe("Unknown");
	});

	it("classifies 429 as RateLimited", async () => {
		const { classifyLastfmError } = await import("../shared/api/lastfm-client");
		const err = classifyLastfmError(429, "Rate limit exceeded");
		expect(err.variant).toBe("RateLimited");
		expect(err.retryable).toBe(false);
	});

	it("classifies 5xx as ServiceDown", async () => {
		const { classifyLastfmError } = await import("../shared/api/lastfm-client");
		const err = classifyLastfmError(500, "Internal Server Error");
		expect(err.variant).toBe("ServiceDown");
		expect(err.retryable).toBe(true);
	});

	it("classifies network error (status 0) as NetworkError", async () => {
		const { classifyLastfmError } = await import("../shared/api/lastfm-client");
		const err = classifyLastfmError(0, "Failed to fetch");
		expect(err.variant).toBe("NetworkError");
		expect(err.retryable).toBe(true);
	});
});

// ─── API key validation ─────────────────────────────────────────────────────

describe("validateLastfmKey", () => {
	it("returns valid:true for a working API key", async () => {
		const body = {
			tracks: {
				track: [{ name: "A", artist: { name: "B" }, playcount: "100", listeners: "10" }],
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, body));
		vi.stubGlobal("fetch", fetchMock);
		const { validateLastfmKey } = await import("../shared/api/lastfm-client");
		const result = await validateLastfmKey("good-key");
		expect(result.valid).toBe(true);
	});

	it("returns valid:false reason:'invalid_key' for 403", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(403, { message: "Invalid API key" }));
		vi.stubGlobal("fetch", fetchMock);
		const { validateLastfmKey } = await import("../shared/api/lastfm-client");
		const result = await validateLastfmKey("bad-key");
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe("invalid_key");
	});

	it("returns valid:false reason:'network' for network failure", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
		vi.stubGlobal("fetch", fetchMock);
		const { validateLastfmKey } = await import("../shared/api/lastfm-client");
		const result = await validateLastfmKey("test-key");
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.reason).toBe("network");
	});
});
