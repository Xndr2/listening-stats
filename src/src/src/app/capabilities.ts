import type { ProviderCapabilities } from "../shared/stats/provider";

export interface SectionConfig {
	id: string;
	label: string;
}

export interface TileConfig {
	id: string;
	label: string;
	available: boolean;
}

const ALL_SECTIONS: SectionConfig[] = [
	{ id: "overview", label: "Overview" },
	{ id: "top-genres", label: "Top Genres" },
	{ id: "top-lists", label: "Top Lists" },
	{ id: "activity", label: "Activity" },
	{ id: "consistency", label: "Consistency" },
	{ id: "recently-played", label: "Recently Played" },
];

const LOCAL_TILES: readonly string[] = [
	"tracks",
	"unique-artists",
	"streak",
	"new-artists",
	"peak-hour",
	"skip-rate",
	"est-payout",
];

const STATSFM_TILES: readonly string[] = ["unique-artists", "new-artists", "top-genre", "est-payout"];

const TILE_LABELS: Record<string, string> = {
	tracks: "Tracks",
	"unique-artists": "Unique Artists",
	streak: "Streak",
	"new-artists": "New Artists",
	"peak-hour": "Peak Hour",
	"skip-rate": "Skip Rate",
	"est-payout": "Est. Payout",
	"top-genre": "Top Genre",
};

export function getSectionsForProvider(caps: ProviderCapabilities): SectionConfig[] {
	return ALL_SECTIONS.filter((s) => {
		if (s.id === "top-genres" && !caps.hasGenreData) return false;
		if (s.id === "activity" && !caps.hasActivityData) return false;
		if (s.id === "consistency" && !caps.hasConsistencyData) return false;
		return true;
	});
}

function isTileAvailable(tileId: string, caps: ProviderCapabilities): boolean {
	if (tileId === "streak" && !caps.hasStreakData) return false;
	if (tileId === "skip-rate" && !caps.hasSkipRate) return false;
	return true;
}

export function getOverviewTilesForProvider(providerId: string, caps: ProviderCapabilities): TileConfig[] {
	const tileIds = providerId === "local" ? LOCAL_TILES : STATSFM_TILES;
	return tileIds.map((id) => ({
		id,
		label: TILE_LABELS[id] ?? id,
		available: isTileAvailable(id, caps),
	}));
}

export type ActivityMode = "full" | "hidden";

export function getActivityMode(caps: ProviderCapabilities): ActivityMode {
	if (caps.hasActivityData) return "full";
	return "hidden";
}
