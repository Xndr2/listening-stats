import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_PERIODS, STATSFM_PERIODS, STATSFM_PERIODS_PLUS } from "../shared/stats/periods";

describe("STATSFM_PERIODS array", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0)); // April 1, 2026, 15:30 local
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("has exactly 3 entries", () => {
		expect(STATSFM_PERIODS).toHaveLength(3);
	});

	it("has ids: sfm-weeks, sfm-months, sfm-all-time", () => {
		const ids = STATSFM_PERIODS.map((p) => p.id);
		expect(ids).toEqual(["sfm-weeks", "sfm-months", "sfm-all-time"]);
	});

	it("each period has a non-empty label", () => {
		for (const period of STATSFM_PERIODS) {
			expect(period.label).toBeTruthy();
		}
	});

	it("sfm-weeks has label 'This Week'", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-weeks");
		expect(period).toBeDefined();
		expect(period?.label).toBe("This Week");
	});

	it("sfm-months has label 'This Month'", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-months");
		expect(period).toBeDefined();
		expect(period?.label).toBe("This Month");
	});

	it("sfm-all-time has label 'All Time'", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-all-time");
		expect(period).toBeDefined();
		expect(period?.label).toBe("All Time");
	});
});

describe("STATSFM_PERIODS_PLUS array", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("has exactly 4 entries", () => {
		expect(STATSFM_PERIODS_PLUS).toHaveLength(4);
	});

	it("has ids: sfm-today, sfm-weeks, sfm-months, sfm-all-time", () => {
		const ids = STATSFM_PERIODS_PLUS.map((p) => p.id);
		expect(ids).toEqual(["sfm-today", "sfm-weeks", "sfm-months", "sfm-all-time"]);
	});

	it("first entry is sfm-today", () => {
		expect(STATSFM_PERIODS_PLUS[0].id).toBe("sfm-today");
	});

	it("sfm-today has label 'Today'", () => {
		const period = STATSFM_PERIODS_PLUS.find((p) => p.id === "sfm-today");
		expect(period).toBeDefined();
		expect(period?.label).toBe("Today");
	});

	it("each period has a non-empty label", () => {
		for (const period of STATSFM_PERIODS_PLUS) {
			expect(period.label).toBeTruthy();
		}
	});
});

describe("sfm-weeks boundaries", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("at 2026-04-01 (Wednesday), start/end match LOCAL_PERIODS 'this-week' boundaries", () => {
		const sfmWeeks = STATSFM_PERIODS.find((p) => p.id === "sfm-weeks");
		const localWeek = LOCAL_PERIODS.find((p) => p.id === "this-week");
		expect(sfmWeeks).toBeDefined();
		expect(localWeek).toBeDefined();
		const sfmBounds = sfmWeeks!.getBoundaries();
		const localBounds = localWeek!.getBoundaries();
		expect(sfmBounds.start).toBe(localBounds.start);
		expect(sfmBounds.end).toBe(localBounds.end);
	});

	it("start is Monday 2026-03-30 midnight", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-weeks");
		expect(period).toBeDefined();
		const { start } = period!.getBoundaries();
		const startDate = new Date(start);
		expect(startDate.getFullYear()).toBe(2026);
		expect(startDate.getMonth()).toBe(2); // March = 2
		expect(startDate.getDate()).toBe(30);
		expect(startDate.getHours()).toBe(0);
		expect(startDate.getMinutes()).toBe(0);
	});
});

describe("sfm-months boundaries", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("start/end match LOCAL_PERIODS 'this-month' boundaries", () => {
		const sfmMonths = STATSFM_PERIODS.find((p) => p.id === "sfm-months");
		const localMonth = LOCAL_PERIODS.find((p) => p.id === "this-month");
		expect(sfmMonths).toBeDefined();
		expect(localMonth).toBeDefined();
		const sfmBounds = sfmMonths!.getBoundaries();
		const localBounds = localMonth!.getBoundaries();
		expect(sfmBounds.start).toBe(localBounds.start);
		expect(sfmBounds.end).toBe(localBounds.end);
	});

	it("at 2026-04-01, start is April 1 midnight, end is May 1 midnight", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-months");
		expect(period).toBeDefined();
		const { start, end } = period!.getBoundaries();
		const startDate = new Date(start);
		const endDate = new Date(end);
		expect(startDate.getMonth()).toBe(3); // April
		expect(startDate.getDate()).toBe(1);
		expect(startDate.getHours()).toBe(0);
		expect(endDate.getMonth()).toBe(4); // May
		expect(endDate.getDate()).toBe(1);
		expect(endDate.getHours()).toBe(0);
	});
});

describe("sfm-all-time boundaries", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("start is 0", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-all-time");
		expect(period).toBeDefined();
		const { start } = period!.getBoundaries();
		expect(start).toBe(0);
	});

	it("end is Number.MAX_SAFE_INTEGER", () => {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-all-time");
		expect(period).toBeDefined();
		const { end } = period!.getBoundaries();
		expect(end).toBe(Number.MAX_SAFE_INTEGER);
	});
});

describe("sfm-today boundaries", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("start/end match LOCAL_PERIODS 'today' boundaries", () => {
		const sfmToday = STATSFM_PERIODS_PLUS.find((p) => p.id === "sfm-today");
		const localToday = LOCAL_PERIODS.find((p) => p.id === "today");
		expect(sfmToday).toBeDefined();
		expect(localToday).toBeDefined();
		const sfmBounds = sfmToday!.getBoundaries();
		const localBounds = localToday!.getBoundaries();
		expect(sfmBounds.start).toBe(localBounds.start);
		expect(sfmBounds.end).toBe(localBounds.end);
	});

	it("start is midnight, end is next midnight", () => {
		const period = STATSFM_PERIODS_PLUS.find((p) => p.id === "sfm-today");
		expect(period).toBeDefined();
		const { start, end } = period!.getBoundaries();
		const startDate = new Date(start);
		expect(startDate.getHours()).toBe(0);
		expect(startDate.getMinutes()).toBe(0);
		expect(startDate.getSeconds()).toBe(0);
		expect(end - start).toBe(24 * 60 * 60 * 1000);
	});
});

describe("Non-regression: LOCAL_PERIODS unchanged", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("LOCAL_PERIODS still has exactly 5 entries", () => {
		expect(LOCAL_PERIODS).toHaveLength(5);
	});

	it("LOCAL_PERIODS ids are still: today, this-week, this-month, last-6-months, all-time", () => {
		const ids = LOCAL_PERIODS.map((p) => p.id);
		expect(ids).toEqual(["today", "this-week", "this-month", "last-6-months", "all-time"]);
	});

	it("each LOCAL_PERIODS entry has a non-empty label", () => {
		for (const period of LOCAL_PERIODS) {
			expect(period.label).toBeTruthy();
		}
	});
});
