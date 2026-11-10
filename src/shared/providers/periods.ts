/**
 * Time windows, computed in local time. Every window is [start, end) in Unix
 * ms; "previous" is the window of the same length right before it, used for
 * "12% vs previous".
 */
export const PERIOD_IDS = [
	"today",
	"this-week",
	"this-month",
	"last-month",
	"last-4-weeks",
	"last-6-months",
	"this-year",
	"all-time",
] as const;
export type PeriodId = (typeof PERIOD_IDS)[number];

export const PERIOD_LABELS: Record<PeriodId, string> = {
	today: "Today",
	"this-week": "This week",
	"this-month": "This month",
	"last-month": "Last month",
	"last-4-weeks": "Last 4 weeks",
	"last-6-months": "Last 6 months",
	"this-year": "This year",
	"all-time": "All time",
};

export interface PeriodWindow {
	id: PeriodId;
	start: number;
	end: number;
	previous?: { start: number; end: number };
}

export type WeekStart = "monday" | "sunday";

const DAY = 86_400_000;

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function periodWindow(id: PeriodId, now: number = Date.now(), weekStart: WeekStart = "monday"): PeriodWindow {
	const today = startOfDay(new Date(now));
	const end = now + 1; // include "now"
	let start: Date;
	let prevStart: Date | undefined;
	switch (id) {
		case "today":
			start = today;
			prevStart = addDays(today, -1);
			break;
		case "this-week": {
			const dow = today.getDay(); // 0 = Sunday
			const back = weekStart === "monday" ? (dow + 6) % 7 : dow;
			start = addDays(today, -back);
			prevStart = addDays(start, -7);
			break;
		}
		case "this-month":
			start = new Date(today.getFullYear(), today.getMonth(), 1);
			prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			break;
		case "last-month": {
			// A finished month: fixed window, compared with the month before it.
			const s0 = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			const e0 = new Date(today.getFullYear(), today.getMonth(), 1);
			const p0 = new Date(today.getFullYear(), today.getMonth() - 2, 1);
			return { id, start: s0.getTime(), end: e0.getTime(), previous: { start: p0.getTime(), end: s0.getTime() } };
		}
		case "last-4-weeks":
			start = addDays(today, -27);
			prevStart = addDays(start, -28);
			break;
		case "last-6-months":
			start = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate() + 1);
			prevStart = new Date(today.getFullYear(), today.getMonth() - 12, today.getDate() + 1);
			break;
		case "this-year":
			start = new Date(today.getFullYear(), 0, 1);
			prevStart = new Date(today.getFullYear() - 1, 0, 1);
			break;
		case "all-time":
			return { id, start: 0, end };
	}
	// The previous window covers the same elapsed span, so "this week so far"
	// is compared with the same days of last week, not the whole week.
	const elapsed = end - start.getTime();
	const previous = { start: prevStart.getTime(), end: Math.min(prevStart.getTime() + elapsed, start.getTime()) };
	return { id, start: start.getTime(), end, previous };
}

/** Local calendar days the window spans so far (at least 1). */
export function windowDays(w: PeriodWindow, firstDataAt?: number): number {
	const start = w.id === "all-time" ? (firstDataAt ?? w.end) : w.start;
	return Math.max(
		1,
		Math.round((startOfDay(new Date(w.end - 1)).getTime() - startOfDay(new Date(start)).getTime()) / DAY) + 1,
	);
}

/** YYYY-MM-DD in local time. */
export function dateKey(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday = 0 ... Sunday = 6 */
export function weekdayIndex(ms: number): number {
	return (new Date(ms).getDay() + 6) % 7;
}

/** Maps v2's saved period ids onto v3's. */
export function fromV2PeriodId(id: string): PeriodId | undefined {
	const map: Record<string, PeriodId> = {
		today: "today",
		"this-week": "this-week",
		"this-month": "this-month",
		"all-time": "all-time",
		"last-6-months": "last-6-months",
		"sfm-today": "today",
		"sfm-weeks": "last-4-weeks",
		"sfm-months": "last-6-months",
		"sfm-all-time": "all-time",
		"7day": "this-week",
		"1month": "last-4-weeks",
		"3month": "last-6-months",
		"6month": "last-6-months",
		"12month": "this-year",
		overall: "all-time",
	};
	return map[id];
}
