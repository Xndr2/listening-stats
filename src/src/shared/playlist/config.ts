import { LS_KEYS } from "../constants/storage-keys";
import { LOCAL_PERIODS, STATSFM_PERIODS } from "../stats/periods";
import type { Period } from "../types/stats";

/**
 * Auto top-songs playlist settings. Last.fm is not a valid source: its top
 * tracks carry synthetic `lfm:track:` URIs that cannot be added to a Spotify
 * playlist without Web API search calls.
 */
export type PlaylistProviderId = "local" | "statsfm";

export interface PlaylistConfig {
	enabled: boolean;
	trackCount: number;
	providerId: PlaylistProviderId;
	periodId: string;
	/** Playlist visibility; private by default. */
	isPublic: boolean;
}

/** Runtime state persisted between builds (not user settings). */
export interface PlaylistState {
	playlistUri: string | null;
	/** Local date key ("YYYY-MM-DD") of the last successful build. */
	lastBuiltDay: string | null;
}

export const PLAYLIST_TRACK_COUNTS = [5, 10, 20, 30] as const;

const CONFIG_DEFAULTS: PlaylistConfig = {
	enabled: false,
	trackCount: 10,
	providerId: "local",
	periodId: "this-week",
	isPublic: false,
};

// "Today" is excluded on purpose: early in the day there is little or no
// listening history, so a today-playlist would be empty or meaningless.
const EXCLUDED_PERIOD_IDS = new Set(["today", "sfm-today"]);

export function getPlaylistPeriods(providerId: PlaylistProviderId): Period[] {
	const periods = providerId === "statsfm" ? STATSFM_PERIODS : LOCAL_PERIODS;
	return periods.filter((p) => !EXCLUDED_PERIOD_IDS.has(p.id));
}

/** Resolve the configured period, falling back to the provider's first allowed period. */
export function resolvePlaylistPeriod(config: PlaylistConfig): Period {
	const periods = getPlaylistPeriods(config.providerId);
	return periods.find((p) => p.id === config.periodId) ?? periods[0];
}

export function getPlaylistConfig(): PlaylistConfig {
	try {
		const raw = localStorage.getItem(LS_KEYS.PLAYLIST_CONFIG);
		if (!raw) return { ...CONFIG_DEFAULTS };
		const parsed = JSON.parse(raw) as Partial<PlaylistConfig>;
		return {
			enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : CONFIG_DEFAULTS.enabled,
			trackCount:
				typeof parsed.trackCount === "number" && parsed.trackCount > 0 ? parsed.trackCount : CONFIG_DEFAULTS.trackCount,
			providerId: parsed.providerId === "statsfm" ? "statsfm" : "local",
			periodId: typeof parsed.periodId === "string" ? parsed.periodId : CONFIG_DEFAULTS.periodId,
			isPublic: typeof parsed.isPublic === "boolean" ? parsed.isPublic : CONFIG_DEFAULTS.isPublic,
		};
	} catch {
		return { ...CONFIG_DEFAULTS };
	}
}

export function setPlaylistConfig(patch: Partial<PlaylistConfig>): PlaylistConfig {
	const next = { ...getPlaylistConfig(), ...patch };
	try {
		localStorage.setItem(LS_KEYS.PLAYLIST_CONFIG, JSON.stringify(next));
	} catch {
		// localStorage unavailable
	}
	return next;
}

export function getPlaylistState(): PlaylistState {
	try {
		const raw = localStorage.getItem(LS_KEYS.PLAYLIST_STATE);
		if (!raw) return { playlistUri: null, lastBuiltDay: null };
		const parsed = JSON.parse(raw) as Partial<PlaylistState>;
		return {
			playlistUri: typeof parsed.playlistUri === "string" ? parsed.playlistUri : null,
			lastBuiltDay: typeof parsed.lastBuiltDay === "string" ? parsed.lastBuiltDay : null,
		};
	} catch {
		return { playlistUri: null, lastBuiltDay: null };
	}
}

export function setPlaylistState(patch: Partial<PlaylistState>): void {
	const next = { ...getPlaylistState(), ...patch };
	try {
		localStorage.setItem(LS_KEYS.PLAYLIST_STATE, JSON.stringify(next));
	} catch {
		// localStorage unavailable
	}
}
