import type { Period, PeriodBoundaries } from "../types/stats";

function getTodayBoundaries(): PeriodBoundaries {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
	return { start: start.getTime(), end: end.getTime() };
}

function getThisWeekBoundaries(): PeriodBoundaries {
	const now = new Date();
	const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
	const daysFromMonday = (dayOfWeek + 6) % 7; // Mon=0, Tue=1, ..., Sun=6 (ISO 8601)
	const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday, 0, 0, 0, 0);
	const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, 0, 0, 0, 0);
	return { start: monday.getTime(), end: nextMonday.getTime() };
}

function getThisMonthBoundaries(): PeriodBoundaries {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
	return { start: start.getTime(), end: end.getTime() };
}

function getLast6MonthsBoundaries(): PeriodBoundaries {
	const now = new Date();
	// Six calendar months back from the first of this month
	const start = new Date(now.getFullYear(), now.getMonth() - 6, 1, 0, 0, 0, 0);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
	return { start: start.getTime(), end: end.getTime() };
}

function getAllTimeBoundaries(): PeriodBoundaries {
	return { start: 0, end: Number.MAX_SAFE_INTEGER };
}

export const LOCAL_PERIODS: Period[] = [
	{
		id: "today",
		label: "Today",
		getBoundaries: getTodayBoundaries,
	},
	{
		id: "this-week",
		label: "This Week",
		getBoundaries: getThisWeekBoundaries,
	},
	{
		id: "this-month",
		label: "This Month",
		getBoundaries: getThisMonthBoundaries,
	},
	{
		id: "last-6-months",
		label: "Last 6 Months",
		getBoundaries: getLast6MonthsBoundaries,
	},
	{
		id: "all-time",
		label: "All Time",
		getBoundaries: getAllTimeBoundaries,
	},
];

// stats.fm period definitions (v2.2)  -  getBoundaries kept for local fallback
// stats.fm API uses named range params (today/weeks/months/lifetime), not timestamps

export const STATSFM_PERIODS: Period[] = [
	{ id: "sfm-weeks", label: "This Week", getBoundaries: getThisWeekBoundaries },
	{ id: "sfm-months", label: "This Month", getBoundaries: getThisMonthBoundaries },
	{ id: "sfm-all-time", label: "All Time", getBoundaries: getAllTimeBoundaries },
];

export const STATSFM_PERIODS_PLUS: Period[] = [
	{ id: "sfm-today", label: "Today", getBoundaries: getTodayBoundaries },
	...STATSFM_PERIODS,
];

export function getAdjacentPeriod(currentId: string): Period | null {
	const index = LOCAL_PERIODS.findIndex((p) => p.id === currentId);
	if (index === -1 || index === LOCAL_PERIODS.length - 1) {
		return null;
	}
	return LOCAL_PERIODS[index + 1];
}

/**
 * Prior window with the same duration as `period`, or null for all-time / invalid range.
 * Feeds new-artist diff and hero vs-prior duration ratio.
 */
export function getPriorPeriodBoundaries(period: Period): { start: number; end: number } | null {
	if (period.id === "all-time" || period.id === "sfm-all-time") return null;
	const { start, end } = period.getBoundaries();
	const length = end - start;
	const priorStart = start - length;
	if (priorStart < 0) return null;
	return { start: priorStart, end: start };
}

/** Synthetic period tab: opens global charts (not persisted as a time range). */
export const WORLD_TAB_PERIOD_ID = "world-charts";

export const WORLD_TAB_PERIOD: Period = {
	id: WORLD_TAB_PERIOD_ID,
	label: "World",
	getBoundaries: getAllTimeBoundaries,
};
