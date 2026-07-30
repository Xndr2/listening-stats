export interface PlayEvent {
	id?: number; // auto-increment, undefined on insert
	trackUri: string;
	trackName: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	albumArt?: string;
	durationMs: number;
	playedMs: number;
	startedAt: number; // Unix ms timestamp
	endedAt: number;
	type?: "play" | "skip";
	resolvedAt?: number | null; // null=not attempted, 0=no match found, timestamp=resolved
}
