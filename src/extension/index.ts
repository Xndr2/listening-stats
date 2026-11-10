/**
 * extension.js - runs at Spotify startup and stays alive in the background,
 * whether or not the Listening Stats page is open. Owns the play tracker,
 * the credential mirror and (later) the playlist scheduler and playbar pill.
 */
import { APP_VERSION, LOG_PREFIX } from "../shared/constants/app";
import { EVENTS, listen } from "../shared/constants/events";
import { enrichArtists } from "../shared/enrichment/artists";
import { captureError, installGlobalCapture } from "../shared/errors/capture";
import { mirrorCredentials, restoreMissingCredentials } from "../shared/storage/credential-mirror";
import { waitForSpicetify } from "../shared/util/wait-for-spicetify";
import { mountPlayCountPill } from "./playbar-pill/mount";
import { startPlaylistScheduler } from "./playlist-scheduler";
import { startTracker } from "./tracker";

async function bootstrap() {
	installGlobalCapture("extension");
	await waitForSpicetify();
	const restored = await restoreMissingCredentials().catch(() => 0);
	if (restored) console.log(`${LOG_PREFIX} restored ${restored} provider setting(s) from backup`);
	void mirrorCredentials().catch(() => {});
	listen(EVENTS.SETTINGS_CHANGED, () => void mirrorCredentials().catch(() => {}));
	await startTracker();
	startPlaylistScheduler();
	mountPlayCountPill();
	// Genres for local stats. Spotify throttles this hard, so: small batches, rarely.
	const enrich = () => void enrichArtists().catch((err) => captureError(err, "extension", "handled", "enrichment"));
	setTimeout(enrich, 30_000);
	setInterval(enrich, 30 * 60_000);
	console.log(`${LOG_PREFIX} extension v${APP_VERSION} running`);
}

bootstrap().catch((err) => void captureError(err, "extension", "uncaught", "bootstrap"));
