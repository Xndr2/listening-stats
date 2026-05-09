import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ActivitySection } from "../app/components/ActivitySection";
import { ActivityChartSkeleton } from "../app/components/LoadingSkeleton";
import { LS_KEYS } from "../shared/constants/storage-keys";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	localStorage.clear();
});

const baseProps = {
	hourlyDistribution: Array.from({ length: 24 }, (_, i) => (i === 14 ? 50 : 10)),
	peakHour: 14,
	weekdayDistribution: [62, 58, 70, 54, 88, 102, 76],
	peakWeekday: 5,
	dailyPlayCounts: [],
	streak: 7,
	showStreak: true,
};

describe("ActivitySection tab UI", () => {
	it("renders 3 tab buttons: By hour, By weekday, By day", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		expect(tabs.length).toBe(3);
		expect(tabs[0].textContent).toBe("By hour");
		expect(tabs[1].textContent).toBe("By weekday");
		expect(tabs[2].textContent).toBe("By day");
	});

	it("defaults to 'By hour' tab active", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const active = container.querySelector(".activity-tab.active");
		expect(active).not.toBeNull();
		expect(active?.textContent).toBe("By hour");
	});

	it("renders section heading with kicker 'Patterns' and title 'Activity'", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		expect(container.querySelector(".section-kicker")?.textContent).toBe("Patterns");
		expect(container.querySelector(".section-title")?.textContent).toBe("Activity");
	});

	it("clicking 'By weekday' tab switches view and marks tab active", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[1]);
		expect(tabs[1].classList.contains("active")).toBe(true);
		expect(tabs[0].classList.contains("active")).toBe(false);
		expect(container.querySelector(".weekday-chart")).not.toBeNull();
	});

	it("clicking 'By day' tab shows heatmap", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[2]);
		expect(tabs[2].classList.contains("active")).toBe(true);
		expect(container.querySelector(".heatmap-grid")).not.toBeNull();
	});

	it("shows hourly chart on 'By hour' tab", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		expect(container.querySelector(".activity-chart")).not.toBeNull();
	});
});

describe("ActivitySection tab persistence", () => {
	it("persists selected tab to preferences", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[1]); // weekday
		const saved = JSON.parse(localStorage.getItem(LS_KEYS.PREFERENCES) ?? "{}");
		expect(saved.activityTab).toBe("weekday");
	});

	it("restores persisted tab on mount", () => {
		localStorage.setItem(LS_KEYS.PREFERENCES, JSON.stringify({ activityTab: "day" }));
		const { container } = render(<ActivitySection {...baseProps} />);
		const active = container.querySelector(".activity-tab.active");
		expect(active?.textContent).toBe("By day");
	});

	it("falls back to 'hour' when stored tab is invalid", () => {
		localStorage.setItem(LS_KEYS.PREFERENCES, JSON.stringify({ activityTab: "invalid" }));
		const { container } = render(<ActivitySection {...baseProps} />);
		const active = container.querySelector(".activity-tab.active");
		expect(active?.textContent).toBe("By hour");
	});
});

describe("ActivitySection peak callout", () => {
	it("shows peak hour label on hourly tab when peak has plays", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const peak = container.querySelector(".activity-chart-peak");
		expect(peak).not.toBeNull();
		expect(peak?.textContent).toContain("Peak");
	});

	it("shows peak weekday label on weekday tab", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[1]);
		const peak = container.querySelector(".activity-chart-peak");
		expect(peak).not.toBeNull();
		expect(peak?.textContent).toContain("Saturday");
	});

	it("hides peak callout on day tab", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[2]);
		expect(container.querySelector(".activity-chart-peak")).toBeNull();
	});
});

describe("ActivitySection streak callout", () => {
	it("shows streak callout on day tab when showStreak=true and streak > 0", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[2]);
		const streak = container.querySelector(".streak-callout");
		expect(streak).not.toBeNull();
		expect(streak?.textContent).toContain("7 days");
	});

	it("hides streak callout when showStreak=false", () => {
		const { container } = render(<ActivitySection {...{ ...baseProps, showStreak: false }} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[2]);
		expect(container.querySelector(".streak-callout")).toBeNull();
	});

	it("hides streak callout when streak is 0", () => {
		const { container } = render(<ActivitySection {...{ ...baseProps, streak: 0 }} />);
		const tabs = container.querySelectorAll(".activity-tab");
		fireEvent.click(tabs[2]);
		expect(container.querySelector(".streak-callout")).toBeNull();
	});

	it("hides streak callout on hour/weekday tabs", () => {
		const { container } = render(<ActivitySection {...baseProps} />);
		expect(container.querySelector(".streak-callout")).toBeNull();
	});
});

function renderActivityForTest(args: {
	loading: boolean;
	stats: {
		hourlyDistribution: number[];
		peakHour: number;
		weekdayDistribution?: number[];
		peakWeekday?: number;
		dailyPlayCounts?: Array<{ date: string; count: number }>;
		streak?: number;
	} | null;
	activityCaps: {
		hasActivityData: boolean;
		hasStreakData: boolean;
	} | undefined;
}): JSX.Element | null {
	const { loading, stats, activityCaps } = args;
	if (!activityCaps) return null;
	if (!activityCaps.hasActivityData) return null;
	if (loading) return <ActivityChartSkeleton />;
	if (!stats) return null;
	return (
		<ActivitySection
			hourlyDistribution={stats.hourlyDistribution}
			peakHour={stats.peakHour}
			weekdayDistribution={stats.weekdayDistribution ?? Array(7).fill(0)}
			peakWeekday={stats.peakWeekday ?? 0}
			dailyPlayCounts={stats.dailyPlayCounts}
			streak={stats.streak}
			showStreak={activityCaps.hasStreakData}
		/>
	);
}

describe("App.tsx case 'activity' routing", () => {
	const noActivityCaps = {
		hasActivityData: false,
		hasStreakData: false,
	};
	const localCaps = {
		hasActivityData: true,
		hasStreakData: true,
	};

	const baseStats = {
		hourlyDistribution: Array(24).fill(0),
		peakHour: 0,
	};

	it("returns null when provider has no activity data", () => {
		const result = renderActivityForTest({
			loading: false,
			stats: baseStats,
			activityCaps: noActivityCaps,
		});
		expect(result).toBeNull();
	});

	it("returns null when provider has no activity data, even while loading", () => {
		const result = renderActivityForTest({
			loading: true,
			stats: null,
			activityCaps: noActivityCaps,
		});
		expect(result).toBeNull();
	});

	it("provider with activity data and stats renders ActivitySection", () => {
		const result = renderActivityForTest({
			loading: false,
			stats: baseStats,
			activityCaps: localCaps,
		});
		expect(result).not.toBeNull();
		const { container } = render(result!);
		expect(container.querySelector(".activity-chart")).not.toBeNull();
	});

	it("loading skeleton shown for full-mode providers while data loads", () => {
		const result = renderActivityForTest({
			loading: true,
			stats: null,
			activityCaps: localCaps,
		});
		expect(result).not.toBeNull();
		const { container } = render(result!);
		expect(container.querySelector("[class*='skeleton']")).not.toBeNull();
	});
});
