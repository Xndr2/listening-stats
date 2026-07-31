import { describe, expect, it } from "vitest";
import { type AppError, classifyHttpError } from "../shared/errors";

describe("classifyHttpError", () => {
	it("maps HTTP 404 to UserNotFound", () => {
		const err = classifyHttpError(404, "HTTP 404");
		expect(err.variant).toBe("UserNotFound");
		expect(err.retryable).toBe(false);
	});

	it("maps HTTP 429 to RateLimited", () => {
		const err = classifyHttpError(429, "HTTP 429");
		expect(err.variant).toBe("RateLimited");
		expect(err.retryable).toBe(false);
	});

	it("maps HTTP 500 to ServiceDown", () => {
		const err = classifyHttpError(500, "HTTP 500");
		expect(err.variant).toBe("ServiceDown");
		expect(err.retryable).toBe(true);
	});

	it("maps HTTP 502 to ServiceDown", () => {
		const err = classifyHttpError(502, "HTTP 502");
		expect(err.variant).toBe("ServiceDown");
	});

	it("maps HTTP 503 to ServiceDown", () => {
		const err = classifyHttpError(503, "HTTP 503");
		expect(err.variant).toBe("ServiceDown");
	});

	it("maps circuit-open message to RateLimited", () => {
		const err = classifyHttpError(0, "Circuit open  -  stats.fm temporarily unavailable");
		expect(err.variant).toBe("RateLimited");
		expect(err.retryable).toBe(false);
	});

	it("maps timeout to NetworkError", () => {
		const err = classifyHttpError(0, "Request timed out after 10s");
		expect(err.variant).toBe("NetworkError");
		expect(err.retryable).toBe(true);
	});

	it("maps generic status-0 to NetworkError", () => {
		const err = classifyHttpError(0, "TypeError: Failed to fetch");
		expect(err.variant).toBe("NetworkError");
		expect(err.retryable).toBe(true);
	});

	it("maps unrecognized HTTP status to Unknown", () => {
		const err = classifyHttpError(418, "HTTP 418");
		expect(err.variant).toBe("Unknown");
		expect(err.retryable).toBe(true);
	});

	it("preserves resetAt when provided", () => {
		const resetAt = Date.now() + 30_000;
		const err = classifyHttpError(0, "Circuit open  -  stats.fm temporarily unavailable", resetAt);
		expect(err.resetAt).toBe(resetAt);
	});

	it("omits resetAt when not provided", () => {
		const err = classifyHttpError(404, "HTTP 404");
		expect(err.resetAt).toBeUndefined();
	});
});

describe("AppError type", () => {
	it("has correct shape for all variants", () => {
		const variants: AppError["variant"][] = ["UserNotFound", "NetworkError", "ServiceDown", "RateLimited", "Unknown"];
		for (const variant of variants) {
			const err: AppError = { variant, message: "test", retryable: true };
			expect(err.variant).toBe(variant);
		}
	});
});
