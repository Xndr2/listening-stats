import { ListeningStats, RecentTrack } from "../../types/listeningstats";
import * as LastFm from "../lastfm";
import { searchArtist } from "../spotify-api";
import { initPoller, destroyPoller, getPollingData } from "../tracker";
import type { TrackingProvider } from "./types";

const PERIODS = [
  "recent",
  "7day",
  "1month",
  "3month",
  "6month",
  "12month",
  "overall",
] as const;

const PERIOD_LABELS: Record<string, string> = {
  recent: "Recent",
  "7day": "7 Days",
  "1month": "1 Month",
  "3month": "3 Months",
  "6month": "6 Months",
  "12month": "12 Months",
  overall: "Overall",
};

export function createLastfmProvider(): TrackingProvider {
  return {
    type: "lastfm",
    periods: [...PERIODS],
    periodLabels: PERIOD_LABELS,
    defaultPeriod: "recent",

    init() {
      initPoller("lastfm");
    },

    destroy() {
      destroyPoller();
    },

    async calculateStats(period: string): Promise<ListeningStats> {
      if (period === "recent") {
        return calculateRecentStats();
      }
      return calculateRankedStats(period);
    },
  };
}

async function enrichArtistImages(
  artists: Array<{
    artistUri: string;
    artistName: string;
    artistImage?: string;
  }>,
): Promise<void> {
  const needsImage = artists.filter((a) => !a.artistImage);
  if (needsImage.length === 0) return;
  const results = await Promise.all(
    needsImage.map((a) => searchArtist(a.artistName)),
  );
  needsImage.forEach((a, i) => {
    if (results[i].uri && !a.artistUri) a.artistUri = results[i].uri!;
    if (results[i].imageUrl) a.artistImage = results[i].imageUrl!;
  });
}

async function calculateRecentStats(): Promise<ListeningStats> {
  const [recentLfm, userInfo] = await Promise.all([
    LastFm.getRecentTracks(50),
    LastFm.getUserInfo().catch(() => null),
  ]);

  const pollingData = getPollingData();

  const recentTracks: RecentTrack[] = recentLfm
    .filter((t) => !t.nowPlaying)
    .map((t) => ({
      trackUri: "",
      trackName: t.name,
      artistName: t.artist,
      artistUri: "",
      albumName: t.album,
      albumUri: "",
      albumArt: t.albumArt,
      durationMs: 0,
      playedAt: t.playedAt,
    }));

  const trackMap = new Map<
    string,
    {
      trackName: string;
      artistName: string;
      albumArt?: string;
      count: number;
    }
  >();
  for (const t of recentTracks) {
    const key = `${t.artistName}|||${t.trackName}`;
    const existing = trackMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      trackMap.set(key, {
        trackName: t.trackName,
        artistName: t.artistName,
        albumArt: t.albumArt,
        count: 1,
      });
    }
  }
  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t, i) => ({
      trackUri: "",
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      rank: i + 1,
      totalTimeMs: 0,
      playCount: t.count,
    }));

  const artistMap = new Map<string, { artistName: string; count: number }>();
  for (const t of recentTracks) {
    const existing = artistMap.get(t.artistName);
    if (existing) {
      existing.count++;
    } else {
      artistMap.set(t.artistName, { artistName: t.artistName, count: 1 });
    }
  }
  const topArtists = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((a, i) => ({
      artistUri: "",
      artistName: a.artistName,
      artistImage: undefined as string | undefined,
      rank: i + 1,
      genres: [] as string[],
      playCount: a.count,
    }));

  const albumMap = new Map<
    string,
    {
      albumName: string;
      artistName: string;
      albumArt?: string;
      count: number;
    }
  >();
  for (const t of recentTracks) {
    if (!t.albumName) continue;
    const key = `${t.artistName}|||${t.albumName}`;
    const existing = albumMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      albumMap.set(key, {
        albumName: t.albumName,
        artistName: t.artistName,
        albumArt: t.albumArt,
        count: 1,
      });
    }
  }
  const topAlbums = Array.from(albumMap.values())
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

  await enrichArtistImages(topArtists);

  const hourlyDistribution = new Array(24).fill(0);
  for (const t of recentTracks) {
    const hour = new Date(t.playedAt).getHours();
    hourlyDistribution[hour]++;
  }

  const uniqueTrackNames = new Set(
    recentTracks.map((t) => `${t.artistName}|||${t.trackName}`),
  );
  const uniqueArtistNames = new Set(recentTracks.map((t) => t.artistName));

  // Estimate total time from scrobble timestamps.
  // Use the gap between consecutive scrobbles as the track duration estimate,
  // but only when the gap looks like a single track (≤ 6 min). Larger gaps
  // indicate a session break — fall back to a 3.5 min average for those.
  let estimatedTimeMs = 0;
  const sorted = [...recentTracks].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );
  const SESSION_GAP_MS = 6 * 60 * 1000;
  const AVG_TRACK_MS = 210_000;
  for (let i = 0; i < sorted.length; i++) {
    if (i < sorted.length - 1) {
      const gap =
        new Date(sorted[i + 1].playedAt).getTime() -
        new Date(sorted[i].playedAt).getTime();
      estimatedTimeMs += gap > 0 && gap <= SESSION_GAP_MS ? gap : AVG_TRACK_MS;
    } else {
      estimatedTimeMs += AVG_TRACK_MS;
    }
  }

  const activityDates = [
    ...new Set(
      recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0]),
    ),
  ];

  return {
    totalTimeMs: estimatedTimeMs,
    trackCount: recentTracks.length,
    uniqueTrackCount: uniqueTrackNames.size,
    uniqueArtistCount: uniqueArtistNames.size,
    topTracks,
    topArtists,
    topAlbums,
    hourlyDistribution,
    hourlyUnit: "plays",
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    recentTracks,
    genres: {},
    topGenres: [],
    streakDays: calculateStreak(activityDates),
    newArtistsCount: 0,
    skipRate:
      pollingData.totalPlays > 0
        ? pollingData.skipEvents / pollingData.totalPlays
        : 0,
    listenedDays: activityDates.length,
    lastfmConnected: true,
    totalScrobbles: userInfo?.totalScrobbles,
  };
}

async function calculateRankedStats(period: string): Promise<ListeningStats> {
  const [
    lfmTracksResult,
    lfmArtistsResult,
    lfmAlbumsResult,
    recentLfm,
    userInfo,
  ] = await Promise.all([
    LastFm.getTopTracks(period, 50),
    LastFm.getTopArtists(period, 50),
    LastFm.getTopAlbums(period, 50),
    LastFm.getRecentTracks(50).catch(() => []),
    LastFm.getUserInfo().catch(() => null),
  ]);

  const lfmTracks = lfmTracksResult.tracks;
  const lfmArtists = lfmArtistsResult.artists;
  const lfmAlbums = lfmAlbumsResult.albums;
  const pollingData = getPollingData();

  const topTracks = lfmTracks.slice(0, 10).map((t, i) => ({
    trackUri: "",
    trackName: t.name,
    artistName: t.artist,
    albumArt: t.imageUrl,
    rank: i + 1,
    totalTimeMs: (t.durationSecs || 0) * 1000,
    playCount: t.playCount,
  }));

  const topArtists = lfmArtists.slice(0, 10).map((a, i) => ({
    artistUri: "",
    artistName: a.name,
    artistImage: a.imageUrl,
    rank: i + 1,
    genres: [] as string[],
    playCount: a.playCount,
  }));

  const topAlbums = lfmAlbums.slice(0, 10).map((a) => ({
    albumUri: "",
    albumName: a.name,
    artistName: a.artist,
    albumArt: a.imageUrl,
    trackCount: 0,
    playCount: a.playCount,
  }));

  await enrichArtistImages(topArtists);

  const recentTracks: RecentTrack[] = (
    Array.isArray(recentLfm) ? recentLfm : []
  )
    .filter((t) => !t.nowPlaying)
    .map((t) => ({
      trackUri: "",
      trackName: t.name,
      artistName: t.artist,
      artistUri: "",
      albumName: t.album,
      albumUri: "",
      albumArt: t.albumArt,
      durationMs: 0,
      playedAt: t.playedAt,
    }));

  const hourlyDistribution = new Array(24).fill(0);

  const totalPlays = lfmTracks.reduce((sum, t) => sum + t.playCount, 0);
  const totalTimeMs = lfmTracks.reduce(
    (sum, t) => sum + (t.durationSecs || 210) * 1000 * t.playCount,
    0,
  );

  const activityDates = [
    ...new Set(
      recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0]),
    ),
  ];

  return {
    totalTimeMs,
    trackCount: totalPlays,
    uniqueTrackCount: lfmTracksResult.total,
    uniqueArtistCount: lfmArtistsResult.total,
    topTracks,
    topArtists,
    topAlbums,
    hourlyDistribution,
    hourlyUnit: "plays",
    peakHour: 0,
    recentTracks,
    genres: {},
    topGenres: [],
    streakDays: calculateStreak(activityDates),
    newArtistsCount: 0,
    skipRate:
      pollingData.totalPlays > 0
        ? pollingData.skipEvents / pollingData.totalPlays
        : 0,
    listenedDays: activityDates.length,
    lastfmConnected: true,
    totalScrobbles: userInfo?.totalScrobbles,
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
