export interface SfmUserPublic {
	id: string;
	customId: string;
	displayName: string;
	image: string;
	isPlus: boolean;
	isPro: boolean;
	privacySettings: SfmUserPrivacySettings;
}

export interface SfmUserPrivacySettings {
	profile: boolean;
	currentlyPlaying: boolean;
	recentlyPlayed: boolean;
	topTracks: boolean;
	topArtists: boolean;
	topAlbums: boolean;
	topGenres: boolean;
	streams: boolean;
	streamStats: boolean;
}

export interface SfmTopTrack {
	position: number;
	streams: number;
	playedMs?: number;
	track: {
		name: string;
		durationMs: number;
		externalIds: { spotify?: string[] };
		albums: Array<{ name: string; image: string; externalIds: { spotify?: string[] } }>;
		artists: Array<{ name: string; externalIds: { spotify?: string[] } }>;
	};
}

export interface SfmTopArtist {
	position: number;
	streams: number;
	playedMs?: number;
	artist: {
		name: string;
		image?: string;
		genres: string[];
		externalIds: { spotify?: string[] };
	};
}

export interface SfmTopAlbum {
	position: number;
	streams: number;
	playedMs?: number;
	album: {
		name: string;
		image: string;
		artists: Array<{ name: string }>;
		externalIds: { spotify?: string[] };
	};
}

export interface SfmTopGenre {
	position: number;
	streams: number;
	genre: { tag: string };
}

export interface SfmRecentStream {
	endTime: string; // ISO 8601
	platform: "SPOTIFY" | "APPLEMUSIC" | string;
	track: SfmTopTrack["track"];
}

export interface SfmStreamStats {
	durationMs: number;
	count: number;
	cardinality: {
		tracks: number;
		artists: number;
		albums: number;
	};
}

export interface SfmPerDayStats {
	average: { count: number; durationMs: number };
	days: Record<string, { count: number; durationMs: number }>;
}

export interface SfmDateEntry {
	count: number;
	durationMs: number;
}

export interface SfmDateStats {
	hours: Record<number, SfmDateEntry>;
	weekDays: Record<number, SfmDateEntry>;
	months: Record<number, SfmDateEntry>;
	years: Record<number, SfmDateEntry>;
}
