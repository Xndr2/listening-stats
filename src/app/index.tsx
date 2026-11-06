/**
 * index.js - the custom app page. Spicetify calls the global `render()`
 * (exposed via the footer in build.mjs) and mounts what it returns.
 *
 * base.css is imported first so its tokens precede component CSS in the
 * bundled style.css.
 */
import "./styles/base.css";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { installGlobalCapture } from "../shared/errors/capture";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary/ErrorBoundary";
import { Tooltip } from "./components/Tooltip/Tooltip";

installGlobalCapture("app");

/**
 * Sets `is-fit` when the pane is at least 860 x 600 (the layout that fills the
 * pane, see Dashboard.css). This was a size container query, but Chromium
 * re-checks those mid-layout whenever anything on the page changes, and that
 * cancels a wheel scroll in progress inside the top list.
 */
function Root({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const ro = new ResizeObserver(([e]) => {
			el.classList.toggle("is-fit", e.contentRect.width >= 860 && e.contentRect.height >= 600);
		});
		ro.observe(el);
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
