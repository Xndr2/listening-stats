import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCache } from "../shared/api/api-cache";
import { CircuitBreaker } from "../shared/api/circuit-breaker";

// ─── Circuit Breaker Tests ─────────────────────────────────────────────────

describe("CircuitBreaker", () => {
	let cb: CircuitBreaker;

	beforeEach(() => {
		vi.useFakeTimers();
		cb = new CircuitBreaker();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts in closed state  -  isOpen() returns false", () => {
		expect(cb.isOpen()).toBe(false);
	});

	it("opens after 3 recordFailure() calls  -  isOpen() returns true", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(true);
	});

	it("stays closed after 2 recordFailure() calls  -  isOpen() returns false", () => {
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(false);
	});

	it("recordSuccess() resets failureCount to 0 and closes circuit", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordSuccess();
		expect(cb.isOpen()).toBe(false);
		// should not open after just 2 more (would need 3 fresh ones)
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(false);
	});

	it("transitions to half-open after 30s cooldown  -  isOpen() returns false", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(true);
		// advance 30 seconds
		vi.advanceTimersByTime(30_000);
		expect(cb.isOpen()).toBe(false); // half-open: allows probe
	});

	it("in half-open state, recordFailure() immediately reopens", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		vi.advanceTimersByTime(30_000);
		expect(cb.isOpen()).toBe(false); // half-open
		cb.recordFailure();
		expect(cb.isOpen()).toBe(true); // reopened
	});

	it("in half-open state, recordSuccess() closes the circuit", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		vi.advanceTimersByTime(30_000);
		cb.recordSuccess();
		expect(cb.isOpen()).toBe(false);
		// fresh failures now need to accumulate from 0 again
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(false);
	});

	it("reset() sets state to closed and failureCount to 0", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.isOpen()).toBe(true);
		cb.reset();
		expect(cb.isOpen()).toBe(false);
	});

	it("recordFailure(retryAfter=10) adds extra delay before half-open transition", () => {
		cb.recordFailure();
		cb.recordFailure();
		// final failure with retryAfter=10  -  cooldown becomes 30s + 10s = 40s
		cb.recordFailure(10);
		expect(cb.isOpen()).toBe(true);
		// after 30s still open (retryAfter extended cooldown)
		vi.advanceTimersByTime(30_000);
		expect(cb.isOpen()).toBe(true);
		// after 10 more seconds (total 40s), transitions to half-open
		vi.advanceTimersByTime(10_000);
		expect(cb.isOpen()).toBe(false);
	});

	it("getResetAt() returns null when circuit is closed", () => {
		expect(cb.getResetAt()).toBeNull();
	});

	it("getResetAt() returns future timestamp when circuit is open", () => {
		vi.setSystemTime(1000000);
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		const resetAt = cb.getResetAt();
		expect(resetAt).toBe(1000000 + 30_000);
	});

	it("getResetAt() includes retryAfter extension", () => {
		vi.setSystemTime(1000000);
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure(60);
		const resetAt = cb.getResetAt();
		expect(resetAt).toBe(1000000 + 30_000 + 60_000);
	});

	it("getResetAt() does not mutate circuit state", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.getState()).toBe("open");
		vi.advanceTimersByTime(30_000);
		// getResetAt should NOT trigger the open→half-open transition that isOpen() does
		cb.getResetAt();
		expect(cb.getState()).toBe("open");
		// contrast: isOpen() DOES trigger the transition
		cb.isOpen();
		expect(cb.getState()).toBe("half-open");
	});

	it("getResetAt() returns null in half-open state", () => {
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		vi.advanceTimersByTime(30_000);
		cb.isOpen(); // trigger half-open
		expect(cb.getResetAt()).toBeNull();
	});

	it("getState() returns current state string", () => {
		expect(cb.getState()).toBe("closed");
		cb.recordFailure();
		cb.recordFailure();
		cb.recordFailure();
		expect(cb.getState()).toBe("open");
		vi.advanceTimersByTime(30_000);
		cb.isOpen(); // trigger state transition check
		expect(cb.getState()).toBe("half-open");
		cb.recordSuccess();
		expect(cb.getState()).toBe("closed");
	});
});

// ─── API Cache Tests ────────────────────────────────────────────────────────

describe("ApiCache", () => {
	let cache: ApiCache;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new ApiCache();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("get() returns null for unknown key", () => {
		expect(cache.get("missing-key")).toBeNull();
	});

	it("set() then get() returns cached data within TTL", () => {
		cache.set("key1", { foo: "bar" });
		expect(cache.get("key1")).toEqual({ foo: "bar" });
	});

	it("get() returns null after TTL expires (5 min)", () => {
		cache.set("key1", { foo: "bar" });
		vi.advanceTimersByTime(5 * 60 * 1000 + 1);
		expect(cache.get("key1")).toBeNull();
	});

	it("invalidate(key) removes specific entry", () => {
		cache.set("key1", "data1");
		cache.set("key2", "data2");
		cache.invalidate("key1");
		expect(cache.get("key1")).toBeNull();
		expect(cache.get("key2")).toBe("data2");
	});

	it("invalidate() with no args clears all entries", () => {
		cache.set("key1", "data1");
		cache.set("key2", "data2");
		cache.invalidate();
		expect(cache.get("key1")).toBeNull();
		expect(cache.get("key2")).toBeNull();
	});
});
