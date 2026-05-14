export interface WorldTrack {
	readonly id: string;
	readonly title: string;
	readonly artist: string;
	readonly country: string;
	readonly plays: string;
	/** Rank movement vs previous chart window; `null` when unknown (hide UI). */
	readonly delta: number | null;
	/** Album or artist image URL when the chart API provides one */
	readonly artUrl?: string;
	/** Spotify track id for enrichment (stripped before display) */
	readonly spotifyTrackId?: string;
}

/** Kept for persisted tab state compatibility; charts are global. */
export type WorldScope = "world" | "us" | "gb" | "jp";
export type WorldWindow = "today" | "week" | "month" | "lifetime";

export type WorldChartDataSource = "statsfm" | "mytopspotify" | "mock";
