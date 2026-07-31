import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { injectStyles } from "./styles";
import { mountPlaybarWidget } from "./widget-mount";

declare const __VERSION__: string;

const { React } = Spicetify;

export function render() {
	injectStyles();
	// The extension bundle mounts the playbar widget at startup; this is a
	// fallback for setups where extension.js did not load. No-op if mounted.
	mountPlaybarWidget();

	return React.createElement(ErrorBoundary, { appVersion: __VERSION__ }, React.createElement(App));
}

export function unmount() {
	// The playbar widget is owned by the extension bundle and stays mounted
	// across navigation; nothing to clean up here.
}
