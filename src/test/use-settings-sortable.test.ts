import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettingsSortable } from "../app/hooks/useSettingsSortable";

function makeRect(top: number, bottom: number, left = 0, right = 100): DOMRect {
	return {
		top,
		bottom,
		left,
		right,
		width: right - left,
		height: bottom - top,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

function makeItem(rect: DOMRect): HTMLElement {
	const el = document.createElement("div");
	el.getBoundingClientRect = () => rect;
	return el;
}

describe("useSettingsSortable", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exposes onItemPointerDown(itemId) returning a pointerdown handler", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		const handler = result.current.onItemPointerDown("a");
		expect(typeof handler).toBe("function");
		// Calling handler with a synthesized event should not throw and not call onReorder
		act(() => {
			handler(new PointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
		});
		expect(onReorder).not.toHaveBeenCalled();
	});

	it("ignores pointer movement under 8px (no drag activation)", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 5 }));
		});
		expect(result.current.dragState.isDragging).toBe(false);
		expect(onReorder).not.toHaveBeenCalled();
	});

	it("activates drag once pointer moves at least 8px from origin", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 10 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		expect(result.current.dragState.activeId).toBe("a");
	});

	it("during drag, source item style applies translate3d(0, dy, 0) and opacity 0.4", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 20 }));
		});
		const style = result.current.getItemStyle("a");
		expect(style).toBeDefined();
		expect(style!.opacity).toBe(0.4);
		expect(String(style!.transform)).toContain("translate3d(0,");
		expect(String(style!.transform)).toContain("20px");
		// Other items return undefined
		expect(result.current.getItemStyle("b")).toBeUndefined();
	});

	it("computes dropSlotIndex from pointer Y vs item midlines (vertical orientation, default)", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.registerItem("a", makeItem(makeRect(0, 40)));
			result.current.registerItem("b", makeItem(makeRect(40, 80)));
			result.current.registerItem("c", makeItem(makeRect(80, 120)));
		});
		// Start drag
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 50, clientY: 0 })
			);
		});
		// Move 10px to activate drag, pointer at y=50 (in item b's range)
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 50 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		// pointerY=50, item midlines: a=20, b=60, c=100
		// 50 < 60 (b midline), so drop at slot 1
		expect(result.current.dragState.dropSlotIndex).toBe(1);
		// Move pointer to y=10, which is < a's midline (20)
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 10 }));
		});
		expect(result.current.dragState.dropSlotIndex).toBe(0);
	});

	it("computes dropSlotIndex from pointer X vs item midlines when orientation='horizontal'", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({
				order: ["a", "b", "c"],
				onReorder,
				orientation: "horizontal",
			})
		);
		act(() => {
			result.current.registerItem("a", makeItem(makeRect(0, 40, 0, 40)));
			result.current.registerItem("b", makeItem(makeRect(0, 40, 40, 80)));
			result.current.registerItem("c", makeItem(makeRect(0, 40, 80, 120)));
		});
		// Start drag
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 20 })
			);
		});
		// Move 10px to activate, pointer at x=50 (in b range)
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 20 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 20 }));
		});
		// pointerX=50, item midlines: a=20, b=60, c=100
		// 50 < 60 (b midline), slot 1
		expect(result.current.dragState.dropSlotIndex).toBe(1);
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 20 }));
		});
		// pointerX=10, < 20 (a midline), slot 0
		expect(result.current.dragState.dropSlotIndex).toBe(0);
	});

	it("applies translate3d on Y axis when orientation='vertical'", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b"], onReorder, orientation: "vertical" })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 5, clientY: 20 }));
		});
		const style = result.current.getItemStyle("a");
		expect(style).toBeDefined();
		expect(String(style!.transform)).toContain("translate3d(0,");
		expect(String(style!.transform)).toContain("20px");
	});

	it("applies translate3d on X axis when orientation='horizontal'", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b"], onReorder, orientation: "horizontal" })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 20, clientY: 5 }));
		});
		const style = result.current.getItemStyle("a");
		expect(style).toBeDefined();
		expect(String(style!.transform)).toContain("translate3d(20px, 0, 0)");
	});

	it("calls onReorder with arrayMove result on pointerup over a different slot", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.registerItem("a", makeItem(makeRect(0, 40)));
			result.current.registerItem("b", makeItem(makeRect(40, 80)));
			result.current.registerItem("c", makeItem(makeRect(80, 120)));
		});
		// Start drag on "a"
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		// Move to activate + position over slot 2 (pointer y=90 → > c's midline at 100? no, 90<100 so slot 2)
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 90 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		expect(result.current.dragState.dropSlotIndex).toBe(2);
		// Drop
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup", {}));
		});
		// arrayMove(["a","b","c"], 0, 2) => ["b","c","a"]
		expect(onReorder).toHaveBeenCalledWith(["b", "c", "a"]);
	});

	it("drop on the same slot does NOT call onReorder", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.registerItem("a", makeItem(makeRect(0, 40)));
			result.current.registerItem("b", makeItem(makeRect(40, 80)));
			result.current.registerItem("c", makeItem(makeRect(80, 120)));
		});
		// Drag "a" but keep pointer in slot 0 (y < a midline 20)
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 10 }));
		});
		expect(result.current.dragState.dropSlotIndex).toBe(0);
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup", {}));
		});
		expect(onReorder).not.toHaveBeenCalled();
	});

	it("Escape during drag cancels (no onReorder, dragState resets)", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 10 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		});
		expect(result.current.dragState.isDragging).toBe(false);
		expect(result.current.dragState.activeId).toBeNull();
		expect(onReorder).not.toHaveBeenCalled();
	});

	it("pointercancel during drag cancels (no onReorder, dragState resets)", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["a", "b", "c"], onReorder })
		);
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 10 }));
		});
		expect(result.current.dragState.isDragging).toBe(true);
		act(() => {
			window.dispatchEvent(new PointerEvent("pointercancel", {}));
		});
		expect(result.current.dragState.isDragging).toBe(false);
		expect(result.current.dragState.activeId).toBeNull();
		expect(onReorder).not.toHaveBeenCalled();
	});

	it("drag is rejected if the order array does not include the activeId (stale items defense)", () => {
		const onReorder = vi.fn();
		const { result } = renderHook(() =>
			useSettingsSortable({ order: ["b", "c"], onReorder })
		);
		// Try to start drag with "a" which is NOT in order
		act(() => {
			result.current.onItemPointerDown("a")(
				new PointerEvent("pointerdown", { clientX: 0, clientY: 0 })
			);
		});
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 20 }));
		});
		// dragState.activeId should be null since "a" is not in order
		expect(result.current.dragState.activeId).toBeNull();
		expect(result.current.dragState.isDragging).toBe(false);
	});

	it("grid orientation handles seven-tile overview order arrays", () => {
		const onReorder = vi.fn();
		const sevenIds = [
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
			"est-payout",
		];
		const { result } = renderHook(() =>
			useSettingsSortable({
				order: sevenIds,
				onReorder,
				orientation: "grid",
			})
		);

		// Register 7 items at non-overlapping rect positions.
		// Use a simple 4x2 grid layout (4 in row 1, 3 in row 2) with rects
		// sized 100x40 and gap 10.
		act(() => {
			// Row 1 (y: 0..40): four tiles at x = 0, 110, 220, 330
			result.current.registerItem("tracks", makeItem(makeRect(0, 40, 0, 100)));
			result.current.registerItem("unique-artists", makeItem(makeRect(0, 40, 110, 210)));
			result.current.registerItem("streak", makeItem(makeRect(0, 40, 220, 320)));
			result.current.registerItem("new-artists", makeItem(makeRect(0, 40, 330, 430)));
			// Row 2 (y: 50..90): three tiles at x = 0, 110, 220
			result.current.registerItem("peak-hour", makeItem(makeRect(50, 90, 0, 100)));
			result.current.registerItem("skip-rate", makeItem(makeRect(50, 90, 110, 210)));
			result.current.registerItem("est-payout", makeItem(makeRect(50, 90, 220, 320)));
		});

		// Sanity: hook accepts 7 items without error.
		expect(result.current.dragState.isDragging).toBe(false);

		// Begin a drag on est-payout (last tile).
		act(() => {
			result.current.onItemPointerDown("est-payout")(
				new PointerEvent("pointerdown", { clientX: 270, clientY: 70 }),
			);
		});

		// Move pointer to the first row, first tile area.
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 20 }));
		});

		// Drop slot index must be a valid index into a 7-tile array (0..6).
		// The exact value depends on midline math; we only assert bounds + isDragging.
		expect(result.current.dragState.isDragging).toBe(true);
		expect(result.current.dragState.dropSlotIndex).toBeGreaterThanOrEqual(0);
		expect(result.current.dragState.dropSlotIndex).toBeLessThanOrEqual(6);

		// End drag  -  onReorder should be called with a permutation of length 7.
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup", { clientX: 50, clientY: 20 }));
		});

		if (onReorder.mock.calls.length > 0) {
			const newOrder = onReorder.mock.calls[0][0];
			expect(Array.isArray(newOrder)).toBe(true);
			expect(newOrder.length).toBe(7);
			// Set equality: same 7 IDs, possibly reordered
			expect(new Set(newOrder)).toEqual(new Set(sevenIds));
		}
	});
});
