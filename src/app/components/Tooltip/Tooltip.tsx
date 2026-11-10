/**
 * Instant tooltips for anything with a `data-tip` attribute. The browser's
 * own `title` tooltip waits about a second and can't be styled, so one shared
 * popover follows the pointer (and keyboard focus) instead. A popover sits in
 * the top layer, so tips also show above the settings and share dialogs.
 *
 * With `data-tip-overflow` the tip only shows when the element's text is cut
 * off, so a name that's fully visible isn't repeated.
 */
import { useEffect, useRef } from "react";
import "./Tooltip.css";

const GAP = 8;

export function Tooltip() {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const tip = ref.current;
		if (!tip) return;
		let current: Element | null = null;

		const hide = () => {
			current = null;
			if (tip.matches(":popover-open")) tip.hidePopover();
		};
		const show = (el: Element) => {
			const text = el.getAttribute("data-tip");
			if (!text) return hide();
			if (el.hasAttribute("data-tip-overflow") && el.scrollWidth <= el.clientWidth) return hide();
			current = el;
			tip.textContent = text;
			// Re-showing moves it to the top of the top layer, above a dialog opened since.
			if (tip.matches(":popover-open")) tip.hidePopover();
			tip.showPopover();
			const r = el.getBoundingClientRect();
			const t = tip.getBoundingClientRect();
			const above = r.top - t.height - GAP;
			const top = above >= 4 ? above : r.bottom + GAP;
			const left = Math.min(Math.max(4, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 4);
			tip.style.top = `${top}px`;
			tip.style.left = `${left}px`;
		};
		const target = (e: Event) => {
			const el = (e.target as Element | null)?.closest?.("[data-tip]");
			return el?.closest(".ls-root, .ls-portal") ? el : null;
		};

		const over = (e: Event) => {
			const el = target(e);
			if (el !== current) el ? show(el) : hide();
		};
		const focus = (e: Event) => {
			const el = target(e);
			if (el && (el as HTMLElement).matches(":focus-visible")) show(el);
		};
		document.addEventListener("pointerover", over);
		document.addEventListener("focusin", focus);
		document.addEventListener("focusout", hide);
		document.addEventListener("pointerdown", hide, true);
		document.addEventListener("scroll", hide, true);
		document.addEventListener("keydown", hide, true);
		return () => {
			document.removeEventListener("pointerover", over);
			document.removeEventListener("focusin", focus);
			document.removeEventListener("focusout", hide);
			document.removeEventListener("pointerdown", hide, true);
			document.removeEventListener("scroll", hide, true);
			document.removeEventListener("keydown", hide, true);
			hide();
		};
	}, []);
	return <div ref={ref} className="ls-tooltip" popover="manual" role="tooltip" />;
}
