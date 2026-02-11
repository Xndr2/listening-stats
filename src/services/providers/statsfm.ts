import { ListeningStats, RecentTrack } from "../../types/listeningstats";
import * as Statsfm from "../statsfm";
import { initPoller, destroyPoller, getPollingData } from "../tracker";
import type { TrackingProvider } from "./types";

const FREE_PERIODS = ["weeks", "months", "lifetime"] as const;
const FREE_LABELS: Record<string, string> = {
  weeks: "4 Weeks",
  months: "6 Months",
  lifetime: "Lifetime",
};

const PLUS_PERIODS = ["today", "days", "weeks", "months", "lifetime"] as const;
const PLUS_LABELS: Record<string, string> = {
  today: "Today",
  days: "This Week",
  weeks: "4 Weeks",
  months: "6 Months",
  lifetime: "Lifetime",
};

export function createStatsfmProvider(): TrackingProvider {
  const config = Statsfm.getConfig();
  const isPlus = config?.isPlus ?? false;
  const periods = isPlus ? [...PLUS_PERIODS] : [...FREE_PERIODS];
  const periodLabels = isPlus ? { ...PLUS_LABELS } : { ...FREE_LABELS };

  return {
    type: "statsfm",
    periods,
    periodLabels,
    defaultPeriod: "weeks",

    init() {
      initPoller("statsfm");
      // Fire-and-forget: detect tier upgrades between sessions
      Statsfm.refreshPlusStatus().catch(() => {/* ignore */});
    },

    destroy() {
      destroyPoller();
    },

    async calculateStats(period: string): Promise<ListeningStats> {
      try {
        return await calculateStatsfmStats(period as Statsfm.StatsfmRange);
      } catch (err: any) {
        // If a Plus-only range returned 400, user's tier may have changed
        if (
          err?.message?.includes("400") &&
          (period === "today" || period === "days")
        ) {
          const cfg = Statsfm.getConfig();
          if (cfg) {
            Statsfm.saveConfig({ ...cfg, isPlus: false });
          }
          return calculateStatsfmStats("weeks");
        }
        throw err;
      }
    },
  };
}

async function calculateStatsfmStats(
  range: Statsfm.StatsfmRange,
): Promise<ListeningStats> {
  const [
    topTracksRaw,
    topArtistsRaw,
    topAlbumsRaw,
    topGenresRaw,
    recentRaw,
    streamStats,
    dateStats,
  ] = await Promise.all([
    Statsfm.getTopTracks(range, 50),
    Statsfm.getTopArtists(range, 50),
    Statsfm.getTopAlbums(range, 50),
    Statsfm.getTopGenres(range, 20),
    Statsfm.getRecentStreams(50).catch(() => []),
    Statsfm.getStreamStats(range).catch(() => ({
      durationMs: 0,
      count: 0,
      cardinality: { tracks: 0, artists: 0, albums: 0 },
    })),
    Statsfm.getDateStats(range).catch(() => ({ hours: {} as Record<number, { durationMs: number; count: number }> })),
  ]);

  const pollingData = getPollingData();

  const topTracks = topTracksRaw.slice(0, 10).map((item, i) => ({
    trackUri: Statsfm.extractSpotifyUri(item.track.externalIds, "track"),
    trackName: item.track.name,
    artistName: item.track.artists?.[0]?.name || "Unknown Artist",
    albumArt: item.track.albums?.[0]?.image || undefined,
    rank: i + 1,
    totalTimeMs:
      item.playedMs ||
      (item.streams
        ? item.track.durationMs * item.streams
        : item.track.durationMs),
    playCount: item.streams ?? undefined,
  }));

  const topArtists = topArtistsRaw.slice(0, 10).map((item, i) => ({
    artistUri: Statsfm.extractSpotifyUri(item.artist.externalIds, "artist"),
    artistName: item.artist.name,
    artistImage: item.artist.image || undefined,
    rank: i + 1,
    genres: item.artist.genres || [],
    playCount: item.streams ?? undefined,
  }));

  // Top albums endpoint returns 400 for non-Plus users; derive from recent streams
  let topAlbums = topAlbumsRaw.slice(0, 10).map((item) => ({
    albumUri: Statsfm.extractSpotifyUri(item.album.externalIds, "album"),
    albumName: item.album.name,
    artistName: item.album.artists?.[0]?.name || "Unknown Artist",
    albumArt: item.album.image || undefined,
    trackCount: 0,
    playCount: item.streams ?? undefined,
  }));

  if (topAlbums.length === 0 && recentRaw.length > 0) {
    const albumMap = new Map<
      string,
      {
        albumName: string;
        artistName: string;
        albumArt?: string;
        count: number;
      }
    >();
    for (const item of recentRaw) {
      const album = item.track.albums?.[0];
      if (!album?.name) continue;
      const key = `${item.track.artists?.[0]?.name}|||${album.name}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        albumMap.set(key, {
          albumName: album.name,
          artistName: item.track.artists?.[0]?.name || "Unknown Artist",
          albumArt: album.image || undefined,
          count: 1,
        });
      }
    }
    topAlbums = Array.from(albumMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((a) => ({
        albumUri: "",
        albumName: a.albumName,
        artistName: a.artistName,
        albumArt: a.albumArt,
        trackCount: a.count,
        playCount: a.count,
      }));
  }

  const recentTracks: RecentTrack[] = recentRaw.map((item) => ({
    trackUri: Statsfm.extractSpotifyUri(item.track.externalIds, "track"),
    trackName: item.track.name,
    artistName: item.track.artists?.[0]?.name || "Unknown Artist",
    artistUri: item.track.artists?.[0]?.externalIds?.spotify?.[0]
      ? Statsfm.extractSpotifyUri(item.track.artists[0].externalIds, "artist")
      : "",
    albumName: item.track.albums?.[0]?.name || "",
    albumUri: "",
    albumArt: item.track.albums?.[0]?.image || undefined,
    durationMs: item.durationMs || item.track.durationMs,
    playedAt: new Date(item.endTime).toISOString(),
  }));

  const genres: Record<string, number> = {};
  for (const g of topGenresRaw) {
    genres[g.genre.tag] = g.streams ?? g.position;
  }
  const topGenres = topGenresRaw
    .slice(0, 10)
    .map((g) => ({ genre: g.genre.tag, count: g.streams ?? g.position }));

  let hourlyDistribution = new Array(24).fill(0);
  const hasDateStats = Object.keys(dateStats.hours).length > 0;
  if (hasDateStats) {
    for (const [hour, stat] of Object.entries(dateStats.hours)) {
      const h = parseInt(hour, 10);
      if (h >= 0 && h < 24) {
        hourlyDistribution[h] = stat.count;
      }
    }
  } else {
    // Fallback for non-Plus users where dateStats endpoint may fail
    for (const t of recentTracks) {
      const hour = new Date(t.playedAt).getHours();
      hourlyDistribution[hour]++;
    }
  }

  const uniqueTrackCount =
    streamStats.cardinality?.tracks ||
    new Set(
      topTracksRaw.map(
        (t) => `${t.track.artists?.[0]?.name}|||${t.track.name}`,
      ),
    ).size;
  const uniqueArtistCount =
    streamStats.cardinality?.artists ||
    new Set(topArtistsRaw.map((a) => a.artist.name)).size;

  const totalPlays = topTracksRaw.reduce((sum, t) => sum + (t.streams || 0), 0);
  const totalTimeMs = topTracksRaw.reduce(
    (sum, t) =>
      sum + (t.playedMs || (t.streams ? t.track.durationMs * t.streams : 0)),
    0,
  );

  const activityDates = [
    ...new Set(
      recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0]),
    ),
  ];

  return {
    totalTimeMs: streamStats.durationMs || totalTimeMs,
    trackCount: streamStats.count || totalPlays,
    uniqueTrackCount,
    uniqueArtistCount,
    topTracks,
    topArtists,
    topAlbums,
    hourlyDistribution,
    hourlyUnit: "plays",
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    recentTracks,
    genres,
    topGenres,
    streakDays: calculateStreak(activityDates),
    newArtistsCount: 0,
    skipRate:
      pollingData.totalPlays > 0
        ? pollingData.skipEvents / pollingData.totalPlays
        : 0,
    listenedDays: activityDates.length,
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
