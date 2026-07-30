export type WorldIndicator = "UP" | "DOWN" | "NONE" | "NEW";

export interface WorldTrack {
	readonly id: string;
	readonly title: string;
	readonly artist: string;
	readonly country: string;
	readonly plays: string;
	/** Rank movement vs previous chart window; `null` when unknown (hide UI). */
	readonly delta: number | null;
	/** stats.fm direction chip when available */
	readonly indicator?: WorldIndicator | null;
	/** Album or artist image URL when the chart API provides one */
	readonly artUrl?: string;
	readonly spotifyTrackId?: string;
	readonly spotifyArtistId?: string;
	readonly spotifyAlbumId?: string;
	/** stats.fm track id for detail lookup when chart row omits Spotify id */
	readonly statsFmTrackId?: number;
	readonly durationMs?: number;
	readonly explicit?: boolean;
	/** Artist chart: genre tags (max 2 shown) */
	readonly genres?: readonly string[];
	/** Album chart: release year */
	readonly albumYear?: number;
}

export type WorldScope = "world" | "us" | "gb" | "jp";
export type WorldWindow = "today" | "week" | "month" | "lifetime";

export type WorldChartDataSource = "statsfm" | "mytopspotify";

export type WorldChartKind = "track" | "artist" | "album";
