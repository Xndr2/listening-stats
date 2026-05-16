import { EVENTS } from "../constants/events";
import { LS_KEYS } from "../constants/storage-keys";
import type { SfmUserPublic } from "../types/statsfm";
import { CircuitBreaker } from "./circuit-breaker";

const BASE = "https://api.stats.fm/api/v1";

export type SfmResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export interface StatsFmConfig {
	username: string;
	isPlus: boolean;
	connectedAt: number; // Unix ms
	lastValidated: number; // Unix ms
}

export interface StatsFmHealthPayload {
	lastFetchAt: number | null;
	lastSuccessAt: number | null;
	lastError: string | null;
	circuitOpen: boolean;
}

export const sfmCircuitBreaker = new CircuitBreaker();

function readPreviousLastSuccessAt(): number | null {
	try {
		const raw = localStorage.getItem(LS_KEYS.STATSFM_HEALTH);
		if (raw) return (JSON.parse(raw) as StatsFmHealthPayload).lastSuccessAt;
	} catch {
		/* corrupted */
	}
	return null;
}

function publishSfmHealth(payload: StatsFmHealthPayload): void {
	try {
		localStorage.setItem(LS_KEYS.STATSFM_HEALTH, JSON.stringify(payload));
	} catch {
		/* storage full */
	}
	window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_HEALTH_CHANGED, { detail: payload }));
}

export async function sfmGet<T>(path: string, params?: Record<string, string>): Promise<SfmResult<T>> {
	if (sfmCircuitBreaker.isOpen()) {
		publishSfmHealth({
			lastFetchAt: Date.now(),
			lastSuccessAt: readPreviousLastSuccessAt(),
			lastError: "Circuit open  -  stats.fm temporarily unavailable",
			circuitOpen: true,
		});
		return { ok: false, status: 0, message: "Circuit open  -  stats.fm temporarily unavailable" };
	}

	const url = new URL(`${BASE}${path}`);
	if (params) {
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	}

	if (localStorage.getItem(LS_KEYS.LOGGING) === "true") {
		console.debug("[statsfm]", url.toString());
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10_000);

	try {
		const res = await fetch(url.toString(), {
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		if (!res.ok) {
			sfmCircuitBreaker.recordFailure();
			publishSfmHealth({
				lastFetchAt: Date.now(),
				lastSuccessAt: readPreviousLastSuccessAt(),
				lastError: `HTTP ${res.status}`,
				circuitOpen: sfmCircuitBreaker.isOpen(),
			});
			return { ok: false, status: res.status, message: `HTTP ${res.status}` };
		}

		const json = (await res.json()) as { item?: T; items?: T };
		sfmCircuitBreaker.recordSuccess();
		publishSfmHealth({
			lastFetchAt: Date.now(),
			lastSuccessAt: Date.now(),
			lastError: null,
			circuitOpen: false,
		});
		return { ok: true, data: (json.item ?? json.items) as T };
	} catch (err) {
		clearTimeout(timeoutId);
		sfmCircuitBreaker.recordFailure();
		const errorMessage =
			(err instanceof Error || err instanceof DOMException) && err.name === "AbortError"
				? "Request timed out after 10s"
				: String(err);
		publishSfmHealth({
			lastFetchAt: Date.now(),
			lastSuccessAt: readPreviousLastSuccessAt(),
			lastError: errorMessage,
			circuitOpen: sfmCircuitBreaker.isOpen(),
		});
		if ((err instanceof Error || err instanceof DOMException) && err.name === "AbortError") {
			return { ok: false, status: 0, message: "Request timed out after 10s" };
		}
		return { ok: false, status: 0, message: String(err) };
	}
}

export type ValidationResult =
	| { valid: true; isPlus: boolean; displayName: string }
	| { valid: false; reason: "not_found" | "private" | "network" | "circuit_open" };

export async function validateUsername(customId: string): Promise<ValidationResult> {
	const result = await sfmGet<SfmUserPublic>(`/users/${encodeURIComponent(customId)}`);
	if (result.ok) {
		return { valid: true, isPlus: result.data.isPlus, displayName: result.data.displayName };
	}
	if (result.status === 404) return { valid: false, reason: "not_found" };
	if (result.status === 403) return { valid: false, reason: "private" };
	if (result.status === 0 && result.message.includes("Circuit open")) {
		return { valid: false, reason: "circuit_open" };
	}
	return { valid: false, reason: "network" };
}
