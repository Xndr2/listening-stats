/**
 * The marker LS writes at the end of its playlists' descriptions, so a
 * reinstall or another device can recognise and adopt them:
 *
 *   Your top 20 tracks this month. Updated by Listening Stats [ls:1;n=20;p=this-month;src=local;r=daily;u=20261021;o=k3f9x2]
 *
 * Every field is validated on read; a marker with any unknown or
 * out-of-range field is ignored rather than trusted.
 */
import { V3_KEYS } from "../constants/storage-keys";
import { PERIOD_IDS, type PeriodId } from "../providers/periods";

export const PLAYLIST_SIZES = [10, 20, 30, 50] as const;
export const PLAYLIST_SOURCES = ["local", "statsfm"] as const;
export const PLAYLIST_REFRESH = ["daily", "weekly", "manual"] as const;
/** "Today" makes an empty playlist most of the day, so it isn't offered. */
export const PLAYLIST_PERIODS = PERIOD_IDS.filter((p) => p !== "today");

export type PlaylistSource = (typeof PLAYLIST_SOURCES)[number];
export type PlaylistRefresh = (typeof PLAYLIST_REFRESH)[number];

export interface Marker {
	size: number;
	period: PeriodId;
	source: PlaylistSource;
	refresh: PlaylistRefresh;
	/** YYYYMMDD of the last update, or "" before the first. */
	updated: string;
	/** Owner token; see ownerToken(). */
	owner: string;
}

const RE = /\[ls:1;([^\]]{1,160})\]\s*$/;

export function encodeMarker(m: Marker): string {
	return `[ls:1;n=${m.size};p=${m.period};src=${m.source};r=${m.refresh};u=${m.updated};o=${m.owner}]`;
}

export function decodeMarker(description: string | undefined | null): Marker | null {
	const match = description?.match(RE);
	if (!match) return null;
	const f = Object.fromEntries(
		match[1].split(";").map((kv) => {
			const i = kv.indexOf("=");
			return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
		}),
	);
	const size = Number(f.n);
	if (!(PLAYLIST_SIZES as readonly number[]).includes(size)) return null;
	if (!(PLAYLIST_PERIODS as readonly string[]).includes(f.p)) return null;
	if (!(PLAYLIST_SOURCES as readonly string[]).includes(f.src)) return null;
	if (!(PLAYLIST_REFRESH as readonly string[]).includes(f.r)) return null;
	if (!/^(\d{8})?$/.test(f.u ?? "")) return null;
	if (!/^[a-z0-9]{6}$/.test(f.o ?? "")) return null;
	return {
		size,
		period: f.p as PeriodId,
		source: f.src as PlaylistSource,
		refresh: f.r as PlaylistRefresh,
		updated: f.u,
		owner: f.o,
	};
}

/** Replaces (or appends) the marker, keeping whatever text precedes it. */
export function withMarker(description: string, text: string, m: Marker): string {
	const base = description.replace(RE, "").trim() || text;
	// Spotify caps descriptions at 300 characters; the marker must survive.
	const marker = encodeMarker(m);
	return `${base.slice(0, 300 - marker.length - 1)} ${marker}`;
}

/** A random id for this install, created once. Never leaves the device on its own. */
export function deviceId(): string {
	let id = localStorage.getItem(V3_KEYS.DEVICE_ID);
	if (!id || !/^[a-f0-9]{32}$/.test(id)) {
		const b = new Uint8Array(16);
		crypto.getRandomValues(b);
		id = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
		localStorage.setItem(V3_KEYS.DEVICE_ID, id);
	}
	return id;
}

/**
 * Which device looks after a playlist, without publishing a device id: a
 * 6-character hash of (device id + playlist uri). The same device gets a
 * different token for each playlist, so tokens can't be linked together, and
 * a copy of a playlist (different uri) never matches anyone.
 */
export function ownerToken(playlistUri: string, id = deviceId()): string {
	let h1 = 0x811c9dc5;
	let h2 = 0x01000193;
	const s = `${id}|${playlistUri}`;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 16777619);
		h2 = Math.imul(h2 ^ c, 2246822519);
	}
	return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 6).padEnd(6, "0");
}

export const dayStamp = (ms = Date.now()) => {
	const d = new Date(ms);
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
