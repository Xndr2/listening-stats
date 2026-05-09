import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SortableRow } from "../app/components/settings/SortableRow";
import { SortableTile } from "../app/components/settings/SortableTile";

afterEach(() => cleanup());

describe("SortableRow", () => {
	const noop = () => {};

	it("renders [drag-handle button on LEFT, label CENTER, toggle slot RIGHT]", () => {
		render(
			Spicetify.React.createElement(SortableRow, {
				id: "overview",
				label: "Overview",
				dragHandleProps: { onPointerDown: noop as any },
			}),
		);
		const row = document.querySelector(".sortable-row")!;
		const children = Array.from(row.children);
		expect(children[0].classList.contains("settings-drag-handle")).toBe(true);
		expect(children[1].classList.contains("sortable-row-label")).toBe(true);
		expect(children[2].classList.contains("sortable-row-toggle")).toBe(true);
	});

	it("drag handle button has aria-label='Drag {label}' for accessibility", () => {
		render(
			Spicetify.React.createElement(SortableRow, {
				id: "overview",
				label: "Overview",
				dragHandleProps: { onPointerDown: noop as any },
			}),
		);
		const handle = document.querySelector(".settings-drag-handle") as HTMLButtonElement;
		expect(handle).toBeTruthy();
		expect(handle.getAttribute("aria-label")).toBe("Drag Overview");
	});

	it("data-row-id attribute matches the id prop", () => {
		render(
			Spicetify.React.createElement(SortableRow, {
				id: "top-lists",
				label: "Top Lists",
				dragHandleProps: { onPointerDown: noop as any },
			}),
		);
		const row = document.querySelector(".sortable-row") as HTMLElement;
		expect(row.getAttribute("data-row-id")).toBe("top-lists");
	});

	it("ChevronGripIcon SVG is rendered inside the drag handle button", () => {
		render(
			Spicetify.React.createElement(SortableRow, {
				id: "overview",
				label: "Overview",
				dragHandleProps: { onPointerDown: noop as any },
			}),
		);
		const handle = document.querySelector(".settings-drag-handle") as HTMLButtonElement;
		expect(handle.innerHTML).toContain("<svg");
	});

	it("calls dragHandleProps.onPointerDown when handle is pointerdown'd, does NOT fire when toggle area is clicked", () => {
		const handleSpy = vi.fn();
		render(
			Spicetify.React.createElement(
				SortableRow,
				{
					id: "overview",
					label: "Overview",
					dragHandleProps: { onPointerDown: handleSpy as any },
				},
				Spicetify.React.createElement("button", { className: "toggle-btn" }, "toggle"),
			),
		);
		const handle = document.querySelector(".settings-drag-handle") as HTMLButtonElement;
		const toggle = document.querySelector(".toggle-btn") as HTMLButtonElement;
		fireEvent.pointerDown(handle);
		expect(handleSpy).toHaveBeenCalledTimes(1);
		// Clicking toggle does not call the handle spy
		handleSpy.mockClear();
		fireEvent.pointerDown(toggle);
		expect(handleSpy).not.toHaveBeenCalled();
	});

	it("applies the style prop on the row root", () => {
		const style = { transform: "translate3d(0, 20px, 0)", opacity: 0.4 };
		render(
			Spicetify.React.createElement(SortableRow, {
				id: "overview",
				label: "Overview",
				dragHandleProps: { onPointerDown: noop as any },
				style,
			}),
		);
		const row = document.querySelector(".sortable-row") as HTMLElement;
		expect(row.style.transform).toBe("translate3d(0, 20px, 0)");
		expect(row.style.opacity).toBe("0.4");
	});
});

describe("SortableTile", () => {
	const noop = () => {};

	it("renders [label, toggle, data-tile-id={id}] inside a single tile div", () => {
		render(
			Spicetify.React.createElement(
				SortableTile,
				{
					id: "tracks",
					label: "Tracks",
					tileDragProps: { onPointerDown: noop as any },
				},
				Spicetify.React.createElement("button", {}, "toggle"),
			),
		);
		const tile = document.querySelector(".sortable-tile") as HTMLElement;
		expect(tile).toBeTruthy();
		expect(tile.getAttribute("data-tile-id")).toBe("tracks");
		expect(tile.querySelector(".sortable-tile-label")?.textContent).toBe("Tracks");
		expect(tile.querySelector(".sortable-tile-toggle")).toBeTruthy();
	});

	it("the tile root receives tileDragProps.onPointerDown for whole-tile drag activation", () => {
		const tileSpy = vi.fn();
		render(
			Spicetify.React.createElement(SortableTile, {
				id: "tracks",
				label: "Tracks",
				tileDragProps: { onPointerDown: tileSpy as any },
			}),
		);
		const tile = document.querySelector(".sortable-tile") as HTMLElement;
		fireEvent.pointerDown(tile);
		expect(tileSpy).toHaveBeenCalledTimes(1);
	});

	it("toggle area's onPointerDown stops propagation so toggling does NOT start drag (Decision 7)", () => {
		const tileSpy = vi.fn();
		render(
			Spicetify.React.createElement(
				SortableTile,
				{
					id: "tracks",
					label: "Tracks",
					tileDragProps: { onPointerDown: tileSpy as any },
				},
				Spicetify.React.createElement("button", { className: "toggle-inner" }, "toggle"),
			),
		);
		const toggleArea = document.querySelector(".sortable-tile-toggle") as HTMLElement;
		fireEvent.pointerDown(toggleArea);
		// tileDragProps.onPointerDown should NOT have been called because stopPropagation prevents bubbling
		expect(tileSpy).not.toHaveBeenCalled();
	});

	it("applies the style prop on the tile root", () => {
		const style = { transform: "translate3d(30px, 0, 0)", opacity: 0.4 };
		render(
			Spicetify.React.createElement(SortableTile, {
				id: "tracks",
				label: "Tracks",
				tileDragProps: { onPointerDown: noop as any },
				style,
			}),
		);
		const tile = document.querySelector(".sortable-tile") as HTMLElement;
		expect(tile.style.transform).toBe("translate3d(30px, 0, 0)");
		expect(tile.style.opacity).toBe("0.4");
	});
});
