/**
 * Connects the tracker reducer to Spotify: player events in, database writes
 * out. Writes run one at a time so an update never overtakes its insert.
 */
import { LOG_PREFIX } from "../shared/constants/app";
import { type TrackerHealth, V3_KEYS } from "../shared/constants/storage-keys";
import { captureError } from "../shared/errors/capture";
import { getSetting, playThresholdMs } from "../shared/settings/registry";
import { addPlayEvent, updatePlaytime } from "../shared/storage/play-events";
import {
	type Effect,
	initialState,
	step,
	type TrackerEvent,
	type TrackerSettings,
	type TrackerState,
	type TrackMeta,
} from "../shared/tracker/reducer";
import { spotifyImageUrl } from "../shared/util/spotify-image";

const TICK_MS = 2000;

let state: TrackerState = initialState;
let privateSession = false;
const health: TrackerHealth = {
	startedAt: Date.now(),
	lastEventAt: 0,
	lastWriteAt: 0,
	lastError: null,
	privateSession,
};

function saveHealth(): void {
	try {
		localStorage.setItem(V3_KEYS.TRACKER_HEALTH, JSON.stringify(health));
	} catch {
		// non-essential
	}
}

function settings(): TrackerSettings {
	return {
		paused: getSetting("trackingPaused"),
		skipRepeats: getSetting("skipRepeats"),
		excludePodcasts: getSetting("excludePodcasts"),
		respectPrivateSession: getSetting("respectPrivateSession"),
		thresholdFor: playThresholdMs,
	};
}

function currentMeta(): TrackMeta | null {
	const item = Spicetify.Player.data?.item;
	if (!item?.uri) return null;
	const md = item.metadata ?? {};
	return {
		uri: item.uri,
		name: item.name || md.title || "",
		artistName: md.artist_name ?? "",
		artistUri: md.artist_uri ?? "",
		albumName: md.album_title ?? "",
		albumUri: md.album_uri ?? "",
		albumArt: spotifyImageUrl(md.image_url),
		durationMs: item.duration?.milliseconds ?? Spicetify.Player.getDuration() ?? 0,
		kind: item.type ?? "track",
		provider: item.provider ?? "",
	};
}

// --- effect runner ---------------------------------------------------------

const idByKey = new Map<number, number | null>();
let queue: Promise<void> = Promise.resolve();

async function runEffect(fx: Effect): Promise<void> {
	if (fx.type === "insert") {
		idByKey.set(fx.key, await addPlayEvent(fx.event));
	} else {
		const id = idByKey.get(fx.key);
		idByKey.delete(fx.key);
		// null = the insert was a duplicate; nothing to update
		if (id != null) await updatePlaytime(id, fx.playedMs, fx.endedAt);
	}
	health.lastWriteAt = Date.now();
}

function enqueue(effects: Effect[]): void {
	for (const fx of effects) {
		queue = queue
			.then(() => runEffect(fx))
			.catch((err) => {
				health.lastError = err instanceof Error ? err.message : String(err);
				void captureError(err, "extension", "handled", "tracker");
			})
			.finally(saveHealth);
	}
}

function dispatch(event: TrackerEvent): void {
	try {
		const out = step(state, event, { now: Date.now(), settings: settings(), privateSession });
		state = out.state;
		health.lastEventAt = Date.now();
		if (out.effects.length) enqueue(out.effects);
	} catch (err) {
		void captureError(err, "extension", "handled", "tracker");
	}
}

function onSongChange(): void {
	const meta = currentMeta();
	if (!meta) {
		dispatch({ type: "stop" });
		return;
	}
	dispatch({
		type: "trackStart",
		meta,
		isPaused: Spicetify.Player.data?.isPaused ?? false,
		positionMs: Spicetify.Player.getProgress(),
	});
}

function onPlayPause(): void {
	dispatch({ type: Spicetify.Player.data?.isPaused ? "pause" : "resume" });
}

function onProgress(): void {
	dispatch({ type: "progress", positionMs: Spicetify.Player.getProgress() });
}

/**
 * Resolves once Spotify has reported the private-session state (it does so
 * asynchronously right after subscribing), or after a short timeout, so the
 * track playing at startup isn't judged before we know.
 */
function watchPrivateSession(): Promise<void> {
	const api = Spicetify.Platform?.PrivateSessionAPI;
	return new Promise((resolve) => {
		const done = setTimeout(resolve, 3000);
		try {
			if (!api?.subscribeToPrivateSession) {
				clearTimeout(done);
				resolve();
				return;
			}
			api.subscribeToPrivateSession((on: boolean) => {
				privateSession = !!on;
				health.privateSession = privateSession;
				saveHealth();
				clearTimeout(done);
				resolve();
			});
		} catch (err) {
			console.warn(`${LOG_PREFIX} private session state unavailable`, err);
			clearTimeout(done);
			resolve();
		}
	});
}

export async function startTracker(): Promise<void> {
	await watchPrivateSession();
	Spicetify.Player.addEventListener("songchange", onSongChange);
	Spicetify.Player.addEventListener("onplaypause", onPlayPause);
	Spicetify.Player.addEventListener("onprogress", onProgress);
	setInterval(() => dispatch({ type: "tick" }), TICK_MS);
	// Spotify quitting: the threshold insert has already happened for any
	// counted track; this records the final playtime if the write gets through.
	window.addEventListener("pagehide", () => dispatch({ type: "stop" }));
	onSongChange();
	saveHealth();
}
