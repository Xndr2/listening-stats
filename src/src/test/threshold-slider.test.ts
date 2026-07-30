import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	cleanup();
});

const defaultProps = {
	max: 60,
	value: 30,
	presets: [0, 15, 30, 45, 60],
	onChange: vi.fn(),
	formatValue: (v: number) => `${v}s`,
};

async function renderSlider(overrides: Partial<typeof defaultProps> = {}) {
	const { ThresholdSlider } = await import("../app/components/ThresholdSlider");
	const props = { ...defaultProps, onChange: vi.fn(), ...overrides };
	const result = render(React.createElement(ThresholdSlider, props));
	return { ...result, props };
}

describe("ThresholdSlider", () => {
	it("renders the handle with the formatted value", async () => {
		const { container } = await renderSlider({ value: 12 });
		const handle = container.querySelector(".threshold-slider-handle");
		expect(handle?.textContent).toBe("12s");
	});

	it("positions the handle proportionally to the value", async () => {
		const { container } = await renderSlider({ value: 30, max: 60 });
		const handle = container.querySelector(".threshold-slider-handle") as HTMLElement;
		expect(handle.style.left).toBe("50%");
	});

	it("renders one clickable label per preset", async () => {
		const { container } = await renderSlider();
		const presets = container.querySelectorAll(".threshold-slider-preset");
		expect(presets).toHaveLength(5);
		expect(presets[1].textContent).toBe("15s");
	});

	it("snaps to a preset when its label is clicked", async () => {
		const { container, props } = await renderSlider({ value: 12 });
		const presets = container.querySelectorAll(".threshold-slider-preset");
		fireEvent.click(presets[3]); // 45
		expect(props.onChange).toHaveBeenCalledWith(45);
	});

	it("marks the matching preset as active", async () => {
		const { container } = await renderSlider({ value: 45 });
		const active = container.querySelectorAll(".threshold-slider-preset.active");
		expect(active).toHaveLength(1);
		expect(active[0].textContent).toBe("45s");
	});

	it("sets a whole-unit value when the rail is clicked", async () => {
		const { container, props } = await renderSlider({ value: 0, max: 60 });
		const rail = container.querySelector(".threshold-slider-rail") as HTMLElement;
		vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
			left: 0,
			width: 300,
			top: 0,
			right: 300,
			bottom: 28,
			height: 28,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
		// 61px of 300px * 60 = 12.2 → rounds to whole 12
		fireEvent.pointerDown(rail, { clientX: 61, pointerId: 1 });
		expect(props.onChange).toHaveBeenCalledWith(12);
	});

	it("clamps rail clicks to the 0..max range", async () => {
		const { container, props } = await renderSlider({ value: 30, max: 60 });
		const rail = container.querySelector(".threshold-slider-rail") as HTMLElement;
		vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
			left: 0,
			width: 300,
			top: 0,
			right: 300,
			bottom: 28,
			height: 28,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
		fireEvent.pointerDown(rail, { clientX: 9999, pointerId: 1 });
		expect(props.onChange).toHaveBeenCalledWith(60);
		fireEvent.pointerDown(rail, { clientX: -50, pointerId: 1 });
		expect(props.onChange).toHaveBeenCalledWith(0);
	});

	it("steps by one whole unit with arrow keys", async () => {
		const { container, props } = await renderSlider({ value: 30 });
		const handle = container.querySelector(".threshold-slider-handle") as HTMLElement;
		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(props.onChange).toHaveBeenCalledWith(31);
		fireEvent.keyDown(handle, { key: "ArrowLeft" });
		expect(props.onChange).toHaveBeenCalledWith(29);
	});

	it("does not step past the range edges", async () => {
		const { container, props } = await renderSlider({ value: 60, max: 60 });
		const handle = container.querySelector(".threshold-slider-handle") as HTMLElement;
		fireEvent.keyDown(handle, { key: "ArrowUp" });
		expect(props.onChange).toHaveBeenCalledWith(60);
	});
});
