import App from "./App";
import { injectStyles } from "./styles";
import { PlaybarWidget } from "./components/PlaybarWidget";

const { React } = Spicetify;

let widgetMounted = false;
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

export function render() {
	injectStyles();

	if (!widgetMounted) {
		widgetMounted = true;
		const container = document.createElement("div");
		container.id = "listening-stats-widget-root";
		container.style.display = "contents";

		document.body.appendChild(container);

		const tryAttach = () => {
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

		Spicetify.ReactDOM.render(
			React.createElement(PlaybarWidget),
			container,
		);
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
