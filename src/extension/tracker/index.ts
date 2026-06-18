import { LS_KEYS } from "../../shared/constants/storage-keys";
import { db, registerVersionChangeHandler } from "../../shared/storage/db";
import { runStartupChecks } from "../../shared/storage/integrity";
import { addPlayEvent } from "../../shared/storage/play-events";
import type { PlayEvent } from "../../shared/types/play-event";
import { TrackingFSM } from "./fsm";
import { HealthIndicator } from "./health";
import {
  getPlayThreshold,
  isSkipRepeatsEnabled,
  isTrackingPaused,
} from "./settings";
import { Watchdog } from "./watchdog";

// ─── Module-level state ───────────────────────────────────────────────────────

let fsm: TrackingFSM | null = null;
let health: HealthIndicator | null = null;
let watchdog: Watchdog | null = null;

// ─── initTracker ──────────────────────────────────────────────────────────────

/** Wire FSM, health, watchdog to Spicetify.Player. Idempotent via __lsPollerInitialized. */
export async function initTracker(): Promise<void> {
  const win = window as unknown as Record<string, unknown>;

  // Double-init guard
  if (win.__lsPollerInitialized) return;
  win.__lsPollerInitialized = true;

  // Instantiate subsystems
  health = new HealthIndicator();

  // DB versionchange in another tab: surface as disconnected
  registerVersionChangeHandler(() => {
    health?.recordFailure(
      "DB connection closed  -  version upgrade in another tab",
    );
  });

  // Integrity check before tracking
  const integrity = await runStartupChecks();
  if (integrity.wipeDetected) {
    if (integrity.restored) {
      health.recordSuccess("Restored from backup after external wipe");
    } else {
      health.recordFailure(
        integrity.warning ??
          "External data wipe detected  -  play history lost",
      );
    }
  }

  // Wrap addPlayEvent to feed health indicator on success/failure
  const wrappedAddPlayEvent = async (event: PlayEvent): Promise<boolean> => {
    try {
      const written = await addPlayEvent(event);
      if (written) {
        health?.recordSuccess(event.trackName);
        localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));
      }
      return written;
    } catch (err) {
      health?.recordFailure(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  fsm = new TrackingFSM({
    addPlayEvent: wrappedAddPlayEvent,
    getPlayThreshold,
    isTrackingPaused,
    isSkipRepeatsEnabled,
    dispatchEvent: (event: Event) => window.dispatchEvent(event),
  });

  // Register Spicetify event listeners
  registerListeners();

  // If a track is already playing at init time, capture it
  const playerData = (
    globalThis as unknown as { Spicetify?: { Player?: { data?: unknown } } }
  ).Spicetify?.Player?.data;
  if (playerData && (playerData as { item?: unknown }).item) {
    fsm
      .handleSongChange(
        playerData as Parameters<TrackingFSM["handleSongChange"]>[0],
      )
      .catch((err) => {
        console.warn("[listening-stats] initial song capture error:", err);
      });
  }

  // Re-register listeners if Spotify drops them
  watchdog = new Watchdog({
    intervalMs: 300_000,
    sentinelKey: "__lsSongHandler",
    onReRegister: registerListeners,
    pingDb: () => db.playEvents.count().then(() => {}),
  });
  watchdog.start();
}

// ─── Internal: register/re-register listeners ─────────────────────────────────

function registerListeners(): void {
  const win = window as unknown as Record<string, unknown>;
  const player = (
    globalThis as unknown as {
      Spicetify?: {
        Player?: {
          addEventListener?: (event: string, handler: () => void) => void;
          removeEventListener?: (event: string, handler: () => void) => void;
          data?: unknown;
          getProgress?: () => number;
          getDuration?: () => number;
          getRepeat?: () => 0 | 1 | 2;
        };
      };
    }
  ).Spicetify?.Player;

  if (!player?.addEventListener) return;

  // Watchdog can call this again; detach previous handlers first so the
  // player never accumulates duplicates (which would double-record plays).
  if (player.removeEventListener) {
    const prevSong = win.__lsSongHandler as (() => void) | undefined;
    const prevPause = win.__lsPauseHandler as (() => void) | undefined;
    const prevProgress = win.__lsProgressHandler as (() => void) | undefined;
    if (prevSong) player.removeEventListener("songchange", prevSong);
    if (prevPause) player.removeEventListener("onplaypause", prevPause);
    if (prevProgress) player.removeEventListener("onprogress", prevProgress);
  }

  const songChangeHandler = () => {
    fsm
      ?.handleSongChange(
        player.data as Parameters<TrackingFSM["handleSongChange"]>[0],
      )
      .catch((err) => {
        console.warn("[listening-stats] songchange error:", err);
      });
  };

  const playPauseHandler = () => {
    const data = player.data as { isPaused?: boolean } | null | undefined;
    fsm?.handlePlayPause(data?.isPaused ?? true);
  };

  const progressHandler = () => {
    fsm?.handleProgress(
      player.getProgress?.() ?? 0,
      player.getDuration?.() ?? 0,
      player.getRepeat?.() ?? 0,
    );
  };

  player.addEventListener("songchange", songChangeHandler);
  player.addEventListener("onplaypause", playPauseHandler);
  player.addEventListener("onprogress", progressHandler);

  // Store refs on window for watchdog sentinel checking
  win.__lsSongHandler = songChangeHandler;
  win.__lsPauseHandler = playPauseHandler;
  win.__lsProgressHandler = progressHandler;
}

// ─── destroyPoller ────────────────────────────────────────────────────────────

/** Intentional no-op: local tracking stays enabled across provider switches. */
export function destroyPoller(): void {
  // intentional no-op
}
