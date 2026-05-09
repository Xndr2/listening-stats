import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	COLUMN_IDS,
	getPreferences,
	normalizeHiddenSections,
	OVERVIEW_CARD_IDS,
	OVERVIEW_CARD_LABELS,
	SECTION_IDS,
	setPreference,
} from "../app/preferences";
import { EVENTS } from "../shared/constants/events";
import { statsCache } from "../shared/stats/stats-cache";

describe("preferences", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe("getPreferences", () => {
		it("returns defaults when localStorage is empty", () => {
			const prefs = getPreferences();
			expect(prefs.use24HourTime).toBe(false);
			expect(prefs.itemsPerSection).toBe(5);
			expect(prefs.hiddenSections).toEqual([]);
			expect(prefs.playCountVariant).toBe("pill");
			expect(prefs.receiveBetaUpdates).toBe(false);
			expect(prefs.showAnnouncementBanner).toBe(true);
			expect(prefs.announcementBannerHiddenForDismissKey).toBe("");
		});

		it("merges partial saved data with defaults", () => {
			localStorage.setItem("listening-stats:preferences", JSON.stringify({ use24HourTime: true }));
			const prefs = getPreferences();
			expect(prefs.use24HourTime).toBe(true);
			expect(prefs.itemsPerSection).toBe(5); // default preserved
			expect(prefs.hiddenSections).toEqual([]); // default preserved
		});

		it("returns defaults for corrupted JSON in localStorage", () => {
			localStorage.setItem("listening-stats:preferences", "not-valid-json{{{");
			const prefs = getPreferences();
			expect(prefs.use24HourTime).toBe(false);
			expect(prefs.itemsPerSection).toBe(5);
		});
	});

	describe("setPreference", () => {
		it("persists use24HourTime and is retrievable via getPreferences", () => {
			setPreference("use24HourTime", true);
			expect(getPreferences().use24HourTime).toBe(true);
		});

		it("persists itemsPerSection and is retrievable", () => {
			setPreference("itemsPerSection", 10);
			expect(getPreferences().itemsPerSection).toBe(10);
		});

		it("persists hiddenSections array and is retrievable", () => {
			setPreference("hiddenSections", ["overview", "genres"]);
			expect(getPreferences().hiddenSections).toEqual(["overview", "genres"]);
		});

		it("persists receiveBetaUpdates and is retrievable", () => {
			setPreference("receiveBetaUpdates", true);
			expect(getPreferences().receiveBetaUpdates).toBe(true);
		});

		it("persists showAnnouncementBanner and announcementBannerHiddenForDismissKey", () => {
			setPreference("showAnnouncementBanner", false);
			setPreference("announcementBannerHiddenForDismissKey", "remote:abc");
			const prefs = getPreferences();
			expect(prefs.showAnnouncementBanner).toBe(false);
			expect(prefs.announcementBannerHiddenForDismissKey).toBe("remote:abc");
		});

		it("preserves other preferences when setting one key", () => {
			setPreference("use24HourTime", true);
			setPreference("itemsPerSection", 3);
			const prefs = getPreferences();
			expect(prefs.use24HourTime).toBe(true);
			expect(prefs.itemsPerSection).toBe(3);
			expect(prefs.hiddenSections).toEqual([]);
		});
	});

	describe("playCountVariant preference", () => {
		it("defaults to 'pill' when localStorage is empty", () => {
			expect(getPreferences().playCountVariant).toBe("pill");
		});

		it("persists playCountVariant via setPreference and round-trips", () => {
			setPreference("playCountVariant", "bubble");
			expect(getPreferences().playCountVariant).toBe("bubble");
		});

		it("persists 'minimal' variant", () => {
			setPreference("playCountVariant", "minimal");
			expect(getPreferences().playCountVariant).toBe("minimal");
		});

		it("backfills playCountVariant default for pre-Phase-39 stored JSON", () => {
			localStorage.setItem(
				"listening-stats:preferences",
				JSON.stringify({ use24HourTime: true, itemsPerSection: 10 }),
			);
			const prefs = getPreferences();
			expect(prefs.playCountVariant).toBe("pill");
		});

		it("preserves playCountVariant when setting an unrelated preference", () => {
			setPreference("playCountVariant", "bubble");
			setPreference("use24HourTime", true);
			const prefs = getPreferences();
			expect(prefs.playCountVariant).toBe("bubble");
			expect(prefs.use24HourTime).toBe(true);
		});
	});

	describe("stats.fm overview card ids", () => {
		it("SFMC-01: OVERVIEW_CARD_IDS.statsfm canonical order (4 IDs  -  no streak/skip-rate)", () => {
			expect(OVERVIEW_CARD_IDS.statsfm).toEqual([
				"unique-artists",
				"new-artists",
				"top-genre",
				"est-payout",
			]);
		});

		it("SFMC-01: OVERVIEW_CARD_IDS.statsfm contains est-payout (locked decision D-SFMC-01: retained)", () => {
			expect(OVERVIEW_CARD_IDS.statsfm).toContain("est-payout");
		});

		it("SFMC-01: OVERVIEW_CARD_IDS.statsfm replaces listening-days slot (no longer in canonical)", () => {
			expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("listening-days");
		});

		it("OVERVIEW_CARD_IDS.statsfm excludes streak", () => {
			expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("streak");
		});

		it("OVERVIEW_CARD_IDS.statsfm excludes skip-rate", () => {
			expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("skip-rate");
		});

		it("SFMC-01: OVERVIEW_CARD_LABELS['top-genre'] === 'Top Genre'", () => {
			expect(OVERVIEW_CARD_LABELS["top-genre"]).toBe("Top Genre");
		});

		it("SFMC-01: existing user with stored listening-days has it dropped and missing canonical IDs appended on getPreferences()", () => {
			localStorage.setItem(
				"listening-stats:preferences",
				JSON.stringify({
					overviewOrder: {
						local: ["tracks", "unique-artists", "streak", "skip-rate"],
						statsfm: ["unique-artists", "listening-days", "est-payout"],
					},
				}),
			);
			const prefs = getPreferences();
			expect(prefs.overviewOrder.statsfm).toEqual([
				"unique-artists",
				"est-payout",
				"new-artists",
				"top-genre",
			]);
			expect(prefs.overviewOrder.statsfm).not.toContain("listening-days");
			expect(prefs.overviewOrder.statsfm).not.toContain("streak");
			expect(prefs.overviewOrder.statsfm).not.toContain("skip-rate");
		});
	});
});

describe("preferences  -  v2.5 sectionOrder/columnOrder", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("returns canonical sectionOrder default on fresh install", () => {
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual([
			"overview",
			"top-genres",
			"top-lists",
			"activity",
			"consistency",
			"recently-played",
		]);
		expect(prefs.sectionOrder).toEqual([...SECTION_IDS]);
	});

	it("returns canonical columnOrder default on fresh install", () => {
		const prefs = getPreferences();
		expect(prefs.columnOrder).toEqual(["top-tracks", "top-artists", "top-albums"]);
		expect(prefs.columnOrder).toEqual([...COLUMN_IDS]);
	});

	it("backfills sectionOrder and columnOrder defaults for v2.4-shape stored JSON", () => {
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
	});

	it("does not throw when stored JSON is missing sectionOrder/columnOrder", () => {
		localStorage.setItem("listening-stats:preferences", JSON.stringify({}));
		expect(() => getPreferences()).not.toThrow();
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual([...SECTION_IDS]);
		expect(prefs.columnOrder).toEqual([...COLUMN_IDS]);
	});

	it("persists sectionOrder via setPreference and round-trips", () => {
		const custom = [
			"recently-played",
			"overview",
			"top-lists",
			"activity",
			"top-genres",
			"consistency",
		];
		setPreference("sectionOrder", custom);
		expect(getPreferences().sectionOrder).toEqual(custom);
	});

	it("persists columnOrder via setPreference and round-trips", () => {
		const custom = ["top-albums", "top-tracks", "top-artists"];
		setPreference("columnOrder", custom);
		expect(getPreferences().columnOrder).toEqual(custom);
	});

	it("preserves sectionOrder when setting an unrelated preference", () => {
		const custom = [
			"top-lists",
			"overview",
			"top-genres",
			"activity",
			"consistency",
			"recently-played",
		];
		setPreference("sectionOrder", custom);
		setPreference("use24HourTime", true);
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual(custom);
		expect(prefs.use24HourTime).toBe(true);
	});

	it("returns full defaults including sectionOrder/columnOrder for corrupted JSON", () => {
		localStorage.setItem("listening-stats:preferences", "not-valid-json{{{");
		const prefs = getPreferences();
		expect(prefs.sectionOrder).toEqual([...SECTION_IDS]);
		expect(prefs.columnOrder).toEqual([...COLUMN_IDS]);
	});

	it("does not leak consumer-side mutations back into DEFAULTS", () => {
		const a = getPreferences();
		a.sectionOrder.push("mutation-marker");
		const b = getPreferences();
		expect(b.sectionOrder).not.toContain("mutation-marker");
		expect(b.sectionOrder).toEqual([...SECTION_IDS]);
	});
});

describe("PREFS_CHANGED event  -  v2.5", () => {
	beforeEach(() => {
		localStorage.clear();
		statsCache.invalidate();
	});

	afterEach(() => {
		localStorage.clear();
		statsCache.invalidate();
		vi.restoreAllMocks();
	});

	it("EVENTS.PREFS_CHANGED exists and uses the listening-stats namespace", () => {
		expect(EVENTS.PREFS_CHANGED).toBe("listening-stats:prefs-changed");
	});

	it("dispatching PREFS_CHANGED does not invalidate statsCache", () => {
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");
		statsCache.setupInvalidationListeners();
		statsCache.set("local:all-time", { marker: "still-here" });

		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));

		expect(invalidateSpy).not.toHaveBeenCalled();
		expect(statsCache.get("local:all-time")).toEqual({ marker: "still-here" });
	});
});

describe("preferences hiddenSections normalization", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("PASSES THROUGH stored hiddenSections ['top-tracks'] unchanged (no collapse to ['top-lists'])", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-tracks"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["top-tracks"]);
	});

	it("PASSES THROUGH stored hiddenSections ['top-artists'] unchanged", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-artists"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["top-artists"]);
	});

	it("PASSES THROUGH stored hiddenSections ['top-albums'] unchanged", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-albums"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["top-albums"]);
	});

	it("allows coarse + fine to coexist: ['top-lists','top-tracks'] stays ['top-lists','top-tracks']", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-lists", "top-tracks"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["top-lists", "top-tracks"]);
	});

	it("dedupes duplicate entries: ['top-tracks','top-tracks','top-artists'] → ['top-tracks','top-artists']", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-tracks", "top-tracks", "top-artists"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["top-tracks", "top-artists"]);
	});

	it("preserves non-legacy entries alongside fine ids: ['overview','top-tracks','activity'] → ['overview','top-tracks','activity']", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["overview", "top-tracks", "activity"] }),
		);
		expect(getPreferences().hiddenSections).toEqual(["overview", "top-tracks", "activity"]);
	});

	it("is idempotent on already-normalized list", () => {
		const input = ["top-lists", "top-tracks"];
		expect(normalizeHiddenSections(normalizeHiddenSections(input))).toEqual(
			normalizeHiddenSections(input),
		);
	});

	it("does NOT write to localStorage on read", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ hiddenSections: ["top-tracks"] }),
		);
		// Read multiple times
		getPreferences();
		getPreferences();
		// Raw storage unchanged  -  normalization is pure, no eager persist
		const raw = JSON.parse(localStorage.getItem("listening-stats:preferences") as string);
		expect(raw.hiddenSections).toEqual(["top-tracks"]);
	});
});

describe("preferences overviewOrder", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("returns canonical overviewOrder.local default on fresh install", () => {
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual([...OVERVIEW_CARD_IDS.local]);
	});

	it("returns canonical overviewOrder.statsfm default on fresh install", () => {
		const prefs = getPreferences();
		expect(prefs.overviewOrder.statsfm).toEqual([...OVERVIEW_CARD_IDS.statsfm]);
	});

	it("backfills overviewOrder for v2.4-shape stored JSON lacking the key", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ use24HourTime: true, itemsPerSection: 10 }),
		);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual([...OVERVIEW_CARD_IDS.local]);
		expect(prefs.overviewOrder.statsfm).toEqual([...OVERVIEW_CARD_IDS.statsfm]);
	});

	it("persists overviewOrder via setPreference and round-trips", () => {
		const custom = {
			local: [
				"skip-rate",
				"tracks",
				"unique-artists",
				"streak",
				"new-artists",
				"peak-hour",
				"est-payout",
			],
			statsfm: ["est-payout", "unique-artists", "new-artists", "top-genre"],
		};
		setPreference("overviewOrder", custom);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual(custom.local);
		expect(prefs.overviewOrder.statsfm).toEqual(custom.statsfm);
	});

	it("setPreference overviewOrder preserves both provider arrays", () => {
		const next = {
			local: [
				"streak",
				"skip-rate",
				"tracks",
				"unique-artists",
				"new-artists",
				"peak-hour",
				"est-payout",
			],
			statsfm: ["top-genre", "est-payout", "unique-artists", "new-artists"],
		};
		setPreference("overviewOrder", next);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual(next.local);
		expect(prefs.overviewOrder.statsfm).toEqual(next.statsfm);
	});

	it("reconciles stored overviewOrder.local against the seven-tile catalog", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({
				overviewOrder: {
					local: ["tracks", "unknown-card"],
					statsfm: [...OVERVIEW_CARD_IDS.statsfm],
				},
			}),
		);
		const prefs = getPreferences();
		// "unknown-card" dropped, remaining canonical ids appended in canonical order
		expect(prefs.overviewOrder.local).toEqual([
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
			"est-payout",
		]);
	});

	it("reconciles overviewOrder.statsfm independently from local order", () => {
		const customLocal = [
			"skip-rate",
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"est-payout",
		];
		const customStatsfm = ["est-payout", "unique-artists", "new-artists", "top-genre"];
		setPreference("overviewOrder", { local: customLocal, statsfm: customStatsfm });
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual(customLocal);
		expect(prefs.overviewOrder.statsfm).toEqual(customStatsfm);
	});

	it("consumer mutation on overviewOrder.local does not leak into DEFAULTS", () => {
		const a = getPreferences();
		a.overviewOrder.local.push("mutation-marker");
		const b = getPreferences();
		expect(b.overviewOrder.local).not.toContain("mutation-marker");
		expect(b.overviewOrder.local).toEqual([...OVERVIEW_CARD_IDS.local]);
	});

	it("OVERVIEW_CARD_IDS.local has seven entries in canonical order", () => {
		expect(OVERVIEW_CARD_IDS.local).toEqual([
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
			"est-payout",
		]);
		expect(OVERVIEW_CARD_IDS.local.length).toBe(7);
	});

	it("OVERVIEW_CARD_IDS.statsfm has four canonical tiles", () => {
		expect(OVERVIEW_CARD_IDS.statsfm).toEqual([
			"unique-artists",
			"new-artists",
			"top-genre",
			"est-payout",
		]);
		expect(OVERVIEW_CARD_IDS.statsfm.length).toBe(4);
		expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("peak-hour");
		expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("tracks");
		expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("streak");
		expect(OVERVIEW_CARD_IDS.statsfm).not.toContain("skip-rate");
	});

	it("OVERVIEW_CARD_LABELS includes New Artists and Peak Hour labels", () => {
		expect(OVERVIEW_CARD_LABELS["new-artists"]).toBe("New Artists");
		expect(OVERVIEW_CARD_LABELS["peak-hour"]).toBe("Peak Hour");
	});

	it("legacy four-tile local orders grow to seven tiles with canonical append", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({
				overviewOrder: {
					local: ["tracks", "unique-artists", "streak", "skip-rate"],
					statsfm: ["tracks", "unique-artists", "top-genre", "est-payout"],
				},
			}),
		);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.local).toEqual([
			"tracks",
			"unique-artists",
			"streak",
			"skip-rate",
			"new-artists",
			"peak-hour",
			"est-payout",
		]);
		expect(prefs.overviewOrder.local.length).toBe(7);
	});

	it("legacy three-tile stats.fm orders grow to four canonical tiles", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({
				overviewOrder: {
					local: ["tracks", "unique-artists", "streak", "skip-rate"],
					statsfm: ["unique-artists", "top-genre", "est-payout"],
				},
			}),
		);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.statsfm).toEqual([
			"unique-artists",
			"top-genre",
			"est-payout",
			"new-artists",
		]);
		expect(prefs.overviewOrder.statsfm.length).toBe(4);
	});

	it("legacy six-tile stats.fm orders drop unsupported streak/skip-rate ids", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({
				overviewOrder: {
					local: [...OVERVIEW_CARD_IDS.local],
					statsfm: [
						"unique-artists",
						"new-artists",
						"top-genre",
						"est-payout",
						"streak",
						"skip-rate",
					],
				},
			}),
		);
		const prefs = getPreferences();
		expect(prefs.overviewOrder.statsfm).toEqual([
			"unique-artists",
			"new-artists",
			"top-genre",
			"est-payout",
		]);
		expect(prefs.overviewOrder.statsfm).not.toContain("streak");
		expect(prefs.overviewOrder.statsfm).not.toContain("skip-rate");
	});
});

describe("preferences order reconciliation", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("sectionOrder: drops unknown ids from stored", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ sectionOrder: ["overview", "foo", "top-lists"] }),
		);
		const prefs = getPreferences();
		expect(prefs.sectionOrder).not.toContain("foo");
		expect(prefs.sectionOrder).toContain("overview");
		expect(prefs.sectionOrder).toContain("top-lists");
	});

	it("sectionOrder: appends missing canonical ids at end in canonical order", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ sectionOrder: ["overview", "top-lists"] }),
		);
		const prefs = getPreferences();
		// stored order preserved for known ids, missing ones appended in canonical order
		expect(prefs.sectionOrder).toEqual([
			"overview",
			"top-lists",
			"top-genres",
			"activity",
			"consistency",
			"recently-played",
		]);
	});

	it("columnOrder: drops unknown ids and appends missing canonical ids", () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ columnOrder: ["top-albums", "mystery-column"] }),
		);
		const prefs = getPreferences();
		expect(prefs.columnOrder).not.toContain("mystery-column");
		expect(prefs.columnOrder).toEqual(["top-albums", "top-tracks", "top-artists"]);
	});
});
