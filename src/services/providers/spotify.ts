import { ListeningStats, RecentTrack } from "../../types/listeningstats";
import {
  getTopTracks,
  getTopArtists,
  getRecentlyPlayed,
  getArtistsBatch,
  prefetchPeriod as prefetchSpotifyPeriod,
} from "../spotify-api";
import { initPoller, destroyPoller, getPollingData } from "../tracker";
import * as LastFm from "../lastfm";
import type { TrackingProvider } from "./types";

const PERIODS = ["recent", "short_term", "medium_term", "long_term"] as const;

const PERIOD_LABELS: Record<string, string> = {
  recent: "Recent",
  short_term: "4 Weeks",
  medium_term: "6 Months",
  long_term: "All Time",
};

export function createSpotifyProvider(): TrackingProvider {
  return {
    type: "spotify",
    periods: [...PERIODS],
    periodLabels: PERIOD_LABELS,
    defaultPeriod: "recent",

    init() {
      initPoller("spotify");
    },

    destroy() {
      destroyPoller();
    },

    async calculateStats(period: string): Promise<ListeningStats> {
      if (period === "recent") {
        return calculateRecentStats();
      }
      return calculateRankedStats(period as "short_term" | "medium_term" | "long_term");
    },

    prefetchPeriod(period: string) {
      if (period !== "recent") {
        prefetchSpotifyPeriod(period as "short_term" | "medium_term" | "long_term");
      }
    },
  };
}

async function calculateRecentStats(): Promise<ListeningStats> {
  const lastfmConnected = LastFm.isConnected();

  const recentFetch = getRecentlyPlayed();
  const lfmInfoFetch = lastfmConnected
    ? LastFm.getUserInfo().catch(() => null)
    : Promise.resolve(null);

  const [response, lfmUserInfo] = await Promise.all([recentFetch, lfmInfoFetch]);
  const items = response?.items || [];
  const pollingData = getPollingData();

  const recentTracks: RecentTrack[] = items
    .filter((item) => item.track)
    .map((item) => ({
      trackUri: item.track.uri,
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      artistUri: item.track.artists?.[0]?.uri || "",
      albumName: item.track.album?.name || "Unknown Album",
      albumUri: item.track.album?.uri || "",
      albumArt: item.track.album?.images?.[0]?.url,
      durationMs: item.track.duration_ms,
      playedAt: item.played_at,
    }));

  // Aggregate top tracks
  const trackMap = new Map<string, {
    trackUri: string; trackName: string; artistName: string;
    albumArt?: string; count: number; durationMs: number;
  }>();
  for (const t of recentTracks) {
    const existing = trackMap.get(t.trackUri);
    if (existing) {
      existing.count++;
    } else {
      trackMap.set(t.trackUri, {
        trackUri: t.trackUri, trackName: t.trackName,
        artistName: t.artistName, albumArt: t.albumArt,
        count: 1, durationMs: t.durationMs,
      });
    }
  }
  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((t, i) => ({
      trackUri: t.trackUri, trackName: t.trackName,
      artistName: t.artistName, albumArt: t.albumArt,
      rank: i + 1, totalTimeMs: t.durationMs,
      playCount: pollingData.trackPlayCounts[t.trackUri] || undefined,
    }));

  // Aggregate top artists
  const artistMap = new Map<string, {
    artistUri: string; artistName: string; count: number;
  }>();
  for (const t of recentTracks) {
    const key = t.artistUri || t.artistName;
    const existing = artistMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      artistMap.set(key, {
        artistUri: t.artistUri, artistName: t.artistName, count: 1,
      });
    }
  }
  const topArtistAggregated = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const artistIds = topArtistAggregated
    .map((a) => a.artistUri?.split(":")[2])
    .filter(Boolean);
  const artistDetails = await getArtistsBatch(artistIds);
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
      genres: detail?.genres || [],
      playCount: pollingData.artistPlayCounts[a.artistUri] || undefined,
    };
  });

  // Aggregate top albums
  const albumMap = new Map<string, {
    albumUri: string; albumName: string; artistName: string;
    albumArt?: string; trackCount: number;
  }>();
  for (const t of recentTracks) {
    const existing = albumMap.get(t.albumUri);
    if (existing) {
      existing.trackCount++;
    } else {
      albumMap.set(t.albumUri, {
        albumUri: t.albumUri, albumName: t.albumName,
        artistName: t.artistName, albumArt: t.albumArt,
        trackCount: 1,
      });
    }
  }
  const topAlbums = Array.from(albumMap.values())
    .sort((a, b) => b.trackCount - a.trackCount)
    .slice(0, 10);

  // Hourly distribution
  const hourlyDistribution = new Array(24).fill(0);
  for (const t of recentTracks) {
    const hour = new Date(t.playedAt).getHours();
    hourlyDistribution[hour] += t.durationMs;
  }
  for (let h = 0; h < 24; h++) {
    hourlyDistribution[h] += pollingData.hourlyDistribution[h];
  }

  const { genres, topGenres } = aggregateGenres(topArtists);

  const uniqueTrackUris = new Set(recentTracks.map((t) => t.trackUri));
  const uniqueArtistUris = new Set(recentTracks.map((t) => t.artistUri).filter(Boolean));

  const knownSet = new Set(pollingData.knownArtistUris);
  let newArtistsCount = 0;
  for (const uri of uniqueArtistUris) {
    if (!knownSet.has(uri)) newArtistsCount++;
  }

  return {
    totalTimeMs: recentTracks.reduce((sum, t) => sum + t.durationMs, 0),
    trackCount: recentTracks.length,
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
    streakDays: calculateStreak(pollingData.activityDates),
    newArtistsCount,
    skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
    listenedDays: new Set(pollingData.activityDates).size,
    lastfmConnected: LastFm.isConnected(),
    totalScrobbles: lfmUserInfo?.totalScrobbles,
  };
}

async function calculateRankedStats(
  period: "short_term" | "medium_term" | "long_term",
): Promise<ListeningStats> {
  const lastfmConnected = LastFm.isConnected();
  const lastfmPeriod = LastFm.mapPeriod(period);

  const spotifyFetch = Promise.all([
    getTopTracks(period),
    getTopArtists(period),
    getRecentlyPlayed(),
  ]);

  const lastfmFetch = lastfmConnected
    ? Promise.all([
        LastFm.getTopTracks(lastfmPeriod, 200).catch(() => ({ tracks: [] as LastFm.LastfmTrack[], total: 0 })),
        LastFm.getTopArtists(lastfmPeriod, 100).catch(() => ({ artists: [] as LastFm.LastfmArtist[], total: 0 })),
        LastFm.getTopAlbums(lastfmPeriod, 100).catch(() => ({ albums: [] as LastFm.LastfmAlbum[], total: 0 })),
        LastFm.getUserInfo().catch(() => null),
      ])
    : null;

  const [spotify, lastfm] = await Promise.all([spotifyFetch, lastfmFetch]);

  const [tracks, artists, recentResponse] = spotify;
  const lfmTracks = lastfm?.[0]?.tracks ?? [];
  const lfmArtists = lastfm?.[1]?.artists ?? [];
  const lfmAlbums = lastfm?.[2]?.albums ?? [];
  const lfmUserInfo = lastfm?.[3] ?? null;

  const trackPlayCountMap = LastFm.buildTrackPlayCountMap(lfmTracks);
  const artistPlayCountMap = LastFm.buildArtistPlayCountMap(lfmArtists);
  const albumPlayCountMap = LastFm.buildAlbumPlayCountMap(lfmAlbums);

  const pollingData = getPollingData();

  // Map top tracks with play counts
  const topTracks = (tracks || []).slice(0, 10).map((t, i) => {
    const artistName = t.artists?.[0]?.name || "Unknown Artist";
    let playCount: number | undefined;

    if (lastfmConnected && lfmTracks.length > 0) {
      playCount = trackPlayCountMap.get(LastFm.makeTrackKey(artistName, t.name));
    }
    if (playCount === undefined) {
      playCount = pollingData.trackPlayCounts[t.uri] || undefined;
    }

    return {
      trackUri: t.uri,
      trackName: t.name,
      artistName,
      albumArt: t.album?.images?.[0]?.url,
      rank: i + 1,
      totalTimeMs: t.duration_ms,
      playCount,
    };
  });

  // Map top artists with play counts
  const topArtists = (artists || []).slice(0, 10).map((a, i) => {
    let playCount: number | undefined;

    if (lastfmConnected && lfmArtists.length > 0) {
      playCount = artistPlayCountMap.get(LastFm.normalize(a.name));
    }
    if (playCount === undefined) {
      const uri = `spotify:artist:${a.id}`;
      playCount = pollingData.artistPlayCounts[uri] || undefined;
    }

    return {
      artistUri: `spotify:artist:${a.id}`,
      artistName: a.name,
      artistImage: a.images?.[0]?.url,
      rank: i + 1,
      genres: a.genres || [],
      playCount,
    };
  });

  // Derive top albums
  const albumMap = new Map<string, {
    albumUri: string; albumName: string; artistName: string;
    albumArt?: string; trackCount: number; playCount?: number;
  }>();
  for (const t of tracks || []) {
    const albumUri = t.album?.uri;
    if (!albumUri) continue;
    const existing = albumMap.get(albumUri);
    if (existing) {
      existing.trackCount++;
    } else {
      const artistName = t.album.artists?.[0]?.name || "Unknown Artist";
      let playCount: number | undefined;
      if (lastfmConnected && lfmAlbums.length > 0) {
        const key = `${LastFm.normalize(artistName)}|||${LastFm.normalize(t.album.name)}`;
        playCount = albumPlayCountMap.get(key);
      }
      albumMap.set(albumUri, {
        albumUri, albumName: t.album.name, artistName,
        albumArt: t.album.images?.[0]?.url, trackCount: 1, playCount,
      });
    }
  }
  const topAlbums = Array.from(albumMap.values())
    .sort((a, b) => b.trackCount - a.trackCount)
    .slice(0, 10);

  // Recent tracks
  const recentItems = recentResponse?.items || [];
  const recentTracks: RecentTrack[] = recentItems
    .filter((item) => item.track)
    .map((item) => ({
      trackUri: item.track.uri,
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      artistUri: item.track.artists?.[0]?.uri || "",
      albumName: item.track.album?.name || "Unknown Album",
      albumUri: item.track.album?.uri || "",
      albumArt: item.track.album?.images?.[0]?.url,
      durationMs: item.track.duration_ms,
      playedAt: item.played_at,
    }));

  const hourlyDistribution = [...pollingData.hourlyDistribution];
  const { genres, topGenres } = aggregateGenres(topArtists);

  const uniqueArtistUris = new Set(
    (tracks || []).flatMap((t) => t.artists?.map((a) => a.uri) || []),
  );

  const knownSet = new Set(pollingData.knownArtistUris);
  let newArtistsCount = 0;
  for (const a of artists || []) {
    const uri = `spotify:artist:${a.id}`;
    if (!knownSet.has(uri)) newArtistsCount++;
  }

  return {
    totalTimeMs: (tracks || []).reduce((sum, t) => sum + t.duration_ms, 0),
    trackCount: (tracks || []).length,
    uniqueTrackCount: (tracks || []).length,
    uniqueArtistCount: uniqueArtistUris.size,
    topTracks,
    topArtists,
    topAlbums,
    hourlyDistribution,
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    recentTracks,
    genres,
    topGenres,
    streakDays: calculateStreak(pollingData.activityDates),
    newArtistsCount,
    skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
    listenedDays: new Set(pollingData.activityDates).size,
    lastfmConnected,
    totalScrobbles: lfmUserInfo?.totalScrobbles,
  };
}

function aggregateGenres(
  topArtists: Array<{ genres: string[] }>,
): { genres: Record<string, number>; topGenres: Array<{ genre: string; count: number }> } {
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

  return { genres, topGenres };
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
