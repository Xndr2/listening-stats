import { LS_KEYS } from "../../shared/constants/storage-keys";

const DEFAULT_THRESHOLD_MS = 30_000; // default 30s play threshold (v1 used 10s)
const DEFAULT_THRESHOLD_PERCENT = 25;

export type ThresholdMode = "seconds" | "percent";

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
 * Clamps to 0-60000 and rounds to whole seconds.
 */
export function setPlayThreshold(ms: number): void {
	try {
		const clamped = Math.max(0, Math.min(60000, Math.round(ms / 1000) * 1000));
		localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, String(clamped));
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}

/**
 * Returns the play threshold as a percentage of track length (0-100 whole
 * percent), used when the threshold mode is "percent".
 */
export function getPlayThresholdPercent(): number {
	try {
		const stored = localStorage.getItem(LS_KEYS.PLAY_THRESHOLD_PERCENT);
		if (stored !== null) {
			const val = parseInt(stored, 10);
			if (!Number.isNaN(val) && val >= 0 && val <= 100) {
				return val;
			}
		}
	} catch {
		// localStorage unavailable  -  return default
	}
	return DEFAULT_THRESHOLD_PERCENT;
}

/**
 * Sets the percent play threshold. Clamps to 0-100 and rounds to whole percent.
 */
export function setPlayThresholdPercent(percent: number): void {
	try {
		const clamped = Math.max(0, Math.min(100, Math.round(percent)));
		localStorage.setItem(LS_KEYS.PLAY_THRESHOLD_PERCENT, String(clamped));
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}

/**
 * Returns the threshold mode: absolute seconds or percentage of track length.
 */
export function getThresholdMode(): ThresholdMode {
	try {
		return localStorage.getItem(LS_KEYS.PLAY_THRESHOLD_MODE) === "percent" ? "percent" : "seconds";
	} catch {
		return "seconds";
	}
}

export function setThresholdMode(mode: ThresholdMode): void {
	try {
		if (mode === "percent") {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD_MODE, "percent");
		} else {
			localStorage.removeItem(LS_KEYS.PLAY_THRESHOLD_MODE);
		}
	} catch {
		// localStorage unavailable  -  silently ignore
	}
}

/**
 * Resolves the effective play threshold in milliseconds for a track.
 * Percent mode needs the track duration; with an unknown duration the
 * threshold is unreachable (Infinity) and classification falls back to skip.
 */
export function resolveThresholdMs(durationMs: number): number {
	if (getThresholdMode() === "percent") {
		if (durationMs <= 0) return Number.POSITIVE_INFINITY;
		return Math.round((durationMs * getPlayThresholdPercent()) / 100);
	}
	return getPlayThreshold();
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
