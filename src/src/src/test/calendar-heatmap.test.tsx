import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarHeatmap } from "../app/components/CalendarHeatmap";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function makeDailyData(days: number): Array<{ date: string; count: number }> {
	const result: Array<{ date: string; count: number }> = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		result.push({ date: key, count: Math.floor(Math.random() * 50) + 1 });
	}
	return result;
}

describe("CalendarHeatmap", () => {
	it("renders a .heatmap-grid container", () => {
		const { container } = render(<CalendarHeatmap dailyPlayCounts={[]} />);
		expect(container.querySelector(".heatmap-grid")).not.toBeNull();
	});

	it("renders 7 cells per week column (7-row grid)", () => {
		const data = makeDailyData(90);
		const { container } = render(<CalendarHeatmap dailyPlayCounts={data} />);
		const weeks = container.querySelectorAll(".heatmap-week");
		expect(weeks.length).toBeGreaterThan(0);
		for (const week of weeks) {
			expect(week.querySelectorAll(".heatmap-cell").length).toBe(7);
		}
	});

	it("renders month labels above the grid", () => {
		const data = makeDailyData(365);
		const { container } = render(<CalendarHeatmap dailyPlayCounts={data} />);
		const labels = container.querySelector(".heatmap-month-labels");
		expect(labels).not.toBeNull();
		const text = labels?.textContent ?? "";
		expect(text.length).toBeGreaterThan(0);
	});

	it("renders 5-step legend with Less and More labels", () => {
		const { container } = render(<CalendarHeatmap dailyPlayCounts={[]} />);
		const legend = container.querySelector(".heatmap-legend");
		expect(legend).not.toBeNull();
		expect(legend?.textContent).toContain("Less");
		expect(legend?.textContent).toContain("More");
		const swatches = legend!.querySelectorAll(".heatmap-legend-swatch");
		expect(swatches.length).toBe(5);
	});

	it("assigns higher opacity to cells with more plays", () => {
		const data = [
			{ date: formatDate(daysAgo(2)), count: 1 },
			{ date: formatDate(daysAgo(1)), count: 100 },
		];
		const { container } = render(<CalendarHeatmap dailyPlayCounts={data} />);
		const cells = container.querySelectorAll(".heatmap-cell");
		const backgrounds = Array.from(cells)
			.map((c) => (c as HTMLElement).style.background)
			.filter((b) => b.includes("--spice-rgb-button"));
		expect(backgrounds.length).toBeGreaterThanOrEqual(2);
	});

	it("handles empty dailyPlayCounts gracefully", () => {
		const { container } = render(<CalendarHeatmap dailyPlayCounts={[]} />);
		expect(container.querySelector(".heatmap-grid")).not.toBeNull();
		expect(container.querySelector(".heatmap-legend")).not.toBeNull();
	});
});

function daysAgo(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}

function formatDate(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
