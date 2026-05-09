import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { OBSOLETE_KEYS, PRUN_DONE_KEY, pruneObsoleteKeys } from "../shared/stats/init-providers";

describe("pruneObsoleteKeys", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	describe("OBSOLETE_KEYS vs LS_KEYS overlap", () => {
		it("no entry in OBSOLETE_KEYS appears in LS_KEYS values", () => {
			const activeKeys = new Set<string>(Object.values(LS_KEYS));
			for (const key of OBSOLETE_KEYS) {
				expect(activeKeys.has(key), `OBSOLETE_KEYS contains active LS_KEY value: ${key}`).toBe(
					false,
				);
			}
		});

		it("PRUN_DONE_KEY itself is not in LS_KEYS values", () => {
			const activeKeys = new Set<string>(Object.values(LS_KEYS));
			expect(activeKeys.has(PRUN_DONE_KEY)).toBe(false);
		});

		it("OBSOLETE_KEYS contains the documented v1/v2 keys", () => {
			// Spot-check: the most-likely-stored v1 keys are present in the list.
			expect(OBSOLETE_KEYS).toContain("listening-stats:card-order");
			expect(OBSOLETE_KEYS).toContain("listening-stats:sfm-promo-dismissed");
			expect(OBSOLETE_KEYS).toContain("listening-stats:tour-seen");
			expect(OBSOLETE_KEYS).toContain("listening-stats:lastUpdateCheck"); // NOT lastUpdate
		});

		it("OBSOLETE_KEYS does NOT contain the active LAST_UPDATE key", () => {
			// Keep LAST_UPDATE active; prune list uses lastUpdateCheck instead
			expect(OBSOLETE_KEYS).not.toContain("listening-stats:lastUpdate");
		});
	});

	describe("first-run removal", () => {
		it("removes all OBSOLETE_KEYS from localStorage", () => {
			for (const key of OBSOLETE_KEYS) {
				localStorage.setItem(key, "stale-value");
			}
			pruneObsoleteKeys();
			for (const key of OBSOLETE_KEYS) {
				expect(localStorage.getItem(key)).toBeNull();
			}
		});

		it("does NOT remove active LS_KEYS values when they are set", () => {
			// Set a sample of active keys with realistic values
			localStorage.setItem(
				LS_KEYS.STATSFM_CONFIG,
				JSON.stringify({ username: "test", isPlus: true }),
			);
			localStorage.setItem(LS_KEYS.PREFERENCES, JSON.stringify({ use24HourTime: true }));
			localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, "statsfm");
			localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ statsfm: "sfm-weeks" }));

			pruneObsoleteKeys();

			expect(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)).not.toBeNull();
			expect(localStorage.getItem(LS_KEYS.PREFERENCES)).not.toBeNull();
			expect(localStorage.getItem(LS_KEYS.ACTIVE_PROVIDER)).toBe("statsfm");
			expect(localStorage.getItem(LS_KEYS.PROVIDER_PERIODS)).not.toBeNull();
		});

		it("sets PRUN_DONE_KEY to '1' after first successful run", () => {
			pruneObsoleteKeys();
			expect(localStorage.getItem(PRUN_DONE_KEY)).toBe("1");
		});
	});

	describe("idempotency via guard key", () => {
		it("is a no-op when PRUN_DONE_KEY is already set", () => {
			// Simulate prior run already complete
			localStorage.setItem(PRUN_DONE_KEY, "1");
			// Now write a value that WOULD be pruned if the function ran
			localStorage.setItem("listening-stats:card-order", "stale-after-prior-run");

			const removeSpy = vi.spyOn(Storage.prototype, "removeItem");
			pruneObsoleteKeys();

			// The guard short-circuits BEFORE any removeItem call
			expect(removeSpy).not.toHaveBeenCalled();
			// The would-be-pruned key is still there
			expect(localStorage.getItem("listening-stats:card-order")).toBe("stale-after-prior-run");
		});

		it("does not re-set PRUN_DONE_KEY on subsequent calls", () => {
			pruneObsoleteKeys(); // first run
			const setSpy = vi.spyOn(Storage.prototype, "setItem");
			pruneObsoleteKeys(); // second run
			expect(setSpy).not.toHaveBeenCalledWith(PRUN_DONE_KEY, "1");
		});
	});
});
