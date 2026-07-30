import { initTracker } from "./tracker/index";

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 30_000;

(function bootstrap() {
	const started = Date.now();

	function poll() {
		// Wait until Player.addEventListener exists
		if (
			!(globalThis as unknown as { Spicetify?: { Player?: { addEventListener?: unknown } } }).Spicetify?.Player
				?.addEventListener
		) {
			if (Date.now() - started > POLL_TIMEOUT_MS) {
				console.error("[listening-stats] Spicetify init timeout: Player API not found after 30s");
				return;
			}
			setTimeout(poll, POLL_INTERVAL_MS);
			return;
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
	}

	poll();
})();
