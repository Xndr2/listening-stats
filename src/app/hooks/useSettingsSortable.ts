const { useState, useRef, useEffect, useCallback } = Spicetify.React;

const ACTIVATION_THRESHOLD_PX = 8;

interface UseSettingsSortableOptions {
	order: string[];
	/** Axis along which items are arranged. Defaults to "vertical".
	 *  - "vertical": stacked rows (Visible Sections) - drop slot from pointer-Y vs midline-Y; transform on Y
	 *  - "horizontal": side-by-side columns (Top Lists 1x3) - drop slot from pointer-X vs midline-X; transform on X
	 *  - "grid": 2D grid (Overview 2x2 row-major) - drop slot from bounding-rect hit-test + cursor-X vs hit-tile midline-X; transform on both X and Y
	 */
	orientation?: "vertical" | "horizontal" | "grid";
	onReorder: (next: string[]) => void;
}

interface DragState {
	isDragging: boolean;
	activeId: string | null;
	dropSlotIndex: number | null;
}

interface UseSettingsSortableResult {
	dragState: DragState;
	onItemPointerDown: (itemId: string) => (e: PointerEvent) => void;
	registerItem: (itemId: string, el: HTMLElement | null) => void;
	getItemStyle: (itemId: string) => Record<string, string | number> | undefined;
}

export function useSettingsSortable(opts: UseSettingsSortableOptions): UseSettingsSortableResult {
	const { order, onReorder } = opts;
	const orientation = opts.orientation ?? "vertical";
	const [dragState, setDragState] = useState<DragState>({ isDragging: false, activeId: null, dropSlotIndex: null });

	// Refs that change during drag, kept out of state to avoid re-renders on every pointermove.
	const originRef = useRef<{ x: number; y: number } | null>(null);
	const deltaXRef = useRef<number>(0);
	const deltaYRef = useRef<number>(0);
	const itemElsRef = useRef<Map<string, HTMLElement>>(new Map());
	const orderRef = useRef<string[]>(order);

	// Keep orderRef synced; pointer handlers read this.
	useEffect(() => {
		orderRef.current = order;
	}, [order]);

	const registerItem = useCallback((itemId: string, el: HTMLElement | null) => {
		if (el) itemElsRef.current.set(itemId, el);
		else itemElsRef.current.delete(itemId);
	}, []);

	const computeDropSlot = useCallback((pointerX: number, pointerY: number): number => {
		const ord = orderRef.current;
		if (orientation === "grid") {
			for (let i = 0; i < ord.length; i++) {
				const el = itemElsRef.current.get(ord[i]);
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				if (
					pointerX >= rect.left &&
					pointerX <= rect.right &&
					pointerY >= rect.top &&
					pointerY <= rect.bottom
				) {
					const midX = (rect.left + rect.right) / 2;
					return pointerX < midX ? i : i + 1;
				}
			}
			return ord.length - 1;
		}
		// 1D mode: linear scan along the orientation axis.
		for (let i = 0; i < ord.length; i++) {
			const el = itemElsRef.current.get(ord[i]);
			if (!el) continue;
			const rect = el.getBoundingClientRect();
			if (orientation === "horizontal") {
				const mid = (rect.left + rect.right) / 2;
				if (pointerX < mid) return i;
			} else {
				const mid = (rect.top + rect.bottom) / 2;
				if (pointerY < mid) return i;
			}
		}
		return ord.length - 1;
	}, [orientation]);

	const reset = useCallback(() => {
		originRef.current = null;
		deltaXRef.current = 0;
		deltaYRef.current = 0;
		setDragState({ isDragging: false, activeId: null, dropSlotIndex: null });
	}, []);

	const onPointerMove = useCallback((e: PointerEvent) => {
		if (!originRef.current) return;
		const dx = e.clientX - originRef.current.x;
		const dy = e.clientY - originRef.current.y;
		deltaXRef.current = dx;
		deltaYRef.current = dy;

		setDragState((prev) => {
			const dist = Math.hypot(dx, dy);
			if (!prev.isDragging) {
				if (dist < ACTIVATION_THRESHOLD_PX) return prev;
				// Activate drag
				return { isDragging: true, activeId: prev.activeId, dropSlotIndex: computeDropSlot(e.clientX, e.clientY) };
			}
			return { ...prev, dropSlotIndex: computeDropSlot(e.clientX, e.clientY) };
		});
	}, [computeDropSlot]);

	const onPointerUp = useCallback(() => {
		// Resolve drop using the freshest dragState
		setDragState((prev) => {
			if (prev.isDragging && prev.activeId && prev.dropSlotIndex != null) {
				const ord = orderRef.current;
				const fromIdx = ord.indexOf(prev.activeId);
				if (fromIdx >= 0 && fromIdx !== prev.dropSlotIndex) {
					const next = [...ord];
					const [moved] = next.splice(fromIdx, 1);
					next.splice(prev.dropSlotIndex, 0, moved);
					onReorder(next);
				}
			}
			return { isDragging: false, activeId: null, dropSlotIndex: null };
		});
		originRef.current = null;
		deltaXRef.current = 0;
		deltaYRef.current = 0;
	}, [onReorder]);

	const onPointerCancel = useCallback(() => reset(), [reset]);

	const onKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === "Escape") reset();
	}, [reset]);

	// Attach window listeners only while a pointerdown is "armed" (origin captured).
	// We attach unconditionally on mount because activation can happen mid-move; cleanup on unmount.
	useEffect(() => {
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onPointerMove, onPointerUp, onPointerCancel, onKeyDown]);

	const onItemPointerDown = useCallback((itemId: string) => {
		return (e: PointerEvent) => {
			// Defensive: stale items not in current order
			if (!orderRef.current.includes(itemId)) return;
			originRef.current = { x: e.clientX, y: e.clientY };
			deltaXRef.current = 0;
			deltaYRef.current = 0;
			setDragState({ isDragging: false, activeId: itemId, dropSlotIndex: null });
		};
	}, []);

	const getItemStyle = useCallback((itemId: string): Record<string, string | number> | undefined => {
		if (!dragState.isDragging) return undefined;
		if (dragState.activeId !== itemId) return undefined;
		// Transform follows pointer along the orientation axis. Vertical lists
		// only translate Y; horizontal lists only translate X (no diagonal jitter
		// on a 1D track). Grid mode (2D) translates both axes so the dragged
		// tile follows the cursor freely across rows + columns.
		let transform: string;
		if (orientation === "horizontal") {
			transform = `translate3d(${deltaXRef.current}px, 0, 0)`;
		} else if (orientation === "grid") {
			transform = `translate3d(${deltaXRef.current}px, ${deltaYRef.current}px, 0)`;
		} else {
			transform = `translate3d(0, ${deltaYRef.current}px, 0)`;
		}
		return {
			transform,
			opacity: 0.4,
		};
	}, [dragState.isDragging, dragState.activeId, orientation]);

	return { dragState, onItemPointerDown, registerItem, getItemStyle };
}
