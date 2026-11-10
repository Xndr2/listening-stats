/** One row of `playEvents`. Field names and meaning are v2's; don't rename. */
export interface PlayEvent {
	id?: number; // auto-increment, absent on insert
	trackUri: string;
	trackName: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	albumArt?: string;
	durationMs: number;
	playedMs: number;
	startedAt: number; // Unix ms
	endedAt: number;
	type?: "play" | "skip";
	/** Imports only: null = not resolved yet, 0 = no match, timestamp = resolved */
	resolvedAt?: number | null;
}

/** Artist enrichment row (`artists` store). */
export interface ArtistRecord {
	uri: string;
	name: string;
	genres: string[];
	imageUrl: string | null;
	updatedAt: number;
}
