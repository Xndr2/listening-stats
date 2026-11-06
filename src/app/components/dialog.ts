import type { MouseEvent } from "react";

/**
 * True when a click on a modal <dialog> landed on its backdrop. The backdrop
 * belongs to the dialog element, so the target alone can't tell it apart
 * from the dialog's own padding; the click position can.
 */
export function onBackdrop(e: MouseEvent<HTMLDialogElement>): boolean {
	if (e.target !== e.currentTarget) return false;
	const r = e.currentTarget.getBoundingClientRect();
	return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
