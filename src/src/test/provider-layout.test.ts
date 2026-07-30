import { describe, expect, it } from "vitest";
import { getActivityMode, getOverviewTilesForProvider, getSectionsForProvider } from "../app/capabilities";
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

describe("Provider-specific layout  -  local provider renders a complete dashboard", () => {
	it("local provider includes all 6 sections", () => {
		const sections = getSectionsForProvider(localCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "consistency", "recently-played"]);
		expect(ids.length).toBe(6);
	});

	it("local provider has 7 overview tiles all available", () => {
		const tiles = getOverviewTilesForProvider("local", localCaps);
		expect(tiles.length).toBe(7);
		for (const t of tiles) {
			expect(t.available).toBe(true);
		}
		const ids = tiles.map((t) => t.id);
		expect(ids).toContain("peak-hour");
		expect(ids).toContain("skip-rate");
		expect(ids).not.toContain("top-genre");
	});

	it("local provider activity mode is 'full'", () => {
		expect(getActivityMode(localCaps)).toBe("full");
	});

	it("local dashboard has no dead sections  -  every section has a label", () => {
		const sections = getSectionsForProvider(localCaps);
		for (const s of sections) {
			expect(s.label.length).toBeGreaterThan(0);
		}
	});
});

describe("Provider-specific layout  -  stats.fm free renders a reduced but coherent dashboard", () => {
	it("stats.fm free includes activity section (activity data available)", () => {
		const sections = getSectionsForProvider(statsfmFreeCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toContain("activity");
		expect(ids).toContain("consistency");
		expect(ids.length).toBe(6);
	});

	it("stats.fm free keeps all sections including activity", () => {
		const sections = getSectionsForProvider(statsfmFreeCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "consistency", "recently-played"]);
	});

	it("stats.fm free tiles include top-genre instead of peak-hour", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmFreeCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).toContain("top-genre");
		expect(ids).not.toContain("peak-hour");
	});

	it("stats.fm free layout excludes streak and skip-rate", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmFreeCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).not.toContain("streak");
		expect(ids).not.toContain("skip-rate");
	});

	it("stats.fm free tiles that ARE available include unique-artists, new-artists, top-genre, est-payout (tracks in hero)", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmFreeCaps);
		const available = tiles.filter((t) => t.available).map((t) => t.id);
		expect(available).not.toContain("tracks");
		expect(available).toContain("unique-artists");
		expect(available).toContain("new-artists");
		expect(available).toContain("top-genre");
		expect(available).toContain("est-payout");
	});

	it("stats.fm free activity mode is 'full' (activity data available)", () => {
		expect(getActivityMode(statsfmFreeCaps)).toBe("full");
	});
});

describe("Provider-specific layout  -  stats.fm Plus renders a full dashboard with provider-specific tiles", () => {
	it("stats.fm Plus includes activity section (activity data available)", () => {
		const sections = getSectionsForProvider(statsfmPlusCaps);
		const ids = sections.map((s) => s.id);
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "consistency", "recently-played"]);
		expect(ids).toContain("activity");
	});

	it("stats.fm Plus activity mode is 'full'", () => {
		expect(getActivityMode(statsfmPlusCaps)).toBe("full");
	});

	it("stats.fm Plus tiles include top-genre (not peak-hour)", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmPlusCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).toContain("top-genre");
		expect(ids).not.toContain("peak-hour");
	});

	it("stats.fm Plus layout excludes streak and skip-rate", () => {
		const tiles = getOverviewTilesForProvider("statsfm", statsfmPlusCaps);
		const ids = tiles.map((t) => t.id);
		expect(ids).not.toContain("streak");
		expect(ids).not.toContain("skip-rate");
	});
});

describe("Provider-specific layout  -  coherence: no provider produces dead/empty sections", () => {
	const allCaps: Array<[string, string, ProviderCapabilities]> = [
		["local", "local", localCaps],
		["statsfm-free", "statsfm", statsfmFreeCaps],
		["statsfm-plus", "statsfm", statsfmPlusCaps],
	];

	for (const [label, providerId, caps] of allCaps) {
		it(`${label}: every section returned by getSectionsForProvider has an id and label`, () => {
			const sections = getSectionsForProvider(caps);
			for (const s of sections) {
				expect(s.id).toBeTruthy();
				expect(s.label).toBeTruthy();
			}
		});

		it(`${label}: every tile returned by getOverviewTilesForProvider has an id and label`, () => {
			const tiles = getOverviewTilesForProvider(providerId, caps);
			for (const t of tiles) {
				expect(t.id).toBeTruthy();
				expect(t.label).toBeTruthy();
			}
		});

		it(`${label}: tile count matches catalog (local=7, statsfm=4)`, () => {
			const tiles = getOverviewTilesForProvider(providerId, caps);
			const expected = providerId === "local" ? 7 : 4;
			expect(tiles.length).toBe(expected);
		});

		it(`${label}: overview section is always present`, () => {
			const sections = getSectionsForProvider(caps);
			expect(sections.map((s) => s.id)).toContain("overview");
		});

		it(`${label}: recently-played section is always present`, () => {
			const sections = getSectionsForProvider(caps);
			expect(sections.map((s) => s.id)).toContain("recently-played");
		});
	}
});
