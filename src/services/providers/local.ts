import {
  ListeningStats,
  PlayEvent,
  RecentTrack,
} from "../../types/listeningstats";
import {
  getPlayEventsByTimeRange,
  getAllPlayEvents,
  clearAllData,
  resetDBPromise,
} from "../storage";
import { initPoller, destroyPoller } from "../tracker";
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
      resetDBPromise();
      initPoller("local");
    },

    destroy() {
      destroyPoller();
      resetDBPromise();
    },

    async calculateStats(period: string): Promise<ListeningStats> {
      const events = await getEventsForPeriod(period);
      // Streak is an all-time metric — fetch all events for it when not already all_time
      const allEvents = period === "all_time" ? events : await getAllPlayEvents();
      return aggregateEvents(events, allEvents);
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

async function aggregateEvents(events: PlayEvent[], allEvents: PlayEvent[]): Promise<ListeningStats> {
  // Separate completed plays from skips — rankings use only completed plays
  const completedEvents = events.filter(e => e.type !== "skip");

  // Top tracks by play count (completed plays only)
  const trackMap = new Map<
    string,
    {
      trackUri: string;
      trackName: string;
      artistName: string;
      albumArt?: string;
      count: number;
      totalMs: number;
    }
  >();
  for (const e of completedEvents) {
    const existing = trackMap.get(e.trackUri);
    if (existing) {
      existing.count++;
      existing.totalMs += e.playedMs;
    } else {
      trackMap.set(e.trackUri, {
        trackUri: e.trackUri,
        trackName: e.trackName,
        artistName: e.artistName,
        albumArt: e.albumArt,
        count: 1,
        totalMs: e.playedMs,
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

  // Top artists by play count (completed plays only)
  const artistMap = new Map<
    string,
    {
      artistUri: string;
      artistName: string;
      count: number;
    }
  >();
  for (const e of completedEvents) {
    const key = e.artistUri || e.artistName;
    const existing = artistMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      artistMap.set(key, {
        artistUri: e.artistUri,
        artistName: e.artistName,
        count: 1,
      });
    }
  }
  const topArtistAggregated = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topArtists = topArtistAggregated.map((a, i) => ({
    artistUri: a.artistUri,
    artistName: a.artistName,
    rank: i + 1,
    genres: [] as string[],
    playCount: a.count,
  }));

  // Top albums (completed plays only)
  const albumMap = new Map<
    string,
    {
      albumUri: string;
      albumName: string;
      artistName: string;
      albumArt?: string;
      trackCount: number;
    }
  >();
  for (const e of completedEvents) {
    const existing = albumMap.get(e.albumUri);
    if (existing) {
      existing.trackCount++;
    } else {
      albumMap.set(e.albumUri, {
        albumUri: e.albumUri,
        albumName: e.albumName || "Unknown Album",
        artistName: e.artistName,
        albumArt: e.albumArt,
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
  const recent = events.sort((a, b) => b.startedAt - a.startedAt).slice(0, 50);
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

  // Unique counts (completed plays only)
  const uniqueTrackUris = new Set(completedEvents.map((e) => e.trackUri));
  const uniqueArtistUris = new Set(
    completedEvents.map((e) => e.artistUri).filter(Boolean),
  );

  // Days listened: distinct days in the selected period
  const periodDates = new Set(
    events.map((e) => new Date(e.startedAt).toISOString().split("T")[0]),
  );

  // Streak: consecutive days from today using ALL events (cross-period metric)
  const allDates = Array.from(new Set(
    allEvents.map((e) => new Date(e.startedAt).toISOString().split("T")[0]),
  ));

  const totalTimeMs = events.reduce((sum, e) => sum + e.playedMs, 0);

  // Skip rate from event type (set by tracker based on play threshold)
  const skipEvents = events.length - completedEvents.length;

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
    streakDays: calculateStreak(allDates),
    newArtistsCount: 0,
    skipRate: events.length > 0 ? skipEvents / events.length : 0,
    listenedDays: periodDates.size,
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
