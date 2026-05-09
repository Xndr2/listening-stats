export interface WorldTrack {
	readonly id: string;
	readonly title: string;
	readonly artist: string;
	readonly country: string;
	readonly plays: string;
	readonly delta: number;
}

export type WorldScope = "world" | "us" | "gb" | "jp";
export type WorldWindow = "today" | "week";
