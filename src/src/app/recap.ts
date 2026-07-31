import { LS_KEYS } from "../shared/constants/storage-keys";
import { LASTFM_PERIODS, STATSFM_PERIODS } from "../shared/stats/periods";
import type { StatsProvider } from "../shared/stats/provider";
import type { Period, StatsResult } from "../shared/types/stats";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export interface RecapSource {
	/** Period fed to the provider's calculateStats. */
	period: Period;
	/** Dismissal / cache key for the recap month, e.g. "2026-06". */
	monthKey: string;
	/** Human label, e.g. "June 2026". */
	monthLabel: string;
	/** True when the period is the exact calendar month (local provider only). */
	exactMonth: boolean;
}

/** First day of the month before `now` — the month the recap covers. */
function lastMonthStart(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

export function getRecapMonthKey(now: Date = new Date()): string {
	const d = lastMonthStart(now);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getRecapMonthLabel(now: Date = new Date()): string {
	const d = lastMonthStart(now);
	return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Provider-aware recap source. Local history supports an exact calendar month;
 * stats.fm and Last.fm only expose rolling ranges, so the recap uses their
 * closest month-ish window and labels it honestly.
 */
export function getRecapSource(providerId: string, now: Date = new Date()): RecapSource {
	const monthKey = getRecapMonthKey(now);
	const monthLabel = getRecapMonthLabel(now);

	if (providerId === "statsfm") {
		const period = STATSFM_PERIODS.find((p) => p.id === "sfm-weeks") ?? STATSFM_PERIODS[0];
		return { period, monthKey, monthLabel: "Last 4 Weeks", exactMonth: false };
	}
	if (providerId === "lastfm") {
		const period = LASTFM_PERIODS.find((p) => p.id === "1month") ?? LASTFM_PERIODS[0];
		return { period, monthKey, monthLabel: "Last Month", exactMonth: false };
	}

	const start = lastMonthStart(now).getTime();
	const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
	return {
		period: {
			id: `recap-${monthKey}`,
			label: monthLabel,
			getBoundaries: () => ({ start, end }),
		},
		monthKey,
		monthLabel,
		exactMonth: true,
	};
}

export function isRecapDismissed(monthKey: string): boolean {
	try {
		return localStorage.getItem(LS_KEYS.RECAP_DISMISSED_MONTH) === monthKey;
	} catch {
		return false;
	}
}

export function dismissRecap(monthKey: string): void {
	try {
		localStorage.setItem(LS_KEYS.RECAP_DISMISSED_MONTH, monthKey);
	} catch {
		/* ignore */
	}
}

function toLocalDateKey(timestampMs: number): string {
	const d = new Date(timestampMs);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Longest consecutive-day run within the recap window, from per-day play counts.
 * Replaces the provider's global streak (which walks back from today) so the
 * recap card only ever reflects the month it covers.
 */
export function computeRecapStreak(
	dailyPlayCounts: Array<{ date: string; count: number }> | undefined,
	start: number,
	end: number,
): { longestRun: number; daysInPeriod: number } {
	const daysInPeriod = Math.max(1, Math.round((end - start) / 86_400_000));
	if (!dailyPlayCounts?.length) return { longestRun: 0, daysInPeriod };
	const played = new Set(
		dailyPlayCounts
			.filter((d) => d.count > 0 && d.date >= toLocalDateKey(start) && d.date <= toLocalDateKey(end - 1))
			.map((d) => d.date),
	);
	let longestRun = 0;
	let run = 0;
	const cursor = new Date(start);
	for (let i = 0; i < daysInPeriod; i++) {
		run = played.has(toLocalDateKey(cursor.getTime())) ? run + 1 : 0;
		if (run > longestRun) longestRun = run;
		cursor.setDate(cursor.getDate() + 1);
	}
	return { longestRun, daysInPeriod };
}

/**
 * Recap stats for the active provider, or null when the month has no plays.
 * The returned streak is month-scoped (longest run inside the window).
 */
export async function loadRecapStats(provider: StatsProvider, source: RecapSource): Promise<StatsResult | null> {
	const stats = await provider.calculateStats(source.period);
	if (stats.totalPlays === 0) return null;
	const { start, end } = source.period.getBoundaries();
	const { longestRun } = computeRecapStreak(stats.dailyPlayCounts, start, end);
	return { ...stats, streak: longestRun };
}

/** One-line banner summary, e.g. "42 hours · 1,318 plays · mostly Radiohead". */
export function buildRecapSummary(stats: StatsResult): string {
	const hours = Math.floor(stats.totalDuration / 3_600_000);
	const parts: string[] = [];
	if (hours > 0) parts.push(hours === 1 ? "1 hour" : `${hours} hours`);
	parts.push(stats.totalPlays === 1 ? "1 play" : `${stats.totalPlays.toLocaleString()} plays`);
	const topArtist = stats.topArtists[0]?.artistName;
	if (topArtist) parts.push(`mostly ${topArtist}`);
	return parts.join(" · ");
}
