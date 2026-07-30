import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCache } from "../shared/api/api-cache";
import { circuitBreaker } from "../shared/api/circuit-breaker";
import { cosmosGet } from "../shared/api/cosmos-async";

// Helper to build a fake CosmosAsync Response
function makeResponse(
	status: number,
	body: unknown = {},
	headers: Record<string, string> = {},
): Spicetify.CosmosAsync.Response {
	return { status, body, headers };
}

describe("cosmosGet", () => {
	let requestMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		// Reset singletons between tests
		circuitBreaker.reset();
		apiCache.invalidate();
		requestMock = vi.fn();
		Spicetify.CosmosAsync.request = requestMock as typeof Spicetify.CosmosAsync.request;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("successful 200 response returns { ok: true, data: body }", async () => {
		const body = { artist: "Radiohead" };
		requestMock.mockResolvedValueOnce(makeResponse(200, body));
		const result = await cosmosGet<{ artist: string }>("/v1/test");
		expect(result).toEqual({ ok: true, data: body });
	});

	it("429 response returns { ok: false, error: { type: 'rate_limited', retryAfter: N } } where N is from retry-after header", async () => {
		requestMock.mockResolvedValueOnce(makeResponse(429, {}, { "retry-after": "15" }));
		const result = await cosmosGet("/v1/test");
		expect(result).toEqual({ ok: false, error: { type: "rate_limited", retryAfter: 15 } });
	});

	it("429 with no retry-after header defaults retryAfter to 5", async () => {
		requestMock.mockResolvedValueOnce(makeResponse(429, {}, {}));
		const result = await cosmosGet("/v1/test");
		expect(result).toEqual({ ok: false, error: { type: "rate_limited", retryAfter: 5 } });
	});

	it("429 calls circuitBreaker.recordFailure(retryAfter)", async () => {
		const spy = vi.spyOn(circuitBreaker, "recordFailure");
		requestMock.mockResolvedValueOnce(makeResponse(429, {}, { "retry-after": "20" }));
		await cosmosGet("/v1/test");
		expect(spy).toHaveBeenCalledWith(20);
	});

	it("500 response returns { ok: false, error: { type: 'http_error', status: 500 } }", async () => {
		requestMock.mockResolvedValueOnce(makeResponse(500, {}));
		const result = await cosmosGet("/v1/test");
		expect(result).toEqual({ ok: false, error: { type: "http_error", status: 500 } });
	});

	it("network exception returns { ok: false, error: { type: 'network_error', message } }", async () => {
		requestMock.mockRejectedValueOnce(new Error("fetch failed"));
		const result = await cosmosGet("/v1/test");
		expect(result).toMatchObject({ ok: false, error: { type: "network_error" } });
		if (result.ok === false && result.error.type === "network_error") {
			expect(result.error.message).toContain("fetch failed");
		}
	});

	it("successful call records circuitBreaker.recordSuccess()", async () => {
		const spy = vi.spyOn(circuitBreaker, "recordSuccess");
		requestMock.mockResolvedValueOnce(makeResponse(200, { data: "ok" }));
		await cosmosGet("/v1/test");
		expect(spy).toHaveBeenCalled();
	});

	it("when circuit is open, returns stale cached data with { ok: true, stale: true }", async () => {
		// Pre-populate cache then expire it so get() returns null but getStale() still has data
		apiCache.set("/v1/stale-test", { artist: "Portishead" });
		// Advance past TTL so get() returns null (but entry remains for getStale)
		vi.advanceTimersByTime(5 * 60 * 1000 + 1);
		// Force open circuit
		circuitBreaker.recordFailure();
		circuitBreaker.recordFailure();
		circuitBreaker.recordFailure();
		expect(circuitBreaker.isOpen()).toBe(true);
		const result = await cosmosGet<{ artist: string }>("/v1/stale-test");
		expect(result).toEqual({ ok: true, data: { artist: "Portishead" }, stale: true });
		// Should NOT call request because circuit is open
		expect(requestMock).not.toHaveBeenCalled();
	});

	it("when circuit is open and no cache, returns { ok: false, error: { type: 'circuit_open' } }", async () => {
		circuitBreaker.recordFailure();
		circuitBreaker.recordFailure();
		circuitBreaker.recordFailure();
		const result = await cosmosGet("/v1/not-cached");
		expect(result).toEqual({ ok: false, error: { type: "circuit_open" } });
		expect(requestMock).not.toHaveBeenCalled();
	});

	it("successful response is stored in apiCache", async () => {
		const body = { genre: "trip-hop" };
		requestMock.mockResolvedValueOnce(makeResponse(200, body));
		await cosmosGet("/v1/cache-test");
		const cached = apiCache.get("/v1/cache-test");
		expect(cached).toEqual(body);
	});

	it("subsequent call within TTL returns cached data without calling CosmosAsync.request", async () => {
		const body = { cached: true };
		requestMock.mockResolvedValueOnce(makeResponse(200, body));
		await cosmosGet("/v1/cached-path");
		// Second call  -  should hit cache
		const result = await cosmosGet<{ cached: boolean }>("/v1/cached-path");
		expect(result).toEqual({ ok: true, data: body });
		expect(requestMock).toHaveBeenCalledTimes(1);
	});

	it("checks 'retry-after' header (lowercase)", async () => {
		requestMock.mockResolvedValueOnce(makeResponse(429, {}, { "retry-after": "30" }));
		const result = await cosmosGet("/v1/test");
		if (result.ok === false && result.error.type === "rate_limited") {
			expect(result.error.retryAfter).toBe(30);
		}
	});

	it("checks 'Retry-After' header (uppercase/capitalized)", async () => {
		requestMock.mockResolvedValueOnce(makeResponse(429, {}, { "Retry-After": "45" }));
		const result = await cosmosGet("/v1/test");
		if (result.ok === false && result.error.type === "rate_limited") {
			expect(result.error.retryAfter).toBe(45);
		}
	});
});
