import { PlayEvent, PollingData, ProviderType } from "../types/listeningstats";
import { addPlayEvent } from "./storage";

const STORAGE_KEY = "listening-stats:pollingData";
const LOGGING_KEY = "listening-stats:logging";
const SKIP_THRESHOLD_MS = 30000;
const STATS_UPDATED_EVENT = "listening-stats:updated";

let activeProviderType: ProviderType | null = null;

export function isLoggingEnabled(): boolean {
  try {
    return localStorage.getItem(LOGGING_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLoggingEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(LOGGING_KEY, "1");
    else localStorage.removeItem(LOGGING_KEY);
  } catch {
    /* ignore */
  }
}

function log(...args: any[]): void {
  if (isLoggingEnabled()) console.log("[ListeningStats]", ...args);
}

export function onStatsUpdated(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(STATS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(STATS_UPDATED_EVENT, handler);
}

function emitStatsUpdated(): void {
  window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT));
  localStorage.setItem("listening-stats:lastUpdate", Date.now().toString());
}

function defaultPollingData(): PollingData {
  return {
    hourlyDistribution: new Array(24).fill(0),
    activityDates: [],
    knownArtistUris: [],
    skipEvents: 0,
    totalPlays: 0,
    lastPollTimestamp: 0,
    trackPlayCounts: {},
    artistPlayCounts: {},
    seeded: false,
  };
}

export function getPollingData(): PollingData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        !Array.isArray(parsed.hourlyDistribution) ||
        parsed.hourlyDistribution.length !== 24
      ) {
        parsed.hourlyDistribution = new Array(24).fill(0);
      }
      if (!parsed.trackPlayCounts) parsed.trackPlayCounts = {};
      if (!parsed.artistPlayCounts) parsed.artistPlayCounts = {};
      if (parsed.seeded === undefined) parsed.seeded = false;
      return parsed;
    }
  } catch (error) {
    console.warn("[ListeningStats] Failed to load polling data:", error);
  }
  return defaultPollingData();
}

function savePollingData(data: PollingData): void {
  try {
    if (data.activityDates.length > 400) {
      data.activityDates = data.activityDates.slice(-365);
    }
    if (data.knownArtistUris.length > 5000) {
      data.knownArtistUris = data.knownArtistUris.slice(-5000);
    }
    const trackEntries = Object.entries(data.trackPlayCounts);
    if (trackEntries.length > 2000) {
      const sorted = trackEntries.sort((a, b) => b[1] - a[1]).slice(0, 2000);
      data.trackPlayCounts = Object.fromEntries(sorted);
    }
    const artistEntries = Object.entries(data.artistPlayCounts);
    if (artistEntries.length > 1000) {
      const sorted = artistEntries.sort((a, b) => b[1] - a[1]).slice(0, 1000);
      data.artistPlayCounts = Object.fromEntries(sorted);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("[ListeningStats] Failed to save polling data:", error);
  }
}

export function clearPollingData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

let currentTrackUri: string | null = null;
let playStartTime: number | null = null;
let accumulatedPlayTime = 0;
let isPlaying = false;
let currentTrackDuration = 0;

function handleSongChange(): void {
  if (currentTrackUri && playStartTime !== null) {
    const totalPlayedMs =
      accumulatedPlayTime + (isPlaying ? Date.now() - playStartTime : 0);
    const data = getPollingData();
    data.totalPlays++;

    const skipped =
      totalPlayedMs < SKIP_THRESHOLD_MS &&
      currentTrackDuration > SKIP_THRESHOLD_MS;
    if (skipped) {
      data.skipEvents++;
    }

    savePollingData(data);

    if (previousTrackData) {
      log(
        skipped ? "Skipped:" : "Tracked:",
        `${previousTrackData.artistName} - ${previousTrackData.trackName}`,
        `(${Math.round(totalPlayedMs / 1000)}s / ${Math.round(currentTrackDuration / 1000)}s)`,
      );
    }

    writePlayEvent(totalPlayedMs);
  }

  const playerData = Spicetify.Player.data;
  if (playerData?.item) {
    currentTrackUri = playerData.item.uri;
    currentTrackDuration =
      playerData.item.duration?.milliseconds ||
      Spicetify.Player.getDuration() ||
      0;
    playStartTime = Date.now();
    accumulatedPlayTime = 0;
    isPlaying = !playerData.isPaused;

    const meta = playerData.item.metadata;
    const name = playerData.item.name || meta?.title || "Unknown";
    const artist = meta?.artist_name || "Unknown";
    log("Now playing:", `${artist} - ${name}`);
  } else {
    currentTrackUri = null;
    playStartTime = null;
    accumulatedPlayTime = 0;
    isPlaying = false;
    currentTrackDuration = 0;
  }
}

let previousTrackData: {
  trackUri: string;
  trackName: string;
  artistName: string;
  artistUri: string;
  albumName: string;
  albumUri: string;
  albumArt?: string;
  durationMs: number;
  startedAt: number;
} | null = null;

function captureCurrentTrackData(): void {
  const playerData = Spicetify.Player.data;
  if (!playerData?.item) {
    previousTrackData = null;
    return;
  }
  const meta = playerData.item.metadata;
  previousTrackData = {
    trackUri: playerData.item.uri,
    trackName: playerData.item.name || meta?.title || "Unknown Track",
    artistName: meta?.artist_name || "Unknown Artist",
    artistUri: meta?.artist_uri || "",
    albumName: meta?.album_title || "Unknown Album",
    albumUri: meta?.album_uri || "",
    albumArt: meta?.image_url || meta?.image_xlarge_url,
    durationMs:
      playerData.item.duration?.milliseconds ||
      Spicetify.Player.getDuration() ||
      0,
    startedAt: Date.now(),
  };
}

function writePlayEvent(totalPlayedMs: number): void {
  if (!previousTrackData) return;

  const event: PlayEvent = {
    trackUri: previousTrackData.trackUri,
    trackName: previousTrackData.trackName,
    artistName: previousTrackData.artistName,
    artistUri: previousTrackData.artistUri,
    albumName: previousTrackData.albumName,
    albumUri: previousTrackData.albumUri,
    albumArt: previousTrackData.albumArt,
    durationMs: previousTrackData.durationMs,
    playedMs: totalPlayedMs,
    startedAt: previousTrackData.startedAt,
    endedAt: Date.now(),
  };

  addPlayEvent(event).catch((err) => {
    console.warn("[ListeningStats] Failed to write play event:", err);
  });

  if (activeProviderType === "local") {
    emitStatsUpdated();
  }
}

function handlePlayPause(): void {
  const wasPlaying = isPlaying;
  isPlaying = !Spicetify.Player.data?.isPaused;

  if (!currentTrackUri || playStartTime === null) return;

  if (wasPlaying && !isPlaying) {
    accumulatedPlayTime += Date.now() - playStartTime;
    log("Paused");
  } else if (!wasPlaying && isPlaying) {
    playStartTime = Date.now();
    log("Resumed");
  }
}

let pollIntervalId: number | null = null;
let activeSongChangeHandler: (() => void) | null = null;

export function initPoller(providerType: ProviderType): void {
  const win = window as any;

  // Remove any existing handler from another bundle (app.tsx vs index.tsx)
  if (win.__lsSongHandler) {
    Spicetify.Player.removeEventListener("songchange", win.__lsSongHandler);
  }
  if (win.__lsPauseHandler) {
    Spicetify.Player.removeEventListener("onplaypause", win.__lsPauseHandler);
  }

  activeProviderType = providerType;

  captureCurrentTrackData();
  activeSongChangeHandler = () => {
    handleSongChange();
    captureCurrentTrackData();
  };

  Spicetify.Player.addEventListener("songchange", activeSongChangeHandler);
  Spicetify.Player.addEventListener("onplaypause", handlePlayPause);

  // Store globally so either bundle can clean up
  win.__lsSongHandler = activeSongChangeHandler;
  win.__lsPauseHandler = handlePlayPause;

  const playerData = Spicetify.Player.data;
  if (playerData?.item) {
    currentTrackUri = playerData.item.uri;
    currentTrackDuration =
      playerData.item.duration?.milliseconds ||
      Spicetify.Player.getDuration() ||
      0;
    playStartTime = Date.now();
    isPlaying = !playerData.isPaused;
  }
}

export function destroyPoller(): void {
  if (activeSongChangeHandler) {
    Spicetify.Player.removeEventListener("songchange", activeSongChangeHandler);
    activeSongChangeHandler = null;
  }
  Spicetify.Player.removeEventListener("onplaypause", handlePlayPause);

  const win = window as any;
  win.__lsSongHandler = null;
  win.__lsPauseHandler = null;

  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  activeProviderType = null;
  previousTrackData = null;
}
