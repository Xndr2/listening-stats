import { lastfmProvider } from "./lastfm-provider";
import { localProvider } from "./local-provider";
import { providerRegistry } from "./provider";
import { statsfmProvider } from "./statsfm-provider";

/**
 * Legacy v1/v2 localStorage keys that are no longer used.
 * MUST NOT overlap with any value in LS_KEYS  -  see prune-obsolete-keys.test.ts overlap test.
 * Construct from raw string literals only; do NOT reference LS_KEYS values here.
 */
export const OBSOLETE_KEYS = [
	"listening-stats:card-order",
	"listening-stats:period",
	"listening-stats:sfm-promo-dismissed",
	"listening-stats:tour-seen",
	"listening-stats:tour-version",
	"listening-stats:lastUpdateCheck",
	"listening-stats:searchCache",
	"listening-stats:dedup-v2-done",
	"listening-stats:rateLimitedUntil",
	"listening-stats:lastfm",
	"listening-stats:pollingData",
] as const;

/** Internal flag  -  runs-once guard. Intentionally NOT in LS_KEYS (self-referential to prune). */
export const PRUN_DONE_KEY = "listening-stats:prun-v1-done";

export function pruneObsoleteKeys(): void {
	try {
		if (localStorage.getItem(PRUN_DONE_KEY) === "1") return; // already ran
		for (const key of OBSOLETE_KEYS) {
			localStorage.removeItem(key);
		}
		localStorage.setItem(PRUN_DONE_KEY, "1");
	} catch {
		// localStorage unavailable  -  silent failure, prune retried on next init
	}
}

let initialized = false;

export async function initProviders(): Promise<void> {
	if (initialized) return;
	initialized = true;

	pruneObsoleteKeys(); // once per install, before providers read localStorage

	providerRegistry.register(localProvider);
	providerRegistry.register(statsfmProvider);
	providerRegistry.register(lastfmProvider);
	providerRegistry.restoreActive();

	// Default to local if nothing saved or saved provider not found
	if (!providerRegistry.getActive()) {
		providerRegistry.setActive("local");
	}

	// Init all providers so switching doesn't hit uninitialized state
	await localProvider.init();
	await statsfmProvider.init();
	await lastfmProvider.init();
}

/** Reset initialization guard for testing only */
export function _resetInitGuard(): void {
	initialized = false;
}
