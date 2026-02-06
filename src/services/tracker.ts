import { PlayEvent, PollingData, ProviderType } from "../types/listeningstats";
import { getRecentlyPlayed, getTopArtists } from "./spotify-api";
import { addPlayEvent } from "./storage";

const STORAGE_KEY = "listening-stats:pollingData";
const POLL_INTERVAL_MS = 15 * 60 * 1000;
const SKIP_THRESHOLD_MS = 30000;
const STATS_UPDATED_EVENT = "listening-stats:updated";

let activeProviderType: ProviderType | null = null;

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
      if (!Array.isArray(parsed.hourlyDistribution) || parsed.hourlyDistribution.length !== 24) {
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

async function seedKnownArtists(data: PollingData): Promise<void> {
  if (data.seeded) return;

  try {
    const artists = await getTopArtists("long_term");
    if (!artists || !artists.length) return;

    const knownSet = new Set(data.knownArtistUris);
    for (const a of artists) {
      const uri = `spotify:artist:${a.id}`;
      knownSet.add(uri);
    }

    data.knownArtistUris = Array.from(knownSet);
    data.seeded = true;
    savePollingData(data);
  } catch (error) {
    console.warn("[ListeningStats] Failed to seed known artists:", error);
  }
}

async function pollRecentlyPlayed(): Promise<void> {
  try {
    const response = await getRecentlyPlayed();
    if (!response?.items?.length) return;

    const data = getPollingData();
    const lastPoll = data.lastPollTimestamp;
    const knownSet = new Set(data.knownArtistUris);
    const dateSet = new Set(data.activityDates);

    for (const item of response.items) {
      const playedAt = new Date(item.played_at).getTime();
      if (lastPoll > 0 && playedAt <= lastPoll) continue;

      const track = item.track;
      if (!track) continue;

      const hour = new Date(item.played_at).getHours();
      data.hourlyDistribution[hour] += track.duration_ms;

      const dateKey = new Date(item.played_at).toISOString().split("T")[0];
      dateSet.add(dateKey);

      data.trackPlayCounts[track.uri] = (data.trackPlayCounts[track.uri] || 0) + 1;

      const artistUri = track.artists?.[0]?.uri;
      if (artistUri) {
        data.artistPlayCounts[artistUri] = (data.artistPlayCounts[artistUri] || 0) + 1;
        knownSet.add(artistUri);
      }
    }

    data.activityDates = Array.from(dateSet);
    data.knownArtistUris = Array.from(knownSet);

    const latestTimestamp = Math.max(
      ...response.items.map((item) => new Date(item.played_at).getTime()),
    );
    if (latestTimestamp > data.lastPollTimestamp) {
      data.lastPollTimestamp = latestTimestamp;
    }

    savePollingData(data);
    emitStatsUpdated();
  } catch (error) {
    console.warn("[ListeningStats] Poll failed:", error);
  }
}

let currentTrackUri: string | null = null;
let playStartTime: number | null = null;
let accumulatedPlayTime = 0;
let isPlaying = false;
let currentTrackDuration = 0;

function handleSongChange(): void {
  if (currentTrackUri && playStartTime !== null) {
    const totalPlayedMs = accumulatedPlayTime + (isPlaying ? Date.now() - playStartTime : 0);
    const data = getPollingData();
    data.totalPlays++;

    if (totalPlayedMs < SKIP_THRESHOLD_MS && currentTrackDuration > SKIP_THRESHOLD_MS) {
      data.skipEvents++;
    }

    savePollingData(data);

    if (activeProviderType === "local") {
      writePlayEvent(totalPlayedMs);
    }
  }

  const playerData = Spicetify.Player.data;
  if (playerData?.item) {
    currentTrackUri = playerData.item.uri;
    currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
    playStartTime = Date.now();
    accumulatedPlayTime = 0;
    isPlaying = !playerData.isPaused;
  } else {
    currentTrackUri = null;
    playStartTime = null;
    accumulatedPlayTime = 0;
    isPlaying = false;
    currentTrackDuration = 0;
  }
}

let previousTrackData: {
  trackUri: string; trackName: string; artistName: string;
  artistUri: string; albumName: string; albumUri: string;
  albumArt?: string; durationMs: number; startedAt: number;
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
    durationMs: playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0,
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

  emitStatsUpdated();
}

function handlePlayPause(): void {
  const wasPlaying = isPlaying;
  isPlaying = !Spicetify.Player.data?.isPaused;

  if (!currentTrackUri || playStartTime === null) return;

  if (wasPlaying && !isPlaying) {
    accumulatedPlayTime += Date.now() - playStartTime;
  } else if (!wasPlaying && isPlaying) {
    playStartTime = Date.now();
  }
}

let pollIntervalId: number | null = null;
let activeSongChangeHandler: (() => void) | null = null;

export function initPoller(providerType: ProviderType): void {
  activeProviderType = providerType;

  if (providerType === "local") {
    captureCurrentTrackData();
    activeSongChangeHandler = () => {
      handleSongChange();
      captureCurrentTrackData();
    };
  } else {
    activeSongChangeHandler = handleSongChange;
  }

  Spicetify.Player.addEventListener("songchange", activeSongChangeHandler);
  Spicetify.Player.addEventListener("onplaypause", handlePlayPause);

  const playerData = Spicetify.Player.data;
  if (playerData?.item) {
    currentTrackUri = playerData.item.uri;
    currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
    playStartTime = Date.now();
    isPlaying = !playerData.isPaused;
  }

  if (providerType === "spotify") {
    setTimeout(() => {
      const data = getPollingData();
      seedKnownArtists(data).then(() => pollRecentlyPlayed());
    }, 5000);

    pollIntervalId = window.setInterval(pollRecentlyPlayed, POLL_INTERVAL_MS);
  }
}

export function destroyPoller(): void {
  if (activeSongChangeHandler) {
    Spicetify.Player.removeEventListener("songchange", activeSongChangeHandler);
    activeSongChangeHandler = null;
  }
  Spicetify.Player.removeEventListener("onplaypause", handlePlayPause);
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  activeProviderType = null;
  previousTrackData = null;
}
