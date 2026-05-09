import { LS_KEYS } from "../../shared/constants/storage-keys";

export const DEFAULT_THRESHOLD_MS = 30_000; // default 30s play threshold (v1 used 10s)

/**
 * Returns the configured play threshold in milliseconds.
 * Reads from localStorage, validates 0-60000 range, defaults to 30000ms.
 */
export function getPlayThreshold(): number {
	try {
		const stored = localStorage.getItem(LS_KEYS.PLAY_THRESHOLD);
		if (stored !== null) {
			const val = parseInt(stored, 10);
			if (!Number.isNaN(val) && val >= 0 && val <= 60000) {
				return val;
			}
		}
	} catch {
		// localStorage unavailable  -  return default
	}
	return DEFAULT_THRESHOLD_MS;
}

/**
 * Sets the play threshold in milliseconds.
 * Clamps value to 0-60000 range.
 */
export function setPlayThreshold(ms: number): void {
	try {
		const clamped = Math.max(0, Math.min(60000, ms));
		localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, String(clamped));
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}

/**
 * Returns true if tracking is currently paused.
 */
export function isTrackingPaused(): boolean {
	try {
		return localStorage.getItem(LS_KEYS.TRACKING_PAUSED) === "1";
	} catch {
		return false;
	}
}

/**
 * Sets or clears the tracking paused flag.
 */
export function setTrackingPaused(paused: boolean): void {
	try {
		if (paused) {
			localStorage.setItem(LS_KEYS.TRACKING_PAUSED, "1");
		} else {
			localStorage.removeItem(LS_KEYS.TRACKING_PAUSED);
		}
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}

/**
 * Returns true if skip-repeats mode is enabled.
 */
export function isSkipRepeatsEnabled(): boolean {
	try {
		return localStorage.getItem(LS_KEYS.SKIP_REPEATS) === "1";
	} catch {
		return false;
	}
}

/**
 * Enables or disables skip-repeats mode.
 */
export function setSkipRepeatsEnabled(enabled: boolean): void {
	try {
		if (enabled) {
			localStorage.setItem(LS_KEYS.SKIP_REPEATS, "1");
		} else {
			localStorage.removeItem(LS_KEYS.SKIP_REPEATS);
		}
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}
