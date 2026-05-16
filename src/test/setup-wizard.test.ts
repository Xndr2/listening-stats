import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Imports that will exist after Task 2 (GREEN phase)
import { buildCacheKey, buildProviderChangedState, markWizardSeen, shouldShowWizard } from "../app/App";
import { filterOverviewCards } from "../app/components/OverviewCards";
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

	it("buildCacheKey returns local-qualified key for local provider", () => {
		expect(buildCacheKey("local", "today")).toBe("local:today");
	});
});

// ─── Test Suite 2: OverviewCards card filtering ───────────────────────────────

const localCaps = {
	hasActivityData: true,
	hasGenreData: true,
	hasStreakData: true,
	hasSkipRate: false,
	tier: "n/a" as const,
};
const statsfmFreeCaps = {
	hasActivityData: false,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "free" as const,
};

describe("OverviewCards card filtering", () => {
	beforeEach(() => {
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	const allCards = [
		{ label: "Total Time", value: "10h", tooltip: "Total listening time" },
		{ label: "Tracks", value: "100", tooltip: "Total tracks played" },
		{ label: "Unique Artists", value: "50", tooltip: "Unique artists played" },
		{ label: "Peak Hour", value: "3 PM", tooltip: "Hour with most plays", localOnly: true },
		{ label: "Streak", value: "\u2014", tooltip: "Consecutive listening days" },
		{ label: "Skip Rate", value: "20%", tooltip: "Percentage of tracks skipped", localOnly: true },
		{ label: "Est. Payout", value: "$0.02", tooltip: "Estimated streaming payout" },
	];

	it("filterOverviewCards excludes Peak Hour and Skip Rate for non-local provider (capabilities.tier !== 'n/a')", () => {
		const filtered = filterOverviewCards(allCards, statsfmFreeCaps);
		expect(filtered).toHaveLength(5);
		const labels = filtered.map((c) => c.label);
		expect(labels).not.toContain("Peak Hour");
		expect(labels).not.toContain("Skip Rate");
	});

	it("filterOverviewCards returns all 7 cards for local provider (capabilities.tier === 'n/a')", () => {
		const filtered = filterOverviewCards(allCards, localCaps);
		expect(filtered).toHaveLength(7);
		const labels = filtered.map((c) => c.label);
		expect(labels).toContain("Peak Hour");
		expect(labels).toContain("Skip Rate");
	});
});

// ─── Test Suite 3: Wizard seen flag ──────────────────────────────────────────

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
