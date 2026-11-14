/**
 * Keeps the play-count pill attached to Spotify's now-playing widget.
 * Spotify re-renders that area now and then, which can drop our node; we
 * watch only the player bar (not the whole page) and re-attach when needed.
 */
import { captureError } from "../../shared/errors/capture";
import { PlayCountPill } from "./PlayCountPill";
// As text in both bundles: the app build otherwise sends CSS to style.css.
import css from "./pill.css" with { type: "text" };

const ROOT_ID = "listening-stats-pill";
const STYLE_ID = "listening-stats-pill-style";
// The now-playing widget first (class, then the test id). Spotify 1.3 has
// neither, so the left player-bar region (it also holds the cover art) is the
// last resort, as in v2; without it the pill never showed on 1.3.
const TARGETS = [".main-nowPlayingWidget-nowPlaying", '[data-testid="now-playing-widget"]', ".main-nowPlayingBar-left"];
const BAR = [".Root__now-playing-bar", '[data-testid="now-playing-bar"]'];

function find(selectors: string[]): HTMLElement | null {
	for (const s of selectors) {
		const el = document.querySelector<HTMLElement>(s);
		if (el) return el;
	}
	return null;
}

export function mountPlayCountPill(): void {
	if (document.getElementById(ROOT_ID)) return;
	if (!document.getElementById(STYLE_ID)) {
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = css;
		document.head.appendChild(style);
	}

	const container = document.createElement("span");
	container.id = ROOT_ID;

	// Best target available now (moves out of the fallback once the widget shows
	// up), kept as the last child: Spotify inserts track info after our node,
	// which would push the pill in front of the cover art.
	const attach = () => {
		const target = find(TARGETS);
		if (target && (container.parentElement !== target || container.nextElementSibling)) target.appendChild(container);
	};

	try {
		const dom = Spicetify.ReactDOM as unknown as {
			createRoot?: (el: Element) => { render(node: unknown): void };
			render?: (node: unknown, el: Element) => void;
		};
		const node = Spicetify.React.createElement(PlayCountPill);
		if (dom.createRoot) dom.createRoot(container).render(node);
		else dom.render?.(node, container);
	} catch (err) {
		void captureError(err, "extension", "handled", "play-count-pill");
		return;
	}

	attach();
	let observed: HTMLElement | null = null;
	const observer = new MutationObserver(attach);
	const watch = () => {
		// Clients without the bar's known names: watch the target's parent instead.
		const bar = find(BAR) ?? find(TARGETS)?.parentElement ?? null;
		if (bar && bar !== observed) {
			observer.disconnect();
			observer.observe(bar, { childList: true, subtree: true });
			observed = bar;
		}
		attach();
	};
	watch();
	// The bar itself can be replaced (layout changes); check now and then.
	setInterval(watch, 5000);
}
