import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	cleanup();
});

const STOPS = [
	0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000,
];

describe("SegmentedControl", () => {
	it("renders 13 stops", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 0, onSelect: vi.fn() }),
		);
		const stops = container.querySelectorAll(".segmented-control-stop");
		expect(stops).toHaveLength(13);
	});

	it("marks the selected stop as active", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 15000, onSelect: vi.fn() }),
		);
		const activeStops = container.querySelectorAll(".segmented-control-stop.active");
		expect(activeStops).toHaveLength(1);
		expect(activeStops[0].textContent).toBe("15s");
	});

	it("calls onSelect with the stop value when clicked", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const onSelect = vi.fn();
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 0, onSelect }),
		);
		const stops = container.querySelectorAll(".segmented-control-stop");
		fireEvent.click(stops[6]); // 30000ms = 30s
		expect(onSelect).toHaveBeenCalledWith(30000);
	});

	it("renders the indicator element", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 0, onSelect: vi.fn() }),
		);
		const indicator = container.querySelector(".segmented-control-indicator");
		expect(indicator).not.toBeNull();
	});

	it("positions indicator based on selected index", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		// value=30000 is index 6, stopWidthPct = 100/13 ~ 7.692%
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 30000, onSelect: vi.fn() }),
		);
		const indicator = container.querySelector(".segmented-control-indicator") as HTMLElement;
		// index 6 * (100/13) = ~46.15%
		const _expectedLeft = (6 * (100 / 13)).toFixed(4);
		expect(indicator.style.left).toContain("46.");
	});

	it("renders default labels as {val/1000}s", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 0, onSelect: vi.fn() }),
		);
		const stops = container.querySelectorAll(".segmented-control-stop");
		expect(stops[0].textContent).toBe("0s");
		expect(stops[1].textContent).toBe("5s");
		expect(stops[12].textContent).toBe("60s");
	});

	it("does not apply width-constraining tick class to unlabeled stops", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, {
				stops: STOPS,
				value: 60000,
				onSelect: vi.fn(),
				labelAt: [0, 15000, 30000, 45000, 60000],
			}),
		);
		const ticks = container.querySelectorAll(".segmented-control-stop.tick");
		expect(ticks.length).toBe(0);
	});

	it("indicator covers the correct width for the last stop with labelAt", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, {
				stops: STOPS,
				value: 60000,
				onSelect: vi.fn(),
				labelAt: [0, 15000, 30000, 45000, 60000],
			}),
		);
		const indicator = container.querySelector(".segmented-control-indicator") as HTMLElement;
		const stops = container.querySelectorAll(".segmented-control-stop");
		expect(stops[12].classList.contains("active")).toBe(true);
		expect(stops[12].textContent).toBe("60s");
		const stopWidthPct = 100 / STOPS.length;
		expect(indicator.style.left).toBe(`${12 * stopWidthPct}%`);
		expect(indicator.style.width).toBe(`${stopWidthPct}%`);
	});

	it("clamps to index 0 when value is not in stops", async () => {
		const { SegmentedControl } = await import("../app/components/SegmentedControl");
		const { container } = render(
			React.createElement(SegmentedControl, { stops: STOPS, value: 12345, onSelect: vi.fn() }),
		);
		// Should clamp to index 0; first stop gets active class
		const activeStops = container.querySelectorAll(".segmented-control-stop.active");
		expect(activeStops).toHaveLength(1);
		expect(activeStops[0].textContent).toBe("0s");
	});
});
