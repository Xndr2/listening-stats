/** Display formatting. Plain functions, locale-aware through Intl. */

const nf = new Intl.NumberFormat();

export const formatNumber = (n: number) => nf.format(Math.round(n));

/** 41_040_000 -> { h: 11, m: 24 } */
export function splitHours(ms: number): { h: number; m: number } {
	const totalMin = Math.round(Math.max(0, ms) / 60_000);
	return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

/** Compact listening time: "45 min", "11 h 24 m", "312 h". */
export function formatListening(ms: number): string {
	const { h, m } = splitHours(ms);
	if (h === 0) return `${m} min`;
	if (h >= 100) return `${formatNumber(h)} h`;
	return `${h} h ${m} m`;
}

/** Table cell time: "12.8 h", "45 m". */
export function formatShortTime(ms: number): string {
	const min = ms / 60_000;
	if (min < 60) return `${Math.round(min)} m`;
	return `${(min / 60).toFixed(min < 600 ? 1 : 0)} h`;
}

export function formatHour(hour: number, use24h: boolean): string {
	if (use24h) return `${String(hour).padStart(2, "0")}:00`;
	const h = hour % 12 === 0 ? 12 : hour % 12;
	return `${h} ${hour < 12 ? "am" : "pm"}`;
}

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatPercent(fraction: number): string {
	return `${Math.round(fraction * 100)}%`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });

/** "2 min ago", "3 hr. ago", "yesterday" */
export function formatAgo(ms: number, now = Date.now()): string {
	const s = Math.round((ms - now) / 1000);
	const abs = Math.abs(s);
	if (abs < 60) return "just now";
	if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
	if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
	return rtf.format(Math.round(s / 86_400), "day");
}

/** What the previous window is called in "12% more than ___". */
export const PREVIOUS_LABEL: Record<string, string> = {
	today: "this time yesterday",
	"this-week": "this point last week",
	"this-month": "this point last month",
	"last-month": "the month before",
	"last-4-weeks": "the 4 weeks before",
	"last-6-months": "the 6 months before",
	"this-year": "this point last year",
};

/** "12% more than this point last week", or null when there's nothing to compare. */
export function formatDelta(
	current: number,
	previous: number | undefined,
	periodId: string,
): { text: string; up: boolean } | null {
	const than = PREVIOUS_LABEL[periodId];
	if (previous === undefined || !than) return null;
	if (previous <= 0) return current > 0 ? { text: `up from nothing at ${than}`, up: true } : null;
	const change = (current - previous) / previous;
	if (Math.abs(change) < 0.01) return { text: `about the same as ${than}`, up: true };
	return { text: `${formatPercent(Math.abs(change))} ${change > 0 ? "more" : "less"} than ${than}`, up: change > 0 };
}
