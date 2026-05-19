// API wrapper result
export type Result<T, E> = { ok: true; data: T; stale?: boolean } | { ok: false; error: E };

export type ApiError =
	| { type: "rate_limited"; retryAfter: number }
	| { type: "circuit_open" }
	| { type: "http_error"; status: number }
	| { type: "network_error"; message: string };

// Artist enrichment row in IDB
export interface ArtistRecord {
	uri: string; // "spotify:artist:xxxx" primary key
	name: string;
	genres: string[];
	imageUrl: string | null;
	updatedAt: number; // Unix ms
}

// Period boundary (Unix ms)
export interface PeriodBoundaries {
	start: number; // Unix ms, inclusive
	end: number; // Unix ms, exclusive
}

export interface Period {
	id: string; // e.g. "today", "this-week"
	label: string; // display label
	getBoundaries: () => PeriodBoundaries;
}

// Top-list row shapes
export interface TopTrack {
	rank: number;
	trackUri: string;
	trackName: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	albumArt?: string;
	count: number;
	durationMs: number;
}

export interface TopArtist {
	rank: number;
	artistUri: string;
	artistName: string;
	count: number;
	durationMs: number;
	genres?: string[];
	imageUrl?: string | null;
}

export interface TopAlbum {
	rank: number;
	albumUri: string;
	albumName: string;
	artistName: string;
	albumArt?: string;
	count: number;
	durationMs: number;
}

export interface TopGenre {
	rank: number;
	genre: string;
	count: number;
}

export interface RecentPlay {
	trackUri: string;
	trackName: string;
	artistName: string;
	albumArt?: string;
	playedAt: number; // Unix ms
}

// Aggregated stats for the dashboard
export interface StatsResult {
	topTracks: TopTrack[];
	topArtists: TopArtist[];
	topAlbums: TopAlbum[];
	topGenres: TopGenre[];
	totalPlays: number;
	totalDuration: number; // total ms
	recentPlays: RecentPlay[];
	hourlyDistribution: number[]; // 24-element array, index = hour (0-23), value = play count
	peakHour: number; // hour with most plays (0-23), 0 if no plays
	skipRate: number; // skips / (plays + skips), 0 if no events
	uniqueTrackCount: number; // count of distinct track URIs
	uniqueArtistCount: number; // count of distinct artist URIs
	streak?: number; // current listening streak in days; undefined = not computed; 0 = no active streak
	listeningDays?: number; // total days with at least one play; undefined = not computed
	weekdayDistribution?: number[]; // 7-element, index 0=Monday through 6=Sunday; undefined = not computed
	peakWeekday?: number; // index (0-6) with most plays; undefined = not computed
	hasListeningPatterns?: boolean; // true = /dates returned usable data; false/undefined = hide section
	dailyPlayCounts?: Array<{ date: string; count: number }>;
	// Prior-window metrics (undefined for all-time / insufficient history)
	newArtistCount?: number;
	priorPeriodTotalDuration?: number;
	/** True when the provider (stats.fm free) can't supply per-item play counts. UI hides misleading "0 plays". */
	isFreeTier?: boolean;
}
