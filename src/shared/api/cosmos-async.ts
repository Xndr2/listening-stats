import type { ApiError, Result } from "../types/stats";
import { apiCache } from "./api-cache";
import { circuitBreaker } from "./circuit-breaker";

export async function cosmosGet<T>(path: string): Promise<Result<T, ApiError>> {
	// Check cache first (fast path  -  no circuit check needed)
	const cached = apiCache.get<T>(path);
	if (cached !== null) {
		return { ok: true, data: cached };
	}

	if (circuitBreaker.isOpen()) {
		const stale = apiCache.getStale<T>(path);
		if (stale !== null) {
			return { ok: true, data: stale, stale: true };
		}
		return { ok: false, error: { type: "circuit_open" } };
	}

	try {
		const response = await Spicetify.CosmosAsync.request("GET", path);

		if (response.status === 429) {
			const retryAfterRaw =
				response.headers?.["retry-after"] ?? response.headers?.["Retry-After"] ?? "5";
			const retryAfter = Number(retryAfterRaw) || 5;
			circuitBreaker.recordFailure(retryAfter);
			return { ok: false, error: { type: "rate_limited", retryAfter } };
		}

		if (response.status < 200 || response.status >= 300) {
			circuitBreaker.recordFailure();
			return { ok: false, error: { type: "http_error", status: response.status } };
		}

		circuitBreaker.recordSuccess();
		const data = response.body as T;
		apiCache.set(path, data);
		return { ok: true, data };
	} catch (err) {
		circuitBreaker.recordFailure();
		return { ok: false, error: { type: "network_error", message: String(err) } };
	}
}
