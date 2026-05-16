import { beforeEach, describe, expect, it } from "vitest";
import { restorePeriodForProvider, safeParseProviderPeriods, savePeriodForProvider } from "../app/App";
import { LS_KEYS } from "../shared/constants/storage-keys";
import type { Period } from "../shared/types/stats";

const mockPeriods: Period[] = [
	{ id: "today", label: "Today", getBoundaries: () => ({ start: 0, end: 1 }) },
	{ id: "this-week", label: "This Week", getBoundaries: () => ({ start: 0, end: 1 }) },
	{ id: "this-month", label: "This Month", getBoundaries: () => ({ start: 0, end: 1 }) },
];

const mockSfmPeriods: Period[] = [
	{ id: "sfm-weeks", label: "This Week", getBoundaries: () => ({ start: 0, end: 1 }) },
	{ id: "sfm-months", label: "This Month", getBoundaries: () => ({ start: 0, end: 1 }) },
	{ id: "sfm-all-time", label: "All Time", getBoundaries: () => ({ start: 0, end: 1 }) },
];

beforeEach(() => {
	localStorage.clear();
});

describe("safeParseProviderPeriods", () => {
	it("returns empty object when localStorage has no PROVIDER_PERIODS key", () => {
		expect(safeParseProviderPeriods()).toEqual({});
	});

	it("returns parsed map when localStorage has valid JSON", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ local: "this-week", statsfm: "sfm-months" }));
		expect(safeParseProviderPeriods()).toEqual({ local: "this-week", statsfm: "sfm-months" });
	});

	it("returns empty object when localStorage has malformed JSON", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, "not json");
		expect(safeParseProviderPeriods()).toEqual({});
	});

	it("returns empty object when localStorage has JSON array", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify([1, 2]));
		expect(safeParseProviderPeriods()).toEqual({});
	});

	it("returns empty object when localStorage has JSON null", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify(null));
		expect(safeParseProviderPeriods()).toEqual({});
	});
});

describe("restorePeriodForProvider", () => {
	it("returns first period when no saved data exists (first visit)", () => {
		const result = restorePeriodForProvider("local", mockPeriods);
		expect(result).toBe(mockPeriods[0]);
	});

	it("returns saved period by id when saved map has matching entry", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ local: "this-week" }));
		const result = restorePeriodForProvider("local", mockPeriods);
		expect(result.id).toBe("this-week");
	});

	it("falls back to first supported period when saved id is not in supported list", () => {
		// sfm-today is not in mockSfmPeriods (free tier list)
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ statsfm: "sfm-today" }));
		const result = restorePeriodForProvider("statsfm", mockSfmPeriods);
		expect(result).toBe(mockSfmPeriods[0]);
	});

	it("falls back to first period when saved id is empty string", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ local: "" }));
		const result = restorePeriodForProvider("local", mockPeriods);
		expect(result).toBe(mockPeriods[0]);
	});

	it("restores correct period for each provider independently (switching providers test)", () => {
		localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify({ local: "this-month", statsfm: "sfm-weeks" }));
		const localResult = restorePeriodForProvider("local", mockPeriods);
		const sfmResult = restorePeriodForProvider("statsfm", mockSfmPeriods);
		expect(localResult.id).toBe("this-month");
		expect(sfmResult.id).toBe("sfm-weeks");
	});
});

describe("savePeriodForProvider", () => {
	it("writes single provider period to localStorage under PROVIDER_PERIODS key", () => {
		savePeriodForProvider("local", "this-week");
		const stored = JSON.parse(localStorage.getItem(LS_KEYS.PROVIDER_PERIODS)!);
		expect(stored).toEqual({ local: "this-week" });
	});

	it("merges multiple provider periods without overwriting others", () => {
		savePeriodForProvider("local", "this-week");
		savePeriodForProvider("statsfm", "sfm-months");
		const stored = JSON.parse(localStorage.getItem(LS_KEYS.PROVIDER_PERIODS)!);
		expect(stored).toEqual({ local: "this-week", statsfm: "sfm-months" });
	});
});
