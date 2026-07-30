import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Imports that will exist after Task 2 (GREEN phase)
import { buildCacheKey, buildProviderChangedState, markWizardSeen, shouldShowWizard } from "../app/App";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { providerRegistry } from "../shared/stats/provider";

// ─── Test Suite 1: Provider-qualified cacheKey ────────────────────────────────

describe("Provider-qualified cacheKey", () => {
	beforeEach(() => {
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("buildCacheKey returns provider-qualified key for statsfm provider", () => {
		expect(buildCacheKey("statsfm", "sfm-weeks")).toBe("statsfm:sfm-weeks");
	});

	it("buildCacheKey returns local-qualified key including rank mode for local provider", () => {
		expect(buildCacheKey("local", "today")).toBe("local:today:streams");
	});
});

describe("Wizard seen flag", () => {
	beforeEach(() => {
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("shouldShowWizard returns true when PROVIDER_WIZARD_SEEN is absent", () => {
		// localStorage is clear so PROVIDER_WIZARD_SEEN is not set
		expect(localStorage.getItem(LS_KEYS.PROVIDER_WIZARD_SEEN)).toBeNull();
		expect(shouldShowWizard()).toBe(true);
	});

	it("shouldShowWizard returns false when PROVIDER_WIZARD_SEEN is '1'", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_WIZARD_SEEN, "1");
		expect(shouldShowWizard()).toBe(false);
	});

	it("markWizardSeen writes PROVIDER_WIZARD_SEEN to localStorage", () => {
		markWizardSeen();
		expect(localStorage.getItem(LS_KEYS.PROVIDER_WIZARD_SEEN)).toBe("1");
	});
});

// ─── Test Suite 4: Wizard completion handler ─────────────────────────────────

describe("Wizard completion handler", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("markWizardSeen writes flag and shouldShowWizard returns false after", () => {
		expect(shouldShowWizard()).toBe(true);
		markWizardSeen();
		expect(shouldShowWizard()).toBe(false);
		expect(localStorage.getItem(LS_KEYS.PROVIDER_WIZARD_SEEN)).toBe("1");
	});
});

// ─── Test Suite 5: PROVIDER_CHANGED handler activeProviderId update ───────────

describe("PROVIDER_CHANGED handler activeProviderId update", () => {
	beforeEach(() => {
		localStorage.clear();
		providerRegistry._resetForTesting();
		// Register both providers so setActive doesn't throw
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.setActive("local");
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("buildProviderChangedState returns correct state after switching to statsfm", () => {
		providerRegistry.setActive("statsfm");
		const state = buildProviderChangedState(providerRegistry);
		expect(state.activeProviderId).toBe("statsfm");
		expect(state.isLocalProvider).toBe(false);
	});
});
