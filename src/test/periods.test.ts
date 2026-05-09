import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_PERIODS, getAdjacentPeriod, getPriorPeriodBoundaries } from "../shared/stats/periods";
import type { Period } from "../shared/types/stats";

describe("Period boundary functions", () => {
	beforeEach(() => {
		// Freeze time to 2026-04-01T15:30:00 local time
		// Using a date string that vitest/jsdom will interpret in local timezone
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 1, 15, 30, 0, 0)); // Month is 0-indexed: 3 = April
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("getTodayBoundaries (via LOCAL_PERIODS[0])", () => {
		it("start has hours=0, minutes=0, seconds=0 at 15:30 local", () => {
			const period = LOCAL_PERIODS.find((p) => p.id === "today");
			expect(period).toBeDefined();
			const { start } = period!.getBoundaries();
			const startDate = new Date(start);
			expect(startDate.getHours()).toBe(0);
			expect(startDate.getMinutes()).toBe(0);
			expect(startDate.getSeconds()).toBe(0);
			expect(startDate.getMilliseconds()).toBe(0);
		});

		it("end is exactly start + 24 hours (next midnight)", () => {
			const period = LOCAL_PERIODS.find((p) => p.id === "today");
			const { start, end } = period!.getBoundaries();
			expect(end - start).toBe(24 * 60 * 60 * 1000);
		});
	});

	describe("getThisWeekBoundaries (via LOCAL_PERIODS[1])", () => {
		it("at Wednesday 2026-04-01 → start is Monday 2026-03-30 midnight", () => {
			// 2026-04-01 is a Wednesday
			const period = LOCAL_PERIODS.find((p) => p.id === "this-week");
			const { start } = period!.getBoundaries();
			const startDate = new Date(start);
			expect(startDate.getFullYear()).toBe(2026);
			expect(startDate.getMonth()).toBe(2); // March = 2
			expect(startDate.getDate()).toBe(30);
			expect(startDate.getHours()).toBe(0);
			expect(startDate.getMinutes()).toBe(0);
		});

		it("at Monday 2026-03-30 → start is Monday 2026-03-30 midnight", () => {
			vi.setSystemTime(new Date(2026, 2, 30, 9, 0, 0, 0)); // Monday March 30
			const period = LOCAL_PERIODS.find((p) => p.id === "this-week");
			const { start } = period!.getBoundaries();
			const startDate = new Date(start);
			expect(startDate.getFullYear()).toBe(2026);
			expect(startDate.getMonth()).toBe(2);
			expect(startDate.getDate()).toBe(30);
			expect(startDate.getHours()).toBe(0);
		});

		it("at Sunday 2026-04-05 → start is Monday 2026-03-30 midnight", () => {
			vi.setSystemTime(new Date(2026, 3, 5, 12, 0, 0, 0)); // Sunday April 5
			const period = LOCAL_PERIODS.find((p) => p.id === "this-week");
			const { start } = period!.getBoundaries();
			const startDate = new Date(start);
			expect(startDate.getFullYear()).toBe(2026);
			expect(startDate.getMonth()).toBe(2); // March
			expect(startDate.getDate()).toBe(30);
			expect(startDate.getHours()).toBe(0);
		});
	});

	describe("getThisMonthBoundaries (via LOCAL_PERIODS[2])", () => {
		it("at 2026-04-15 → start is April 1 midnight, end is May 1 midnight", () => {
			vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0, 0));
			const period = LOCAL_PERIODS.find((p) => p.id === "this-month");
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

	describe("getLast6MonthsBoundaries (via LOCAL_PERIODS[3])", () => {
		it("at 2026-04-15 → start is October 1, 2025 midnight", () => {
			vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0, 0));
			const period = LOCAL_PERIODS.find((p) => p.id === "last-6-months");
			const { start } = period!.getBoundaries();
			const startDate = new Date(start);
			expect(startDate.getFullYear()).toBe(2025);
			expect(startDate.getMonth()).toBe(9); // October = 9
			expect(startDate.getDate()).toBe(1);
			expect(startDate.getHours()).toBe(0);
		});

		it("end is next month 1st (May 1, 2026 midnight)", () => {
			vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0, 0));
			const period = LOCAL_PERIODS.find((p) => p.id === "last-6-months");
			const { end } = period!.getBoundaries();
			const endDate = new Date(end);
			expect(endDate.getFullYear()).toBe(2026);
			expect(endDate.getMonth()).toBe(4); // May = 4
			expect(endDate.getDate()).toBe(1);
			expect(endDate.getHours()).toBe(0);
		});
	});

	describe("getAllTimeBoundaries (via LOCAL_PERIODS[4])", () => {
		it("start is 0, end is Number.MAX_SAFE_INTEGER", () => {
			const period = LOCAL_PERIODS.find((p) => p.id === "all-time");
			const { start, end } = period!.getBoundaries();
			expect(start).toBe(0);
			expect(end).toBe(Number.MAX_SAFE_INTEGER);
		});
	});

	describe("LOCAL_PERIODS array", () => {
		it("has exactly 5 entries", () => {
			expect(LOCAL_PERIODS).toHaveLength(5);
		});

		it("has ids: today, this-week, this-month, last-6-months, all-time", () => {
			const ids = LOCAL_PERIODS.map((p) => p.id);
			expect(ids).toEqual(["today", "this-week", "this-month", "last-6-months", "all-time"]);
		});

		it("each period has a non-empty label", () => {
			for (const period of LOCAL_PERIODS) {
				expect(period.label).toBeTruthy();
			}
		});
	});

	describe("getAdjacentPeriod", () => {
		it("getAdjacentPeriod('today') returns 'this-week' period", () => {
			const next = getAdjacentPeriod("today");
			expect(next).not.toBeNull();
			expect(next!.id).toBe("this-week");
		});

		it("getAdjacentPeriod('this-week') returns 'this-month' period", () => {
			const next = getAdjacentPeriod("this-week");
			expect(next).not.toBeNull();
			expect(next!.id).toBe("this-month");
		});

		it("getAdjacentPeriod('all-time') returns null (no next period)", () => {
			const next = getAdjacentPeriod("all-time");
			expect(next).toBeNull();
		});

		it("getAdjacentPeriod with unknown id returns null", () => {
			const next = getAdjacentPeriod("nonexistent");
			expect(next).toBeNull();
		});
	});
});

describe("getPriorPeriodBoundaries", () => {
	function fakePeriod(id: string, start: number, end: number) {
		return {
			id,
			label: id,
			getBoundaries: () => ({ start, end }),
		} as unknown as Period; // satisfy structural check
	}

	it("returns null for all-time", () => {
		const p = fakePeriod("all-time", 0, Date.now());
		expect(getPriorPeriodBoundaries(p)).toBeNull();
	});

	it("returns null for sfm-all-time", () => {
		const p = fakePeriod("sfm-all-time", 0, Date.now());
		expect(getPriorPeriodBoundaries(p)).toBeNull();
	});

	it("returns prior window of equal length for a bounded period", () => {
		// 4-week period: 1_000_000 → 1_000_000 + 4*7*86400000 = 3_419_200_000
		const fourWeeksMs = 4 * 7 * 86_400_000;
		const start = 1_000_000_000_000;
		const end = start + fourWeeksMs;
		const p = fakePeriod("4weeks", start, end);
		const boundaries = getPriorPeriodBoundaries(p);
		expect(boundaries).not.toBeNull();
		expect(boundaries!.start).toBe(start - fourWeeksMs);
		expect(boundaries!.end).toBe(start);
	});

	it("returns null when prior start would be < 0", () => {
		// Period whose length exceeds its start (start - length < 0).
		const p = fakePeriod("ancient", 100, 1_000_000);
		expect(getPriorPeriodBoundaries(p)).toBeNull();
	});
});
