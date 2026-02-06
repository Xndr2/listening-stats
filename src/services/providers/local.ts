import { ListeningStats, PlayEvent, RecentTrack } from "../../types/listeningstats";
import { getPlayEventsByTimeRange, getAllPlayEvents, clearAllData } from "../storage";
import { getArtistsBatch, isApiAvailable } from "../spotify-api";
import { initPoller, destroyPoller, getPollingData } from "../tracker";
import type { TrackingProvider } from "./types";

const PERIODS = ["today", "this_week", "this_month", "all_time"] as const;

const PERIOD_LABELS: Record<string, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  all_time: "All Time",
};

export function createLocalProvider(): TrackingProvider {
  return {
    type: "local",
    periods: [...PERIODS],
    periodLabels: PERIOD_LABELS,
    defaultPeriod: "today",

    init() {
      initPoller("local");
    },

    destroy() {
      destroyPoller();
    },

    async calculateStats(period: string): Promise<ListeningStats> {
      const events = await getEventsForPeriod(period);
      return aggregateEvents(events);
    },

    clearData() {
      clearAllData();
    },
  };
}

function getTimeRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;

  switch (period) {
    case "today": {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "this_week": {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    default: // all_time
      start = new Date(0);
      break;
  }

  return { start, end };
}

async function getEventsForPeriod(period: string): Promise<PlayEvent[]> {
  if (period === "all_time") {
    return getAllPlayEvents();
  }
  const { start, end } = getTimeRange(period);
  return getPlayEventsByTimeRange(start, end);
}

async function aggregateEvents(events: PlayEvent[]): Promise<ListeningStats> {
  const pollingData = getPollingData();

  // Top tracks by play count
  const trackMap = new Map<string, {
    trackUri: string; trackName: string; artistName: string;
    albumArt?: string; count: number; totalMs: number;
  }>();
  for (const e of events) {
    const existing = trackMap.get(e.trackUri);
    if (existing) {
      existing.count++;
      existing.totalMs += e.playedMs;
    } else {
      trackMap.set(e.trackUri, {
        trackUri: e.trackUri, trackName: e.trackName,
        artistName: e.artistName, albumArt: e.albumArt,
        count: 1, totalMs: e.playedMs,
      });
    }
  }
  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t, i) => ({
      trackUri: t.trackUri,
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      rank: i + 1,
      totalTimeMs: t.totalMs,
      playCount: t.count,
    }));

  // Top artists by play count
  const artistMap = new Map<string, {
    artistUri: string; artistName: string; count: number;
  }>();
  for (const e of events) {
    const key = e.artistUri || e.artistName;
    const existing = artistMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      artistMap.set(key, {
        artistUri: e.artistUri, artistName: e.artistName, count: 1,
      });
    }
  }
  const topArtistAggregated = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Fetch artist details for images and genres (only if Spotify API is available)
  const artistIds = topArtistAggregated
    .map((a) => a.artistUri?.split(":")[2])
    .filter(Boolean);
  let artistDetails: any[] = [];
  if (artistIds.length > 0 && isApiAvailable()) {
    try {
      artistDetails = await getArtistsBatch(artistIds);
    } catch { /* graceful degradation without images */ }
  }
  const artistDetailMap = new Map(
    artistDetails.map((a) => [`spotify:artist:${a.id}`, a]),
  );

  const topArtists = topArtistAggregated.map((a, i) => {
    const detail = artistDetailMap.get(a.artistUri);
    return {
      artistUri: a.artistUri,
      artistName: a.artistName,
      artistImage: detail?.images?.[0]?.url,
      rank: i + 1,
      genres: (detail?.genres || []) as string[],
      playCount: a.count,
    };
  });

  // Top albums
  const albumMap = new Map<string, {
    albumUri: string; albumName: string; artistName: string;
    albumArt?: string; trackCount: number;
  }>();
  for (const e of events) {
    const existing = albumMap.get(e.albumUri);
    if (existing) {
      existing.trackCount++;
    } else {
      albumMap.set(e.albumUri, {
        albumUri: e.albumUri, albumName: e.albumName || "Unknown Album",
        artistName: e.artistName, albumArt: e.albumArt,
        trackCount: 1,
      });
    }
  }
  const topAlbums = Array.from(albumMap.values())
    .sort((a, b) => b.trackCount - a.trackCount)
    .slice(0, 10)
    .map((a) => ({
      ...a,
      playCount: a.trackCount,
    }));

  // Hourly distribution
  const hourlyDistribution = new Array(24).fill(0);
  for (const e of events) {
    const hour = new Date(e.startedAt).getHours();
    hourlyDistribution[hour] += e.playedMs;
  }

  // Genre aggregation
  const genreMap = new Map<string, number>();
  for (const a of topArtists) {
    for (const genre of a.genres) {
      genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
    }
  }
  const genres: Record<string, number> = {};
  for (const [g, c] of genreMap) genres[g] = c;
  const topGenres = Array.from(genreMap.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent tracks (last 50)
  const recent = events
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 50);
  const recentTracks: RecentTrack[] = recent.map((e) => ({
    trackUri: e.trackUri,
    trackName: e.trackName,
    artistName: e.artistName,
    artistUri: e.artistUri,
    albumName: e.albumName || "Unknown Album",
    albumUri: e.albumUri,
    albumArt: e.albumArt,
    durationMs: e.durationMs,
    playedAt: new Date(e.startedAt).toISOString(),
  }));

  // Unique counts
  const uniqueTrackUris = new Set(events.map((e) => e.trackUri));
  const uniqueArtistUris = new Set(events.map((e) => e.artistUri).filter(Boolean));

  // Activity dates for streak
  const dateSet = new Set(events.map((e) =>
    new Date(e.startedAt).toISOString().split("T")[0],
  ));

  const totalTimeMs = events.reduce((sum, e) => sum + e.playedMs, 0);

  // Skip rate from events: tracks played < 30s with duration > 30s
  let skipEvents = 0;
  for (const e of events) {
    if (e.playedMs < 30000 && e.durationMs > 30000) {
      skipEvents++;
    }
  }

  return {
    totalTimeMs,
    trackCount: events.length,
    uniqueTrackCount: uniqueTrackUris.size,
    uniqueArtistCount: uniqueArtistUris.size,
    topTracks,
    topArtists,
    topAlbums,
    hourlyDistribution,
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    recentTracks,
    genres,
    topGenres,
    streakDays: calculateStreak(Array.from(dateSet)),
    newArtistsCount: 0,
    skipRate: events.length > 0 ? skipEvents / events.length : 0,
    listenedDays: dateSet.size,
    lastfmConnected: false,
  };
}

function calculateStreak(activityDates: string[]): number {
  const dateSet = new Set(activityDates);
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (dateSet.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
