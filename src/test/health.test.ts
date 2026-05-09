import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthPayload } from "../extension/tracker/health";
import { HealthIndicator } from "../extension/tracker/health";

describe("HealthIndicator", () => {
	let health: HealthIndicator;
	let dispatchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
		dispatchSpy = vi.spyOn(window, "dispatchEvent");
		health = new HealthIndicator();
	});

	describe("recordSuccess", () => {
		it("sets healthy=true, lastWriteAt to current timestamp", () => {
			const before = Date.now();
			health.recordSuccess("Test Track");
			const after = Date.now();
			const state = health.getHealth();
			expect(state.healthy).toBe(true);
			expect(state.lastWriteAt).toBeGreaterThanOrEqual(before);
			expect(state.lastWriteAt).toBeLessThanOrEqual(after);
		});

		it("sets lastTrackName to provided track name", () => {
			health.recordSuccess("My Song");
			expect(health.getHealth().lastTrackName).toBe("My Song");
		});

		it("sets errorCount=0", () => {
			health.recordSuccess("Track");
			expect(health.getHealth().errorCount).toBe(0);
		});

		it("resets errorCount to 0 after previous failure", () => {
			health.recordFailure("error 1");
			health.recordFailure("error 2");
			expect(health.getHealth().errorCount).toBe(2);
			health.recordSuccess("Track");
			expect(health.getHealth().errorCount).toBe(0);
		});

		it("sets lastError to null on success", () => {
			health.recordFailure("some error");
			health.recordSuccess("Track");
			expect(health.getHealth().lastError).toBeNull();
		});
	});

	describe("recordFailure", () => {
		it("sets healthy=false", () => {
			health.recordFailure("write failed");
			expect(health.getHealth().healthy).toBe(false);
		});

		it("increments errorCount by 1", () => {
			health.recordFailure("err");
			expect(health.getHealth().errorCount).toBe(1);
		});

		it("increments errorCount on each call", () => {
			health.recordFailure("err1");
			health.recordFailure("err2");
			health.recordFailure("err3");
			expect(health.getHealth().errorCount).toBe(3);
		});

		it("sets lastError to the error message", () => {
			health.recordFailure("IndexedDB quota exceeded");
			expect(health.getHealth().lastError).toBe("IndexedDB quota exceeded");
		});
	});

	describe("localStorage publishing", () => {
		it("writes valid JSON with healthy=true to tracking-health key after recordSuccess", () => {
			health.recordSuccess("My Track");
			const raw = localStorage.getItem("listening-stats:tracking-health");
			expect(raw).not.toBeNull();
			if (raw === null) return;
			const parsed = JSON.parse(raw) as HealthPayload;
			expect(parsed.healthy).toBe(true);
			expect(parsed.lastTrackName).toBe("My Track");
		});

		it("writes healthy=false and lastError after recordFailure", () => {
			health.recordFailure("write error");
			const raw = localStorage.getItem("listening-stats:tracking-health");
			expect(raw).not.toBeNull();
			if (raw === null) return;
			const parsed = JSON.parse(raw) as HealthPayload;
			expect(parsed.healthy).toBe(false);
			expect(parsed.lastError).toBe("write error");
		});
	});

	describe("CustomEvent publishing", () => {
		it("dispatches health-changed event after recordSuccess with detail.healthy=true", () => {
			health.recordSuccess("Track");
			const calls = dispatchSpy.mock.calls;
			const healthEvent = calls.find(
				(c: [Event]) =>
					c[0] instanceof CustomEvent && c[0].type === "listening-stats:health-changed",
			);
			expect(healthEvent).toBeDefined();
			const event = healthEvent?.[0] as CustomEvent | undefined;
			expect(event?.detail.healthy).toBe(true);
		});

		it("dispatches health-changed event after recordFailure with detail.healthy=false", () => {
			health.recordFailure("error");
			const calls = dispatchSpy.mock.calls;
			const healthEvent = calls.find(
				(c: [Event]) =>
					c[0] instanceof CustomEvent && c[0].type === "listening-stats:health-changed",
			);
			expect(healthEvent).toBeDefined();
			const event = healthEvent?.[0] as CustomEvent | undefined;
			expect(event?.detail.healthy).toBe(false);
		});
	});

	describe("getHealth", () => {
		it("returns a snapshot of current state", () => {
			const state = health.getHealth();
			expect(state).toEqual({
				healthy: true,
				lastWriteAt: null,
				lastTrackName: null,
				errorCount: 0,
				lastError: null,
			});
		});

		it("returns a copy  -  mutating the result does not affect internal state", () => {
			const state = health.getHealth();
			state.healthy = false;
			expect(health.getHealth().healthy).toBe(true);
		});

		it("does not crash when localStorage has corrupt health key", () => {
			localStorage.setItem("listening-stats:tracking-health", "not-valid-json{{{");
			// getHealth reads from memory, not localStorage  -  should not crash
			expect(() => health.getHealth()).not.toThrow();
			expect(health.getHealth().healthy).toBe(true);
		});
	});
});
