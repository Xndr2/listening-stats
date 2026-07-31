import { ErrorBoundary } from "./components/ErrorBoundary";
import { PlaybarWidget } from "./components/PlaybarWidget";
import { injectStyles } from "./styles";

const WIDGET_ROOT_ID = "listening-stats-widget-root";

const PLAYBAR_SELECTORS = [
	".main-nowPlayingWidget-nowPlaying",
	".main-nowPlayingBar-left",
	'[data-testid="now-playing-widget"]',
];

export function findPlaybarMount(): HTMLElement | null {
	for (const sel of PLAYBAR_SELECTORS) {
		const el = document.querySelector<HTMLElement>(sel);
		if (el) return el;
	}
	return null;
}

function startAttachLoop(container: HTMLElement): void {
	const tryAttach = () => {
		// Cheap steady-state check: skip the selector queries while the widget
		// is still attached somewhere in the document.
		if (container.isConnected && container.parentElement !== document.body) return;
		const playbar = findPlaybarMount();
		if (!playbar) return;
		if (container.parentElement === playbar) return;
		playbar.appendChild(container);
	};
	tryAttach();

	const observer = new MutationObserver(tryAttach);
	observer.observe(document.body, { childList: true, subtree: true });
	setInterval(tryAttach, 2000);
}

/**
 * Mount the playbar widget. Idempotent across bundles: the extension and the
 * app bundle each carry their own copy of this module, so the guard is the
 * DOM id, not module state. The extension mounts at startup; the app's
 * render() call is a fallback for setups where the extension did not load.
 */
export function mountPlaybarWidget(): void {
	if (document.getElementById(WIDGET_ROOT_ID)) return;

	injectStyles();

	const container = document.createElement("div");
	container.id = WIDGET_ROOT_ID;
	container.style.display = "contents";
	document.body.appendChild(container);
	startAttachLoop(container);

	const element = Spicetify.React.createElement(
		ErrorBoundary,
		{ silent: true },
		Spicetify.React.createElement(PlaybarWidget),
	);

	// React 19 removes ReactDOM.render; prefer createRoot when the client
	// exposes it and keep the legacy call as fallback for React 18 builds.
	const reactDom = Spicetify.ReactDOM as unknown as {
		render?: (el: unknown, target: Element) => void;
		createRoot?: (target: Element) => { render(el: unknown): void };
	};
	if (typeof reactDom.createRoot === "function") {
		reactDom.createRoot(container).render(element);
	} else {
		reactDom.render?.(element, container);
	}
}
