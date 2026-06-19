import { EVENTS } from "../../shared/constants/events";
import { LS_KEYS } from "../../shared/constants/storage-keys";
import type { PlayEvent } from "../../shared/types/play-event";
import { normalizeSpotifyImageUrl } from "../../shared/util/spotify-image-url";

/** Count as a full play when listened past the user threshold or through ~90% of the track. */
export function classifyPlayOrSkip(
	totalPlayedMs: number,
	capturedDurationMs: number,
	thresholdMs: number,
): "play" | "skip" {
	if (capturedDurationMs <= 0) return "skip";
	const ratio = totalPlayedMs / capturedDurationMs;
	if (ratio >= 0.9) return "play";
	if (totalPlayedMs >= thresholdMs) return "play";
	return "skip";
}

// ─── Public Types ──────────────────────────────────────────────────────────────

export type TrackingState = "idle" | "tracking" | "completing";

export interface CapturedTrackData {
	trackUri: string;
	trackName: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	albumArt?: string;
	durationMs: number;
	startedAt: number;
}

export interface FSMState {
	state: TrackingState;
	trackUri: string | null;
	playStartTime: number | null;
	accumulatedPlayMs: number;
	isPlaying: boolean;
	durationMs: number;
	capturedData: CapturedTrackData | null;
	lastProgressMs: number;
	lastLoopDetectedAt: number;
	lastRecordedUri: string | null;
}

// Shape of PlayerData passed in from event handlers (subset of Spicetify.Player.data)
export interface PlayerData {
	isPaused: boolean;
	item: {
		uri: string;
		name: string;
		/** "narration" for Spotify DJ voice clips, "ad" for ads. */
		provider?: string;
		duration?: { milliseconds: number };
		metadata?: {
			title?: string;
			artist_name?: string;
			artist_uri?: string;
			album_title?: string;
			album_uri?: string;
			image_url?: string;
			image_xlarge_url?: string;
		};
	} | null;
}

/**
 * True for items that should be recorded as plays. Excludes Spotify DJ voice
 * clips and ads — they are not music and would pollute the stats.
 */
export function isTrackableItem(item: { uri?: string; provider?: string }): boolean {
	if (item.provider === "narration" || item.provider === "ad") return false;
	const uri = item.uri ?? "";
	if (
		uri.startsWith("spotify:narration:") ||
		uri.startsWith("spotify:ad:") ||
		uri.startsWith("spotify:interruption:")
	) {
		return false;
	}
	return true;
}

/**
 * Local-file URIs encode metadata directly: spotify:local:<artist>:<album>:<title>:<duration>
 * (components are URL-encoded with "+" for spaces). Used as a fallback when
 * Player metadata is missing for local files.
 */
export function parseLocalFileUri(uri: string): { artist: string; album: string; title: string } | null {
	if (!uri.startsWith("spotify:local:")) return null;
	const parts = uri.split(":");
	const decode = (s: string | undefined): string => {
		if (!s) return "";
		const spaced = s.replace(/\+/g, " ");
		try {
			return decodeURIComponent(spaced);
		} catch {
			return spaced;
		}
	};
	return {
		artist: decode(parts[2]),
		album: decode(parts[3]),
		title: decode(parts[4]),
	};
}

// ─── Dependency Injection Interface ───────────────────────────────────────────

export interface TrackingFSMDeps {
	addPlayEvent: (event: PlayEvent) => Promise<boolean>;
	getPlayThreshold: () => number;
	isTrackingPaused: () => boolean;
	isSkipRepeatsEnabled: () => boolean;
	dispatchEvent: (event: Event) => void;
}

// ─── TrackingFSM ──────────────────────────────────────────────────────────────

export class TrackingFSM {
	private readonly _deps: TrackingFSMDeps;
	private _state: FSMState;

	constructor(deps: TrackingFSMDeps) {
		this._deps = deps;
		this._state = TrackingFSM._initialState();
	}

	private static _initialState(): FSMState {
		return {
			state: "idle",
			trackUri: null,
			playStartTime: null,
			accumulatedPlayMs: 0,
			isPlaying: false,
			durationMs: 0,
			capturedData: null,
			lastProgressMs: 0,
			lastLoopDetectedAt: 0,
			lastRecordedUri: null,
		};
	}

	/** Current FSM state label */
	get state(): TrackingState {
		return this._state.state;
	}

	/** Returns a shallow copy of internal state for testing/inspection */
	getSnapshot(): Readonly<FSMState> {
		return {
			...this._state,
			capturedData: this._state.capturedData ? { ...this._state.capturedData } : null,
		};
	}

	/**
	 * Called when the song changes.
	 * If currently tracking, writes the previous track's event.
	 * If new playerData has an item, starts tracking the new track.
	 * If playerData is null, transitions to idle.
	 */
	async handleSongChange(playerData: PlayerData | null): Promise<void> {
		// Write event for previous track if we were tracking
		if (this._state.state === "tracking" && this._state.capturedData) {
			this._state.state = "completing";
			const totalPlayedMs =
				this._state.accumulatedPlayMs +
				(this._state.isPlaying && this._state.playStartTime !== null ? Date.now() - this._state.playStartTime : 0);
			await this._writePlayEvent(totalPlayedMs);
		}

		// Reset progress to prevent false loop detection after real track change
		this._state.lastProgressMs = 0;

		if (playerData?.item && isTrackableItem(playerData.item)) {
			const item = playerData.item;
			const meta = item.metadata;

			// Local files: fall back to URI-encoded metadata and give artist/album
			// stable name-based URIs so different local artists don't all collapse
			// into one empty-URI bucket during aggregation.
			const localMeta = parseLocalFileUri(item.uri);
			const trackName = item.name || meta?.title || localMeta?.title || "Unknown Track";
			const artistName = meta?.artist_name || localMeta?.artist || "Unknown Artist";
			const albumName = meta?.album_title || localMeta?.album || "Unknown Album";
			let artistUri = meta?.artist_uri || "";
			let albumUri = meta?.album_uri || "";
			if (localMeta) {
				if (!artistUri) artistUri = `local:artist:${artistName.toLowerCase()}`;
				if (!albumUri) albumUri = `local:album:${artistName.toLowerCase()}:${albumName.toLowerCase()}`;
			}

			this._state.capturedData = {
				trackUri: item.uri,
				trackName,
				artistName,
				artistUri,
				albumName,
				albumUri,
				albumArt: normalizeSpotifyImageUrl(meta?.image_url || meta?.image_xlarge_url),
				durationMs: item.duration?.milliseconds || 0,
				startedAt: Date.now(),
			};
			this._state.trackUri = item.uri;
			this._state.durationMs = item.duration?.milliseconds || 0;
			this._state.playStartTime = Date.now();
			this._state.accumulatedPlayMs = 0;
			this._state.isPlaying = !playerData.isPaused;
			this._state.state = "tracking";
		} else {
			// Transition to idle, clear all tracking state
			this._state = {
				...TrackingFSM._initialState(),
				// Preserve skip-repeats tracking across idle transitions
				lastRecordedUri: this._state.lastRecordedUri,
			};
		}
	}

	/**
	 * Called on play/pause events.
	 * When pausing: banks elapsed time into accumulatedPlayMs.
	 * When resuming: resets playStartTime.
	 */
	handlePlayPause(isPaused: boolean): void {
		const wasPlaying = this._state.isPlaying;

		if (wasPlaying && isPaused) {
			// Pausing: bank time
			if (this._state.playStartTime !== null) {
				this._state.accumulatedPlayMs += Date.now() - this._state.playStartTime;
			}
			this._state.isPlaying = false;
		} else if (!wasPlaying && !isPaused) {
			// Resuming: reset start time
			this._state.playStartTime = Date.now();
			this._state.isPlaying = true;
		}
	}

	/**
	 * Called on progress events.
	 * Detects repeat-one loops by observing position reset from >90% to <10%.
	 * Uses a 2-second minimum gap to avoid false triggers on very short tracks.
	 */
	handleProgress(progressMs: number, durationMs: number, repeat: 0 | 1 | 2): void {
		if (repeat === 2 && durationMs > 0 && this._state.state === "tracking") {
			const wasNearEnd = this._state.lastProgressMs > durationMs * 0.9;
			const nowNearStart = progressMs < durationMs * 0.1;
			const enoughGap = Date.now() - this._state.lastLoopDetectedAt >= 2000;

			if (wasNearEnd && nowNearStart && enoughGap) {
				// Loop detected  -  record completed play for this loop iteration
				this._state.lastLoopDetectedAt = Date.now();

				const totalPlayedMs =
					this._state.accumulatedPlayMs +
					(this._state.isPlaying && this._state.playStartTime !== null ? Date.now() - this._state.playStartTime : 0);

				// Write and re-capture async (don't await in sync handler)
				void this._writePlayEvent(totalPlayedMs).then(() => {
					// Reset accumulator for new loop
					this._state.accumulatedPlayMs = 0;
					if (this._state.isPlaying) {
						this._state.playStartTime = Date.now();
					}
					// Update startedAt for the new loop
					if (this._state.capturedData) {
						this._state.capturedData = {
							...this._state.capturedData,
							startedAt: Date.now(),
						};
					}
				});
			}
		}

		this._state.lastProgressMs = progressMs;
	}

	/** Intentional no-op: tracking persists for the session. */
	destroy(): void {
		// intentional no-op
	}

	// ─── Private ──────────────────────────────────────────────────────────────

	private async _writePlayEvent(totalPlayedMs: number): Promise<void> {
		if (!this._state.capturedData) return;

		if (this._deps.isTrackingPaused()) {
			// Dispatch paused event but do NOT write; FSM state is preserved
			this._deps.dispatchEvent(new CustomEvent(EVENTS.TRACKING_PAUSED));
			return;
		}

		const threshold = this._deps.getPlayThreshold();
		const capturedDuration = this._state.capturedData.durationMs;
		const eventType = classifyPlayOrSkip(totalPlayedMs, capturedDuration, threshold);

		// Skip-repeats suppression: only suppress consecutive plays (not skips)
		if (
			eventType === "play" &&
			this._deps.isSkipRepeatsEnabled() &&
			this._state.capturedData.trackUri === this._state.lastRecordedUri
		) {
			return;
		}

		const event: PlayEvent = {
			trackUri: this._state.capturedData.trackUri,
			trackName: this._state.capturedData.trackName,
			artistName: this._state.capturedData.artistName,
			artistUri: this._state.capturedData.artistUri,
			albumName: this._state.capturedData.albumName,
			albumUri: this._state.capturedData.albumUri,
			albumArt: this._state.capturedData.albumArt,
			durationMs: capturedDuration,
			playedMs: totalPlayedMs,
			startedAt: this._state.capturedData.startedAt,
			endedAt: Date.now(),
			type: eventType,
		};

		try {
			const written = await this._deps.addPlayEvent(event);
			if (written) {
				// Update skip-repeats tracker for successful play writes
				if (eventType === "play" && this._deps.isSkipRepeatsEnabled()) {
					this._state.lastRecordedUri = this._state.capturedData.trackUri;
				}
				// Notify listeners (play vs skip)
				const eventName = eventType === "play" ? EVENTS.PLAY_RECORDED : EVENTS.SKIP_RECORDED;
				this._deps.dispatchEvent(new CustomEvent(eventName, { detail: event }));

				if (localStorage.getItem(LS_KEYS.LOGGING) === "true") {
					console.log(
						`[listening-stats] ${eventType}: "${event.trackName}" by ${event.artistName} (${Math.round(event.playedMs / 1000)}s)`,
					);
				}
			}
		} catch (err) {
			// Log warning but do NOT crash the FSM
			console.warn("[listening-stats] Failed to write play event:", err);
		}
	}
}
