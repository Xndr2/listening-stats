import { describe, expect, it } from "vitest";
import {
	getActivityMode,
	getOverviewTilesForProvider,
	getSectionsForProvider,
} from "../app/capabilities";
import type { ProviderCapabilities } from "../shared/stats/provider";

const localCaps: ProviderCapabilities = {
	hasActivityData: true,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: true,
	hasSkipRate: true,
	tier: "n/a",
};

const statsfmPlusCaps: ProviderCapabilities = {
	hasActivityData: true,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "plus",
};

const statsfmFreeCaps: ProviderCapabilities = {
	hasActivityData: true,
	hasConsistencyData: true,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "free",
};

describe("getSectionsForProvider", () => {
	it("returns all 6 sections for local provider", () => {
		const sections = getSectionsForProvider(localCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toEqual([
			"overview",
			"top-genres",
			"top-lists",
			"activity",
			"consistency",
			"recently-played",
		]);
	});

	it("includes activity section for stats.fm Plus (activity data available)", () => {
		const sections = getSectionsForProvider(statsfmPlusCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toContain("activity");
		expect(ids).toContain("consistency");
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "consistency", "recently-played"]);
	});

	it("includes activity section for stats.fm free tier (activity data available)", () => {
		const sections = getSectionsForProvider(statsfmFreeCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toContain("activity");
		expect(ids).toContain("consistency");
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "consistency", "recently-played"]);
	});

	it("excludes top-genres when hasGenreData is false", () => {
		const caps: ProviderCapabilities = { ...localCaps, hasGenreData: false };
		const sections = getSectionsForProvider(caps);
		const ids = sections.map((s) => s.id);
		expect(ids).not.toContain("top-genres");
	});

	it("each section has an id and label", () => {
		const sections = getSectionsForProvider(localCaps);
		for (const s of sections) {
			expect(s.id).toBeTruthy();
			expect(s.label).toBeTruthy();
		}
	});
});

describe("getOverviewTilesForProvider", () => {
	it("returns local tiles including peak-hour and skip-rate for local provider", () => {
		const tiles = getOverviewTilesForProvider("local", localCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).toContain("peak-hour");
		expect(ids).toContain("skip-rate");
		expect(ids).toContain("streak");
	});

	it("returns stats.fm tiles with top-genre instead of peak-hour", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmPlusCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).toContain("top-genre");
		expect(ids).not.toContain("peak-hour");
	});

	it("stats.fm tile catalog does not include streak tile", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmPlusCaps);
		const streak = tiles.find((t) => t.id === "streak");
		expect(streak).toBeUndefined();
	});

	it("stats.fm tile catalog excludes skip-rate without API data", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmFreeCaps);
		const skipRate = tiles.find((t) => t.id === "skip-rate");
		expect(skipRate).toBeUndefined();
	});

	it("marks all tiles as available for local provider", () => {
		const tiles = getOverviewTilesForProvider("local", localCaps);
		for (const t of tiles) {
			expect(t.available).toBe(true);
		}
	});

	it("always includes unique-artists, new-artists, est-payout; tracks only in local", () => {
		for (const providerId of ["local", "statsfm"] as const) {
			const caps = providerId === "local" ? localCaps : statsfmFreeCaps;
			const tiles = getOverviewTilesForProvider(providerId, caps);
			const ids = tiles.map((t) => t.id);
			expect(ids).toContain("unique-artists");
			expect(ids).toContain("new-artists");
			expect(ids).toContain("est-payout");
			if (providerId === "local") {
				expect(ids).toContain("tracks");
			} else {
				expect(ids).not.toContain("tracks");
			}
		}
	});
});

describe("getActivityMode", () => {
	it("returns 'full' for local provider (tier n/a)", () => {
		expect(getActivityMode(localCaps)).toBe("full");
	});

	it("returns 'full' for stats.fm Plus with activity data", () => {
		expect(getActivityMode(statsfmPlusCaps)).toBe("full");
	});

	it("returns 'full' for stats.fm free tier with activity data", () => {
		expect(getActivityMode(statsfmFreeCaps)).toBe("full");
	});

	it("returns 'hidden' when activity section is not applicable", () => {
		const noActivityCaps: ProviderCapabilities = {
			...statsfmFreeCaps,
			tier: "free",
			hasActivityData: false,
		};
		expect(getActivityMode(noActivityCaps)).toBe("hidden");
	});
});
