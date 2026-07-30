import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildRecapSummary,
	computeRecapStreak,
	dismissRecap,
	getRecapMonthKey,
	getRecapMonthLabel,
	getRecapSource,
	isRecapDismissed,
	loadRecapStats,
} from "../app/recap";
import { LS_KEYS } from "../shared/constants/storage-keys";
import type { StatsProvider } from "../shared/stats/provider";
import type { StatsResult } from "../shared/types/stats";

function makeStats(overrides: Partial<StatsResult> = {}): StatsResult {
	return {
		topTracks: [],
		topArtists: [],
		topAlbums: [],
		topGenres: [],
		totalPlays: 100,
		totalDuration: 7_200_000,
		recentPlays: [],
		hourlyDistribution: Array(24).fill(0),
		peakHour: 0,
		skipRate: 0,
		uniqueTrackCount: 10,
		uniqueArtistCount: 5,
		...overrides,
	};
}

afterEach(() => {
	localStorage.clear();
});

describe("getRecapMonthKey / getRecapMonthLabel", () => {
	it("returns the previous month", () => {
		expect(getRecapMonthKey(new Date(2026, 6, 4))).toBe("2026-06");
		expect(getRecapMonthLabel(new Date(2026, 6, 4))).toBe("June 2026");
	});

	it("crosses the year boundary in January", () => {
		expect(getRecapMonthKey(new Date(2026, 0, 15))).toBe("2025-12");
		expect(getRecapMonthLabel(new Date(2026, 0, 15))).toBe("December 2025");
	});
});

describe("getRecapSource", () => {
	it("local: exact calendar month boundaries", () => {
		const src = getRecapSource("local", new Date(2026, 6, 4));
		expect(src.exactMonth).toBe(true);
		expect(src.monthKey).toBe("2026-06");
		const { start, end } = src.period.getBoundaries();
		expect(new Date(start).toISOString().slice(0, 10)).toBe(new Date(2026, 5, 1).toISOString().slice(0, 10));
		expect(end - start).toBe(30 * 86_400_000); // June has 30 days
		expect(src.period.id).toBe("recap-2026-06");
	});

	it("statsfm: rolling 4-week window, not exact", () => {
		const src = getRecapSource("statsfm");
		expect(src.exactMonth).toBe(false);
		expect(src.period.id).toBe("sfm-weeks");
	});

	it("lastfm: 1month period, not exact", () => {
		const src = getRecapSource("lastfm");
		expect(src.exactMonth).toBe(false);
		expect(src.period.id).toBe("1month");
	});
});

describe("recap dismissal", () => {
	it("round-trips through localStorage per month key", () => {
		expect(isRecapDismissed("2026-06")).toBe(false);
		dismissRecap("2026-06");
		expect(isRecapDismissed("2026-06")).toBe(true);
		expect(localStorage.getItem(LS_KEYS.RECAP_DISMISSED_MONTH)).toBe("2026-06");
		// A new month is not dismissed by an old key
		expect(isRecapDismissed("2026-07")).toBe(false);
	});
});

describe("loadRecapStats", () => {
	it("returns stats when the month has plays, null when empty", async () => {
		const src = getRecapSource("local", new Date(2026, 6, 4));
		const withPlays = { calculateStats: vi.fn().mockResolvedValue(makeStats()) } as unknown as StatsProvider;
		expect(await loadRecapStats(withPlays, src)).not.toBeNull();
		const empty = {
			calculateStats: vi.fn().mockResolvedValue(makeStats({ totalPlays: 0 })),
		} as unknown as StatsProvider;
		expect(await loadRecapStats(empty, src)).toBeNull();
	});

	it("overrides the provider's global streak with the month-scoped run", async () => {
		const src = getRecapSource("local", new Date(2026, 6, 4));
		// Global streak 99, but only June 10-12 played inside the window
		const provider = {
			calculateStats: vi.fn().mockResolvedValue(
				makeStats({
					streak: 99,
					dailyPlayCounts: [
						{ date: "2026-06-10", count: 5 },
						{ date: "2026-06-11", count: 2 },
						{ date: "2026-06-12", count: 8 },
					],
				}),
			),
		} as unknown as StatsProvider;
		const result = await loadRecapStats(provider, src);
		expect(result?.streak).toBe(3);
	});
});

describe("computeRecapStreak", () => {
	const june = getRecapSource("local", new Date(2026, 6, 4)).period.getBoundaries();

	it("finds the longest consecutive run inside the window", () => {
		const daily = [
			{ date: "2026-06-01", count: 1 },
			{ date: "2026-06-02", count: 1 },
			{ date: "2026-06-04", count: 1 },
			{ date: "2026-06-05", count: 1 },
			{ date: "2026-06-06", count: 1 },
		];
		expect(computeRecapStreak(daily, june.start, june.end)).toEqual({ longestRun: 3, daysInPeriod: 30 });
	});

	it("ignores days outside the window (53-week lookback data)", () => {
		const daily = [
			{ date: "2026-05-28", count: 4 },
			{ date: "2026-05-29", count: 4 },
			{ date: "2026-05-30", count: 4 },
			{ date: "2026-05-31", count: 4 },
			{ date: "2026-06-01", count: 1 },
			{ date: "2026-07-01", count: 9 },
		];
		expect(computeRecapStreak(daily, june.start, june.end).longestRun).toBe(1);
	});

	it("full month run equals daysInPeriod (listened every day)", () => {
		const daily = Array.from({ length: 30 }, (_, i) => ({
			date: `2026-06-${String(i + 1).padStart(2, "0")}`,
			count: 1,
		}));
		const result = computeRecapStreak(daily, june.start, june.end);
		expect(result.longestRun).toBe(30);
		expect(result.longestRun).toBe(result.daysInPeriod);
	});

	it("zero-count days break the run", () => {
		const daily = [
			{ date: "2026-06-01", count: 1 },
			{ date: "2026-06-02", count: 0 },
			{ date: "2026-06-03", count: 1 },
		];
		expect(computeRecapStreak(daily, june.start, june.end).longestRun).toBe(1);
	});

	it("returns 0 without daily data", () => {
		expect(computeRecapStreak(undefined, june.start, june.end).longestRun).toBe(0);
	});
});

describe("buildRecapSummary", () => {
	it("joins hours, plays, and top artist", () => {
		const stats = makeStats({
			totalDuration: 42 * 3_600_000,
			totalPlays: 1318,
			topArtists: [
				{
					rank: 1,
					artistUri: "spotify:artist:1",
					artistName: "Radiohead",
					count: 200,
					durationMs: 0,
					genres: [],
					imageUrl: null,
				},
			],
		});
		expect(buildRecapSummary(stats)).toBe("42 hours · 1,318 plays · mostly Radiohead");
	});

	it("omits hours and artist when absent", () => {
		expect(buildRecapSummary(makeStats({ totalDuration: 0, totalPlays: 1 }))).toBe("1 play");
	});
});
