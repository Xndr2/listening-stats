import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	getActivityMode,
	getOverviewTilesForProvider,
	getSectionsForProvider,
} from "../app/capabilities";
import {
	COLUMN_IDS,
	getPreferences,
	OVERVIEW_CARD_IDS,
	SECTION_IDS,
	setPreference,
} from "../app/preferences";
import type { ProviderCapabilities } from "../shared/stats/provider";

const localCaps: ProviderCapabilities = {
	hasActivityData: true,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: true,
	hasSkipRate: true,
	tier: "n/a",
};

const statsfmFreeCaps: ProviderCapabilities = {
	hasActivityData: false,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "free",
};

const statsfmPlusCaps: ProviderCapabilities = {
	hasActivityData: false,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "plus",
};

describe("Preference migration/compat  -  capability section IDs match preference section IDs", () => {
	it("getSectionsForProvider returns IDs that are a subset of SECTION_IDS", () => {
		for (const caps of [localCaps, statsfmFreeCaps, statsfmPlusCaps]) {
			const sections = getSectionsForProvider(caps);
			for (const s of sections) {
				expect(SECTION_IDS as readonly string[]).toContain(s.id);
			}
		}
	});

	it("SECTION_IDS covers all IDs getSectionsForProvider can return", () => {
		const allIds = new Set<string>();
		for (const caps of [localCaps, statsfmFreeCaps, statsfmPlusCaps]) {
			for (const s of getSectionsForProvider(caps)) {
				allIds.add(s.id);
			}
		}
		for (const id of allIds) {
			expect(SECTION_IDS as readonly string[]).toContain(id);
		}
	});
});

describe("Preference migration/compat  -  capability tile IDs match preference overview IDs", () => {
	it("getOverviewTilesForProvider('local') returns IDs matching OVERVIEW_CARD_IDS.local", () => {
		const tiles = getOverviewTilesForProvider("local", localCaps);
		const tileIds = tiles.map((t) => t.id);
		expect(tileIds).toEqual([...OVERVIEW_CARD_IDS.local]);
	});

	it("getOverviewTilesForProvider('statsfm') returns IDs matching OVERVIEW_CARD_IDS.statsfm", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmPlusCaps);
		const tileIds = tiles.map((t) => t.id);
		expect(tileIds).toEqual([...OVERVIEW_CARD_IDS.statsfm]);
	});
});

describe("Preference migration/compat  -  pre-redesign preferences survive in redesigned UI", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("v2.4 prefs (no sectionOrder/columnOrder/overviewOrder) load with correct defaults", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({
				use24HourTime: true,
				itemsPerSection: 10,
				hiddenSections: ["activity"],
			}),
		);
		const prefs = getPreferences();
		expect(prefs.use24HourTime).toBe(true);
		expect(prefs.itemsPerSection).toBe(10);
		expect(prefs.hiddenSections).toEqual(["activity"]);
		expect(prefs.sectionOrder).toEqual([...SECTION_IDS]);
		expect(prefs.columnOrder).toEqual([...COLUMN_IDS]);
		expect(prefs.overviewOrder.local).toEqual([...OVERVIEW_CARD_IDS.local]);
		expect(prefs.overviewOrder.statsfm).toEqual([...OVERVIEW_CARD_IDS.statsfm]);
	});

	it("v2.5 prefs with custom sectionOrder survive redesign", () => {
		const customOrder = ["recently-played", "overview", "top-genres", "top-lists", "activity"];
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ sectionOrder: customOrder }),
		);
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual([...customOrder, "consistency"]);
	});

	it("v2.5 prefs with custom columnOrder survive redesign", () => {
		const customOrder = ["top-albums", "top-artists", "top-tracks"];
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ columnOrder: customOrder }),
		);
		const prefs = getPreferences();
		expect(prefs.columnOrder).toEqual(customOrder);
	});

	it("v2.5 prefs with hidden sections interact correctly with capability filtering", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-genres", "activity"] }),
		);
		const prefs = getPreferences();
		const localSections = getSectionsForProvider(localCaps);
		const visibleSections = prefs.sectionOrder.filter(
			(id) => !prefs.hiddenSections.includes(id) && localSections.some((s) => s.id === id),
		);
		expect(visibleSections).toContain("overview");
		expect(visibleSections).toContain("top-lists");
		expect(visibleSections).toContain("recently-played");
		expect(visibleSections).not.toContain("top-genres");
		expect(visibleSections).not.toContain("activity");
	});

	it("v2.5 prefs with custom overviewOrder survive redesign", () => {
		const customLocal = [
			"est-payout",
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
		];
		const customStatsfm = ["top-genre", "unique-artists", "new-artists", "est-payout"];
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ overviewOrder: { local: customLocal, statsfm: customStatsfm } }),
		);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual(customLocal);
		expect(prefs.overviewOrder.statsfm).toEqual(customStatsfm);
	});

	it("prefs written via setPreference then read back are stable across round-trip", () => {
		setPreference("sectionOrder", [
			"top-lists",
			"overview",
			"recently-played",
			"top-genres",
			"activity",
		]);
		setPreference("hiddenSections", ["overview"]);
		setPreference("use24HourTime", true);
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual([
			"top-lists",
			"overview",
			"recently-played",
			"top-genres",
			"activity",
			"consistency",
		]);
		expect(prefs.hiddenSections).toEqual(["overview"]);
		expect(prefs.use24HourTime).toBe(true);
		expect(prefs.overviewOrder.local).toEqual([...OVERVIEW_CARD_IDS.local]);
	});
});

describe("Preference migration/compat  -  capability + prefs integration for provider switching", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("switching from local to statsfm: overviewOrder.statsfm is independent of local", () => {
		const customLocal = [
			"skip-rate",
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"est-payout",
		];
		setPreference("overviewOrder", {
			local: customLocal,
			statsfm: [...OVERVIEW_CARD_IDS.statsfm],
		});
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual(customLocal);
		expect(prefs.overviewOrder.statsfm).toEqual([...OVERVIEW_CARD_IDS.statsfm]);
	});

	it("hidden section 'activity' still lets getActivityMode return the right mode per provider", () => {
		setPreference("hiddenSections", ["activity"]);
		expect(getActivityMode(localCaps)).toBe("full");
		expect(getActivityMode(statsfmFreeCaps)).toBe("hidden");
		expect(getActivityMode(statsfmPlusCaps)).toBe("hidden");
	});

	it("stats.fm free: sections filtered by capability combined with user hidden prefs produces coherent list", () => {
		setPreference("hiddenSections", ["top-genres"]);
		const prefs = getPreferences();
		const sections = getSectionsForProvider(statsfmFreeCaps);
		const sectionIds = new Set(sections.map((s) => s.id));
		const visible = prefs.sectionOrder.filter(
			(id) => sectionIds.has(id) && !prefs.hiddenSections.includes(id),
		);
		expect(visible).toContain("overview");
		expect(visible).toContain("top-lists");
		expect(visible).toContain("recently-played");
		expect(visible).not.toContain("top-genres");
		expect(visible).not.toContain("activity");
	});
});
