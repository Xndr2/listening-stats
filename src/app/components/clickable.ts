import type { MouseEvent } from "react";

/**
 * Click handler for a whole row or card that opens its item. Clicks on the
 * controls inside it (play, like, album, the title itself) keep their own
 * action. Keyboard users reach the same action through the title button.
 */
export function onCardClick(open: () => void) {
	return (e: MouseEvent) => {
		if ((e.target as Element).closest("button, a, input")) return;
		open();
	};
}
