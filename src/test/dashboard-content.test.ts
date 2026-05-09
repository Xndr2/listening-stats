import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityChart } from "../app/components/ActivityChart";
import { ListeningPatterns } from "../app/components/ListeningPatterns";
import { RecentlyPlayed } from "../app/components/RecentlyPlayed";
import { getRankClass } from "../app/components/TopLists";
import type { RecentPlay } from "../shared/types/stats";

afterEach(() => {
	cleanup();
	localStorage.clear();
});

// ─── getRankClass ─────────────────────────────────────────────────────────────

describe("getRankClass", () => {
	it("returns rank-gold for rank 1", () => {
		expect(getRankClass(1)).toBe("rank-gold");
	});
	it("returns rank-silver for rank 2", () => {
		expect(getRankClass(2)).toBe("rank-silver");
	});
	it("returns rank-bronze for rank 3", () => {
		expect(getRankClass(3)).toBe("rank-bronze");
	});
	it("returns empty string for rank 4+", () => {
		expect(getRankClass(4)).toBe("");
		expect(getRankClass(10)).toBe("");
	});
});

// ─── ActivityChart ────────────────────────────────────────────────────────────

describe("ActivityChart", () => {
	const hourlyDistribution = Array.from({ length: 24 }, (_, i) => i * 2);

	it("renders 24 bars", () => {
		const { container } = render(
			React.createElement(ActivityChart, {
				hourlyDistribution,
				peakHour: 14,
			}),
		);
		const bars = container.querySelectorAll(".activity-bar");
		expect(bars).toHaveLength(24);
	});

	it("marks peak hour bar with peak class", () => {
		const { container } = render(
			React.createElement(ActivityChart, {
				hourlyDistribution,
				peakHour: 14,
			}),
		);
		const bars = container.querySelectorAll(".activity-bar");
		// hour 14 has val=28 (non-zero) and isPeak
		expect(bars[14].classList.contains("peak")).toBe(true);
	});

	it("does not mark non-peak bars with peak class", () => {
		const { container } = render(
			React.createElement(ActivityChart, {
				hourlyDistribution,
				peakHour: 14,
			}),
		);
		const bars = container.querySelectorAll(".activity-bar");
		expect(bars[0].classList.contains("peak")).toBe(false);
		expect(bars[23].classList.contains("peak")).toBe(false);
	});

	it("sets zero height for hours with no plays", () => {
		// hour 0 has val=0, should render with 0% height
		const { container } = render(
			React.createElement(ActivityChart, {
				hourlyDistribution,
				peakHour: 14,
			}),
		);
		const bars = container.querySelectorAll(".activity-bar");
		const style = (bars[0] as HTMLElement).style.height;
		expect(style).toBe("0%");
	});

	it("renders SectionHeading with kicker 'Patterns' and title 'Activity'", () => {
		const { container } = render(
			React.createElement(ActivityChart, {
				hourlyDistribution,
				peakHour: 14,
			}),
		);
		const kicker = container.querySelector(".section-kicker");
		expect(kicker).not.toBeNull();
		expect(kicker?.textContent).toBe("Patterns");
		const title = container.querySelector(".section-title");
		expect(title).not.toBeNull();
		expect(title?.textContent).toBe("Activity");
	});
});

// ─── RecentlyPlayed ───────────────────────────────────────────────────────────

describe("RecentlyPlayed", () => {
	const makePlay = (i: number): RecentPlay => ({
		trackUri: `spotify:track:track${i}`,
		trackName: `Track ${i}`,
		artistName: `Artist ${i}`,
		playedAt: Date.now() - i * 60_000,
	});

	it("renders up to 12 recent plays", () => {
		const plays = Array.from({ length: 12 }, (_, i) => makePlay(i));
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		// Each play item is a direct child of .recently-played
		const wrapper = container.querySelector(".recently-played");
		expect(wrapper).not.toBeNull();
		expect(wrapper?.children).toHaveLength(12);
	});

	it("renders fewer items when fewer plays are provided", () => {
		const plays = Array.from({ length: 3 }, (_, i) => makePlay(i));
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		const wrapper = container.querySelector(".recently-played");
		expect(wrapper?.children).toHaveLength(3);
	});

	it("shows section header", () => {
		const { getByText } = render(React.createElement(RecentlyPlayed, { recentPlays: [] }));
		expect(getByText("Recently Played")).not.toBeNull();
	});

	it("renders album art img when albumArt is provided", () => {
		const plays: RecentPlay[] = [
			{
				trackUri: "spotify:track:abc",
				trackName: "My Track",
				artistName: "My Artist",
				albumArt: "https://example.com/art.jpg",
				playedAt: Date.now(),
			},
		];
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		const img = container.querySelector("img");
		expect(img).not.toBeNull();
		expect(img?.src).toBe("https://example.com/art.jpg");
	});
});

// --- ListeningPatterns -------------------------------------------------------

describe("ListeningPatterns", () => {
	const hourly = Array.from({ length: 24 }, (_, i) => (i === 14 ? 38 : i === 15 ? 20 : 0));
	const weekday = [45, 10, 15, 20, 30, 112, 5]; // Mon=45, Sat=112 peak

	it("renders SectionHeading with kicker 'Patterns' and title 'Activity'", () => {
		const { container } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		const kicker = container.querySelector(".section-kicker");
		expect(kicker).not.toBeNull();
		expect(kicker?.textContent).toBe("Patterns");
		const title = container.querySelector(".section-title");
		expect(title).not.toBeNull();
		expect(title?.textContent).toBe("Activity");
	});

	it("renders Hours and Days tab buttons", () => {
		const { getByText } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		expect(getByText("Hours")).not.toBeNull();
		expect(getByText("Days")).not.toBeNull();
	});

	it("defaults to Hours tab showing activity-chart (24 bars)", () => {
		const { container } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		const activityChart = container.querySelector(".activity-chart");
		expect(activityChart).not.toBeNull();
		const bars = activityChart?.querySelectorAll(".activity-bar");
		expect(bars).toHaveLength(24);
	});

	it("switches to Days tab showing weekday-chart with 7 bars", () => {
		const { container, getByText } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		// Click Days tab
		const daysTab = getByText("Days");
		fireEvent.click(daysTab);

		const weekdayChart = container.querySelector(".weekday-chart");
		expect(weekdayChart).not.toBeNull();
		const bars = weekdayChart?.querySelectorAll(".activity-bar");
		expect(bars).toHaveLength(7);
	});

	it("marks peak weekday bar with peak class on Days tab", () => {
		const { container, getByText } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		fireEvent.click(getByText("Days"));
		const bars = container.querySelectorAll(".weekday-chart .activity-bar");
		// peakWeekday=5 (Saturday), should have .peak class
		expect(bars[5].classList.contains("peak")).toBe(true);
		// Non-peak should not
		expect(bars[0].classList.contains("peak")).toBe(false);
	});

	it("shows Hours tab active class by default", () => {
		const { getByText } = render(
			React.createElement(ListeningPatterns, {
				hourlyDistribution: hourly,
				peakHour: 14,
				weekdayDistribution: weekday,
				peakWeekday: 5,
			}),
		);
		const hoursTab = getByText("Hours");
		expect(hoursTab.classList.contains("active")).toBe(true);
	});
});
