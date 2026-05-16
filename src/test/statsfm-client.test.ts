import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { circuitBreaker } from "../shared/api/circuit-breaker";
import { type StatsFmHealthPayload, sfmCircuitBreaker, sfmGet, validateUsername } from "../shared/api/statsfm-client";

// Helper to build a fake fetch Response
function makeResponse(status: number, body: unknown = null): Response {
	const bodyStr = body !== null ? JSON.stringify(body) : null;
	return new Response(bodyStr, { status });
}

describe("sfmGet", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		sfmCircuitBreaker.reset();
		circuitBreaker.reset();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("calls window.fetch with URL starting https://api.stats.fm/api/v1, NOT CosmosAsync", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/users/test");
		expect(fetchMock).toHaveBeenCalled();
		const callUrl = fetchMock.mock.calls[0][0] as string;
		expect(callUrl).toContain("https://api.stats.fm/api/v1");
	});

	it("sfmGet with params builds correct URL query string", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { items: [] }));
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/top/tracks", { limit: "50" });
		const callUrl = fetchMock.mock.calls[0][0] as string;
		expect(callUrl).toContain("?limit=50");
	});

	it("sfmGet unwraps { item: T } wrapper", async () => {
		const user = { id: "1", customId: "testuser", displayName: "Test User" };
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: user }));
		vi.stubGlobal("fetch", fetchMock);
		const result = await sfmGet<typeof user>("/users/testuser");
		expect(result).toEqual({ ok: true, data: user });
	});

	it("sfmGet unwraps { items: T[] } wrapper", async () => {
		const tracks = [
			{ position: 1, streams: 100 },
			{ position: 2, streams: 50 },
		];
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { items: tracks }));
		vi.stubGlobal("fetch", fetchMock);
		const result = await sfmGet<typeof tracks>("/top/tracks");
		expect(result).toEqual({ ok: true, data: tracks });
	});

	it("circuit open -> returns { ok: false, status: 0, message containing 'Circuit open' } without calling fetch", async () => {
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		expect(sfmCircuitBreaker.isOpen()).toBe(true);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await sfmGet("/users/test");
		expect(result).toMatchObject({ ok: false, status: 0 });
		if (!result.ok) {
			expect(result.message).toContain("Circuit open");
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("HTTP 429 -> records failure on sfmCircuitBreaker, returns { ok: false, status: 429, message: 'HTTP 429' }", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(429));
		vi.stubGlobal("fetch", fetchMock);
		const spy = vi.spyOn(sfmCircuitBreaker, "recordFailure");
		const result = await sfmGet("/users/test");
		expect(result).toEqual({ ok: false, status: 429, message: "HTTP 429" });
		expect(spy).toHaveBeenCalled();
	});

	it("HTTP 500 -> records failure, returns { ok: false, status: 500, message: 'HTTP 500' }", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(500));
		vi.stubGlobal("fetch", fetchMock);
		const spy = vi.spyOn(sfmCircuitBreaker, "recordFailure");
		const result = await sfmGet("/users/test");
		expect(result).toEqual({ ok: false, status: 500, message: "HTTP 500" });
		expect(spy).toHaveBeenCalled();
	});

	it("HTTP 200 -> records success on sfmCircuitBreaker", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		const spy = vi.spyOn(sfmCircuitBreaker, "recordSuccess");
		await sfmGet("/users/test");
		expect(spy).toHaveBeenCalled();
	});

	it("network error (fetch rejects) -> records failure, returns { ok: false, status: 0, message containing error text }", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
		vi.stubGlobal("fetch", fetchMock);
		const spy = vi.spyOn(sfmCircuitBreaker, "recordFailure");
		const result = await sfmGet("/users/test");
		expect(result).toMatchObject({ ok: false, status: 0 });
		if (!result.ok) {
			expect(result.message).toContain("network failure");
		}
		expect(spy).toHaveBeenCalled();
	});

	it("AbortController timeout after 10s -> returns { ok: false, status: 0, message containing 'timed out' }", async () => {
		// Fetch mock that rejects with AbortError when the signal is aborted
		const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
			return new Promise<Response>((_resolve, reject) => {
				const signal = init?.signal;
				if (signal) {
					signal.addEventListener("abort", () => {
						const err = new DOMException("The user aborted a request.", "AbortError");
						reject(err);
					});
				}
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const resultPromise = sfmGet("/users/test");
		await vi.advanceTimersByTimeAsync(10_000);
		const result = await resultPromise;
		expect(result).toMatchObject({ ok: false, status: 0 });
		if (!result.ok) {
			expect(result.message.toLowerCase()).toContain("timed out");
		}
	});

	it("clearTimeout is called on success path (no dangling timers)", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
		await sfmGet("/users/test");
		expect(clearTimeoutSpy).toHaveBeenCalled();
	});

	it("tripping sfmCircuitBreaker 3 times does NOT change circuitBreaker singleton state (still 'closed')", async () => {
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		expect(sfmCircuitBreaker.isOpen()).toBe(true);
		expect(circuitBreaker.getState()).toBe("closed");
	});

	it("when LS_KEYS.LOGGING is 'true' in localStorage, console.debug is called with URL", async () => {
		localStorage.setItem("listening-stats:logging", "true");
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
		await sfmGet("/users/test");
		expect(debugSpy).toHaveBeenCalled();
		const callArgs = debugSpy.mock.calls[0];
		expect(callArgs.some((arg) => String(arg).includes("api.stats.fm"))).toBe(true);
		localStorage.removeItem("listening-stats:logging");
		debugSpy.mockRestore();
	});

	it("when LS_KEYS.LOGGING is not set, console.debug is NOT called", async () => {
		localStorage.removeItem("listening-stats:logging");
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
		await sfmGet("/users/test");
		expect(debugSpy).not.toHaveBeenCalled();
		debugSpy.mockRestore();
	});
});

describe("validateUsername", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		sfmCircuitBreaker.reset();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("success (200 with UserPublic) -> { valid: true, isPlus: true/false, displayName }", async () => {
		const user = {
			id: "123",
			customId: "testuser",
			displayName: "Test User",
			image: "",
			isPlus: true,
			isPro: false,
			privacySettings: {
				profile: true,
				currentlyPlaying: true,
				recentlyPlayed: true,
				topTracks: true,
				topArtists: true,
				topAlbums: true,
				topGenres: true,
				streams: true,
				streamStats: true,
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: user }));
		vi.stubGlobal("fetch", fetchMock);
		const result = await validateUsername("testuser");
		expect(result).toEqual({ valid: true, isPlus: true, displayName: "Test User" });
	});

	it("404 response -> { valid: false, reason: 'not_found' }", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(404));
		vi.stubGlobal("fetch", fetchMock);
		const result = await validateUsername("nonexistent");
		expect(result).toEqual({ valid: false, reason: "not_found" });
	});

	it("403 response -> { valid: false, reason: 'private' }", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(403));
		vi.stubGlobal("fetch", fetchMock);
		const result = await validateUsername("privateuser");
		expect(result).toEqual({ valid: false, reason: "private" });
	});

	it("network error -> { valid: false, reason: 'network' }", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
		vi.stubGlobal("fetch", fetchMock);
		const result = await validateUsername("testuser");
		expect(result).toEqual({ valid: false, reason: "network" });
	});

	it("circuit open -> { valid: false, reason: 'circuit_open' }", async () => {
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		expect(sfmCircuitBreaker.isOpen()).toBe(true);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await validateUsername("testuser");
		expect(result).toEqual({ valid: false, reason: "circuit_open" });
	});

	it("customId is URL-encoded in the path (e.g., 'my user' -> '/users/my%20user')", async () => {
		const user = {
			id: "456",
			customId: "my user",
			displayName: "My User",
			image: "",
			isPlus: false,
			isPro: false,
			privacySettings: {
				profile: true,
				currentlyPlaying: true,
				recentlyPlayed: true,
				topTracks: true,
				topArtists: true,
				topAlbums: true,
				topGenres: true,
				streams: true,
				streamStats: true,
			},
		};
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: user }));
		vi.stubGlobal("fetch", fetchMock);
		await validateUsername("my user");
		const callUrl = fetchMock.mock.calls[0][0] as string;
		expect(callUrl).toContain("/users/my%20user");
	});
});

describe("sfmGet health payload", () => {
	const HEALTH_KEY = "listening-stats:statsfm-health";
	const HEALTH_EVENT = "listening-stats:statsfm-health-changed";
	const FIXED_TS = 1700000000000;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_TS);
		sfmCircuitBreaker.reset();
		localStorage.clear();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	it("sfmGet HTTP 200 writes StatsFmHealthPayload with lastSuccessAt and lastFetchAt set, lastError null, circuitOpen false", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/users/test");
		const raw = localStorage.getItem(HEALTH_KEY);
		expect(raw).not.toBeNull();
		const payload = JSON.parse(raw!) as StatsFmHealthPayload;
		expect(payload.lastFetchAt).toBe(FIXED_TS);
		expect(payload.lastSuccessAt).toBe(FIXED_TS);
		expect(payload.lastError).toBeNull();
		expect(payload.circuitOpen).toBe(false);
	});

	it("sfmGet HTTP 200 dispatches STATSFM_HEALTH_CHANGED event with correct detail", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMock);
		const received: StatsFmHealthPayload[] = [];
		window.addEventListener(HEALTH_EVENT, (e) => {
			received.push((e as CustomEvent<StatsFmHealthPayload>).detail);
		});
		await sfmGet("/users/test");
		expect(received).toHaveLength(1);
		expect(received[0].lastSuccessAt).toBe(FIXED_TS);
		expect(received[0].lastError).toBeNull();
		expect(received[0].circuitOpen).toBe(false);
	});

	it("sfmGet HTTP 500 writes StatsFmHealthPayload with lastError 'HTTP 500'", async () => {
		const fetchMock = vi.fn().mockResolvedValue(makeResponse(500));
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/users/test");
		const raw = localStorage.getItem(HEALTH_KEY);
		expect(raw).not.toBeNull();
		const payload = JSON.parse(raw!) as StatsFmHealthPayload;
		expect(payload.lastFetchAt).toBe(FIXED_TS);
		expect(payload.lastError).toBe("HTTP 500");
	});

	it("sfmGet HTTP error preserves lastSuccessAt from previous successful call", async () => {
		// First: successful call writes lastSuccessAt = FIXED_TS
		const fetchMockSuccess = vi.fn().mockResolvedValue(makeResponse(200, { item: { id: "1" } }));
		vi.stubGlobal("fetch", fetchMockSuccess);
		await sfmGet("/users/test");

		// Advance time so timestamps differ
		vi.setSystemTime(FIXED_TS + 5000);

		// Second: failure call  -  must preserve lastSuccessAt from first call
		const fetchMockFailure = vi.fn().mockResolvedValue(makeResponse(500));
		vi.stubGlobal("fetch", fetchMockFailure);
		await sfmGet("/users/test");

		const raw = localStorage.getItem(HEALTH_KEY);
		expect(raw).not.toBeNull();
		const payload = JSON.parse(raw!) as StatsFmHealthPayload;
		expect(payload.lastSuccessAt).toBe(FIXED_TS); // preserved from first call
		expect(payload.lastFetchAt).toBe(FIXED_TS + 5000); // updated to new time
		expect(payload.lastError).toBe("HTTP 500");
	});

	it("sfmGet network error (fetch rejects) writes StatsFmHealthPayload with lastError containing error text", async () => {
		const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/users/test");
		const raw = localStorage.getItem(HEALTH_KEY);
		expect(raw).not.toBeNull();
		const payload = JSON.parse(raw!) as StatsFmHealthPayload;
		expect(payload.lastFetchAt).toBe(FIXED_TS);
		expect(payload.lastError).toContain("network down");
	});

	it("sfmGet circuit-open early return writes StatsFmHealthPayload with circuitOpen true and lastError containing 'Circuit open'", async () => {
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		expect(sfmCircuitBreaker.isOpen()).toBe(true);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await sfmGet("/users/test");
		const raw = localStorage.getItem(HEALTH_KEY);
		expect(raw).not.toBeNull();
		const payload = JSON.parse(raw!) as StatsFmHealthPayload;
		expect(payload.circuitOpen).toBe(true);
		expect(payload.lastError).toContain("Circuit open");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("sfmGet circuit-open dispatches STATSFM_HEALTH_CHANGED event", async () => {
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		sfmCircuitBreaker.recordFailure();
		expect(sfmCircuitBreaker.isOpen()).toBe(true);
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const received: StatsFmHealthPayload[] = [];
		window.addEventListener(HEALTH_EVENT, (e) => {
			received.push((e as CustomEvent<StatsFmHealthPayload>).detail);
		});
		await sfmGet("/users/test");
		expect(received).toHaveLength(1);
		expect(received[0].circuitOpen).toBe(true);
	});
});
