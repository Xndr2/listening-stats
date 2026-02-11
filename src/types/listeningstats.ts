export type ProviderType = "local" | "lastfm" | "statsfm";

export type TimePeriod = string;

export interface RecentTrack {
  trackUri: string;
  trackName: string;
  artistName: string;
  artistUri: string;
  albumName: string;
  albumUri: string;
  albumArt?: string;
  durationMs: number;
  playedAt: string;
}

export interface ListeningStats {
  totalTimeMs: number;
  trackCount: number;
  uniqueTrackCount: number;
  uniqueArtistCount: number;
  topTracks: Array<{
    trackUri: string;
    trackName: string;
    artistName: string;
    albumArt?: string;
    rank: number;
    totalTimeMs: number;
    playCount?: number;
  }>;
  topArtists: Array<{
    artistUri: string;
    artistName: string;
    artistImage?: string;
    rank: number;
    genres: string[];
    playCount?: number;
  }>;
  topAlbums: Array<{
    albumUri: string;
    albumName: string;
    artistName: string;
    albumArt?: string;
    trackCount: number;
    playCount?: number;
  }>;
  hourlyDistribution: number[];
  hourlyUnit?: "ms" | "plays";
  peakHour: number;
  recentTracks: RecentTrack[];
  genres: Record<string, number>;
  topGenres: Array<{ genre: string; count: number }>;
  streakDays: number;
  newArtistsCount: number;
  skipRate: number;
  listenedDays: number;
  lastfmConnected: boolean;
  totalScrobbles?: number;
}

export interface PollingData {
  hourlyDistribution: number[];
  activityDates: string[];
  knownArtistUris: string[];
  skipEvents: number;
  totalPlays: number;
  lastPollTimestamp: number;
  trackPlayCounts: Record<string, number>;
  artistPlayCounts: Record<string, number>;
  seeded: boolean;
}

export interface LastfmConfig {
  username: string;
  apiKey: string;
}

export interface StatsfmConfig {
  username: string;
  isPlus?: boolean;
}

export interface PlayEvent {
  id?: number;
  trackUri: string;
  trackName: string;
  artistName: string;
  artistUri: string;
  albumName: string;
  albumUri: string;
  albumArt?: string;
  durationMs: number;
  playedMs: number;
  startedAt: number;
  endedAt: number;
  type?: "play" | "skip";
}
