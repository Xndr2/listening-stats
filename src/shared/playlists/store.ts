/** The user's auto playlists, as configured on this device. */
import { EVENTS, emit } from "../constants/events";
import { V3_KEYS } from "../constants/storage-keys";
import type { PeriodId } from "../providers/periods";
import {
	PLAYLIST_PERIODS,
	PLAYLIST_REFRESH,
	PLAYLIST_SIZES,
	PLAYLIST_SOURCES,
	type PlaylistRefresh,
	type PlaylistSource,
} from "./marker";

export interface PlaylistConfig {
	/** Local id, stable before the Spotify playlist exists. */
	id: string;
	uri: string | null;
	name: string;
	/** Rename the playlist when the period changes. Off once the user picks a name. */
	autoName: boolean;
	source: PlaylistSource;
	period: PeriodId;
	size: number;
	refresh: PlaylistRefresh;
	isPublic: boolean;
	/** YYYYMMDD of the last update by any device, "" if never. */
	lastBuilt: string;
	/** Owner token currently in the marker ("" until built). */
	owner: string;
	/** Changed on this device since the marker was last written; the marker must not overwrite it. */
	edited: boolean;
}

// Fields added after a config was first saved fall back to these.
const DEFAULTS = { autoName: true, isPublic: false, lastBuilt: "", owner: "", edited: false };

function valid(c: unknown): c is PlaylistConfig {
	if (!c || typeof c !== "object") return false;
	const p = c as Record<string, unknown>;
	return (
		typeof p.id === "string" &&
		(p.uri === null || typeof p.uri === "string") &&
		typeof p.name === "string" &&
		(PLAYLIST_SOURCES as readonly unknown[]).includes(p.source) &&
		(PLAYLIST_PERIODS as readonly unknown[]).includes(p.period) &&
		(PLAYLIST_SIZES as readonly unknown[]).includes(p.size) &&
		(PLAYLIST_REFRESH as readonly unknown[]).includes(p.refresh)
	);
}

export function getPlaylists(): PlaylistConfig[] {
	try {
		const raw = JSON.parse(localStorage.getItem(V3_KEYS.PLAYLISTS) ?? "[]") as unknown;
		return Array.isArray(raw) ? raw.filter(valid).map((c) => ({ ...DEFAULTS, ...c })) : [];
	} catch {
		return [];
	}
}

export function savePlaylists(list: PlaylistConfig[]): void {
	localStorage.setItem(V3_KEYS.PLAYLISTS, JSON.stringify(list));
	emit(EVENTS.PLAYLISTS_CHANGED);
}

export function updatePlaylist(id: string, patch: Partial<PlaylistConfig>): PlaylistConfig | null {
	const list = getPlaylists();
	const i = list.findIndex((p) => p.id === id);
	if (i < 0) return null;
	list[i] = { ...list[i], ...patch };
	savePlaylists(list);
	return list[i];
}

export function newPlaylistId(): string {
	return Math.random().toString(36).slice(2, 10);
}
