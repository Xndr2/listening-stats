import { initPlaylistScheduler } from "./playlist-scheduler";
import { initTracker } from "./tracker/index";

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 30_000;

(function bootstrap() {
	const started = Date.now();
	let widgetMountStarted = false;

	function poll() {
		// Wait until Player.addEventListener and React exist
		const sp = (
			globalThis as unknown as {
				Spicetify?: { Player?: { addEventListener?: unknown }; React?: unknown; ReactDOM?: unknown };
			}
		).Spicetify;
		if (!sp?.Player?.addEventListener || !sp.React || !sp.ReactDOM) {
			if (Date.now() - started > POLL_TIMEOUT_MS) {
				console.error("[listening-stats] Spicetify init timeout: Player API not found after 30s");
				return;
			}
			setTimeout(poll, POLL_INTERVAL_MS);
			return;
		}

		// Mount the playbar widget as soon as the APIs are up - it must not wait
		// for track metadata (nothing may be playing yet) and must load even if
		// the user never opens the Listening Stats page. Dynamic import so the
		// widget's module graph (which touches Spicetify.React at eval time) is
		// only evaluated once the APIs exist.
		if (!widgetMountStarted) {
			widgetMountStarted = true;
			import("../app/widget-mount")
				.then(({ mountPlaybarWidget }) => mountPlaybarWidget())
				.catch((err) => {
					console.error("[listening-stats] playbar widget mount error:", err);
				});
		}

		// Wait until current track metadata is present
		if (
			!(globalThis as unknown as { Spicetify?: { Player?: { data?: { item?: unknown } } } }).Spicetify?.Player?.data
				?.item
		) {
			if (Date.now() - started > POLL_TIMEOUT_MS) {
				console.warn("[listening-stats] Spicetify init timeout: Player data not loaded after 30s");
				// Tracker not started; health can reflect missing Player data
				return;
			}
			setTimeout(poll, POLL_INTERVAL_MS);
			return;
		}

		// Ready to attach tracker
		console.log("[listening-stats] extension loaded, initializing tracker");
		initTracker().catch((err) => {
			console.error("[listening-stats] tracker init error:", err);
		});
		initPlaylistScheduler();
	}

	poll();
})();
