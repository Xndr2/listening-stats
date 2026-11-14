/**
 * index.js - the custom app page. Spicetify calls the global `render()`
 * (exposed via the footer in build.mjs) and mounts what it returns.
 *
 * base.css is imported first so its tokens precede component CSS in the
 * bundled style.css.
 */
import "./styles/base.css";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { mountPlayCountPill } from "../extension/playbar-pill/mount";
import { installGlobalCapture } from "../shared/errors/capture";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { Tooltip } from "./components/Tooltip/Tooltip";

installGlobalCapture("app");
// The extension mounts the pill at startup. This covers installs where the
// extension didn't load (registered without a full `spicetify apply`); the
// pill's DOM id keeps it to one copy.
mountPlayCountPill();

/**
 * The nearest ancestor that clips its content: the area Spotify scrolls. Its
 * height is the pane's, whatever the elements in between do.
 */
function clippingAncestor(el: HTMLElement): HTMLElement | null {
	for (let p = el.parentElement; p; p = p.parentElement) {
		if (getComputedStyle(p).overflowY !== "visible") return p;
	}
	return null;
}

/**
 * Sizes the page to the pane and sets `is-fit` when it's at least 860 x 600
 * (the layout that fills the pane, see Dashboard.css).
 *
 * The height is measured instead of `100%`: some themes (Lucid's floating
 * player) make Spotify's wrapper `height: fit-content`, so 100% resolves to
 * nothing and the size-contained page collapses to its padding. Bottom padding
 * a theme puts in between (room for a floating player) is left free.
 *
 * Fit mode was a size container query, but Chromium re-checks those mid-layout
 * whenever anything on the page changes, and that cancels a wheel scroll in
 * progress inside the top list.
 */
function Root({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const pane = clippingAncestor(el);
		const size = () => {
			if (!pane) return;
			let pad = 0;
			for (let p = el.parentElement; p && p !== pane; p = p.parentElement) {
				pad += Number.parseFloat(getComputedStyle(p).paddingBottom) || 0;
			}
			const top = el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
			el.style.setProperty("--ls-pane-h", `${Math.max(0, pane.clientHeight - top - pad)}px`);
		};
		const ro = new ResizeObserver((entries) => {
			for (const e of entries) {
				if (e.target === pane) size();
				else el.classList.toggle("is-fit", e.contentRect.width >= 860 && e.contentRect.height >= 600);
			}
		});
		size();
		ro.observe(el);
		if (pane) ro.observe(pane);
		return () => ro.disconnect();
	}, []);
	return (
		<div className="ls-root" ref={ref}>
			{children}
		</div>
	);
}

export function render() {
	return (
		<Root>
			<ErrorBoundary>
				<App />
			</ErrorBoundary>
			<Tooltip />
		</Root>
	);
}

export function unmount() {
	// Query cache and listeners are module-level and survive navigation on purpose.
}
