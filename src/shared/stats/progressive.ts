import type { StatsResult } from "../types/stats";
import type { AppError } from "../errors";

export type SectionSlotStatus = "pending" | "loading" | "resolved" | "error";

export interface SectionSlots {
	overview: SectionSlotStatus;
	lists: SectionSlotStatus;
	activity: SectionSlotStatus;
	consistency: SectionSlotStatus;
}

export type WaveId = 1 | 2 | 3;

export type WaveCallback = (partial: Partial<StatsResult>, wave: WaveId, error?: AppError) => void;

export function allLoading(): SectionSlots {
	return { overview: "loading", lists: "loading", activity: "loading", consistency: "loading" };
}

export function allResolved(): SectionSlots {
	return { overview: "resolved", lists: "resolved", activity: "resolved", consistency: "resolved" };
}

export const EMPTY_STATS: StatsResult = {
	topTracks: [],
	topArtists: [],
	topAlbums: [],
	topGenres: [],
	totalPlays: 0,
	totalDuration: 0,
	recentPlays: [],
	hourlyDistribution: new Array(24).fill(0) as number[],
	peakHour: 0,
	skipRate: 0,
	uniqueTrackCount: 0,
	uniqueArtistCount: 0,
};

export function slotKeyForWave(wave: WaveId): keyof SectionSlots {
	switch (wave) {
		case 1: return "overview";
		case 2: return "lists";
		case 3: return "activity";
	}
}
