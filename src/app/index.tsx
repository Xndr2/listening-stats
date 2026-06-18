import App from "./App";
import { PlaybarWidget } from "./components/PlaybarWidget";
import { injectStyles } from "./styles";

const { React } = Spicetify;

let widgetMounted = false;
let widgetContainer: HTMLElement | null = null;
let playbarObserver: MutationObserver | null = null;
let retryInterval: ReturnType<typeof setInterval> | null = null;

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

	playbarObserver = new MutationObserver(() => {
		tryAttach();
	});
	playbarObserver.observe(document.body, { childList: true, subtree: true });

	retryInterval = setInterval(tryAttach, 2000);
}

export function render() {
	injectStyles();

	if (!widgetMounted) {
		widgetMounted = true;
		widgetContainer = document.createElement("div");
		widgetContainer.id = "listening-stats-widget-root";
		widgetContainer.style.display = "contents";

		document.body.appendChild(widgetContainer);
		startAttachLoop(widgetContainer);

		Spicetify.ReactDOM.render(React.createElement(PlaybarWidget), widgetContainer);
	} else if (widgetContainer && !playbarObserver) {
		// unmount() stopped the attach loop; restart it so the playbar widget
		// keeps re-attaching after the user navigates back to the app.
		startAttachLoop(widgetContainer);
	}

	return React.createElement(App);
}

export function unmount() {
	if (playbarObserver) {
		playbarObserver.disconnect();
		playbarObserver = null;
	}
	if (retryInterval) {
		clearInterval(retryInterval);
		retryInterval = null;
	}
}
