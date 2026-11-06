/**
 * The local play tracker as a pure state machine.
 *
 *   step(state, event, ctx) -> { state, effects }
 *
 * No Spicetify, no IndexedDB, no timers: the extension feeds events in and
 * runs the effects. Listening time is measured on the wall clock while the
 * player is playing, so seeking never adds time that wasn't heard.
 *
 * A row is inserted the moment a track crosses the play threshold (so a
 * crash or Spotify quitting can't lose it) and its played time is updated
 * when the track ends. A track that ends below the threshold is stored as a
 * skip, unless it was heard for less than a second (flicker while skipping).
 */
import type { PlayEvent } from "../types/play-event";

export interface TrackMeta {
	uri: string;
	name: string;
	artistName: string;
	artistUri: string;
	albumName: string;
	albumUri: string;
	albumArt?: string;
	durationMs: number;
	/** "track" | "episode" | ... from Player.data.item.type */
	kind: string;
	/** "context" | "queue" | "ad" | "narration" | ... */
	provider: string;
}

export interface TrackerSettings {
	paused: boolean;
	skipRepeats: boolean;
	excludePodcasts: boolean;
	respectPrivateSession: boolean;
	thresholdFor(durationMs: number): number;
}

export interface Context {
	now: number;
	settings: TrackerSettings;
	privateSession: boolean;
}

interface Current {
	meta: TrackMeta;
	startedAt: number;
	listenedMs: number;
	playingSince: number | null;
	lastPositionMs: number;
	/** Why this track won't be recorded; null = it will. */
	ignored: null | "paused" | "ad" | "narration" | "podcast" | "private" | "repeat";
	/** Effect key of the threshold insert, once made. */
	recordKey: number | null;
}

export interface TrackerState {
	current: Current | null;
	/** Uri of the last track that got a row, play or skip (for "skip repeats"). */
	lastPlayUri: string | null;
	nextKey: number;
}

export type TrackerEvent =
	| { type: "trackStart"; meta: TrackMeta; isPaused: boolean; positionMs: number }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "progress"; positionMs: number }
	| { type: "tick" }
	| { type: "stop" };

/**
 * `key` ties an insert to its later update: the runner maps key -> DB id
 * when the insert resolves, since the reducer never sees ids.
 */
export type Effect =
	| { type: "insert"; key: number; event: PlayEvent }
	| { type: "update"; key: number; playedMs: number; endedAt: number };

export const initialState: TrackerState = { current: null, lastPlayUri: null, nextKey: 1 };

const MIN_SKIP_MS = 1000;
/** A track counts as fully played at 90% even below the threshold (short tracks). */
const FULL_PLAY_RATIO = 0.9;
/** Position jumping from the last 10% to the first 5 s of the same track = repeat-one. */
const RESTART_TAIL_RATIO = 0.9;
const RESTART_HEAD_MS = 5000;

function listened(cur: Current, now: number): number {
	return cur.listenedMs + (cur.playingSince === null ? 0 : Math.max(0, now - cur.playingSince));
}

function ignoreReason(meta: TrackMeta, ctx: Context, lastPlayUri: string | null): Current["ignored"] {
	const s = ctx.settings;
	if (s.paused) return "paused";
	if (meta.provider === "ad") return "ad";
	if (meta.provider === "narration") return "narration";
	if (s.excludePodcasts && meta.kind !== "track") return "podcast";
	if (s.respectPrivateSession && ctx.privateSession) return "private";
	if (s.skipRepeats && meta.uri === lastPlayUri) return "repeat";
	return null;
}

function toEvent(cur: Current, type: "play" | "skip", playedMs: number, endedAt: number): PlayEvent {
	const m = cur.meta;
	return {
		trackUri: m.uri,
		trackName: m.name,
		artistName: m.artistName,
		artistUri: m.artistUri,
		albumName: m.albumName,
		albumUri: m.albumUri,
		...(m.albumArt ? { albumArt: m.albumArt } : {}),
		durationMs: m.durationMs,
		playedMs,
		startedAt: cur.startedAt,
		endedAt,
		type,
	};
}

/** Inserts the play row once the threshold is crossed. */
function checkThreshold(state: TrackerState, ctx: Context, effects: Effect[]): TrackerState {
	const cur = state.current;
	if (!cur || cur.ignored || cur.recordKey !== null) return state;
	const heard = listened(cur, ctx.now);
	const threshold = ctx.settings.thresholdFor(cur.meta.durationMs);
	const full = cur.meta.durationMs > 0 && heard >= cur.meta.durationMs * FULL_PLAY_RATIO;
	if (heard < threshold && !full) return state;
	const key = state.nextKey;
	effects.push({ type: "insert", key, event: toEvent(cur, "play", heard, ctx.now) });
	return { current: { ...cur, recordKey: key }, lastPlayUri: cur.meta.uri, nextKey: key + 1 };
}

/** Closes the current track: final playtime for a play, or a skip row. */
function finish(state: TrackerState, ctx: Context, effects: Effect[]): TrackerState {
	const checked = checkThreshold(state, ctx, effects);
	const cur = checked.current;
	if (!cur) return checked;
	const heard = listened(cur, ctx.now);
	if (cur.recordKey !== null) {
		effects.push({ type: "update", key: cur.recordKey, playedMs: heard, endedAt: ctx.now });
		return { ...checked, current: null };
	}
	if (!cur.ignored && heard >= MIN_SKIP_MS) {
		const key = checked.nextKey;
		effects.push({ type: "insert", key, event: toEvent(cur, "skip", heard, ctx.now) });
		return { current: null, lastPlayUri: cur.meta.uri, nextKey: key + 1 };
	}
	return { ...checked, current: null };
}

function begin(
	state: TrackerState,
	meta: TrackMeta,
	isPaused: boolean,
	positionMs: number,
	ctx: Context,
): TrackerState {
	return {
		...state,
		current: {
			meta,
			startedAt: ctx.now,
			listenedMs: 0,
			playingSince: isPaused ? null : ctx.now,
			lastPositionMs: positionMs,
			ignored: ignoreReason(meta, ctx, state.lastPlayUri),
			recordKey: null,
		},
	};
}

export function step(
	state: TrackerState,
	event: TrackerEvent,
	ctx: Context,
): { state: TrackerState; effects: Effect[] } {
	const effects: Effect[] = [];
	let next = state;
	let cur = state.current;
	// Pausing tracking or starting a private session mid-track stops that
	// track from being recorded too (a play already saved keeps its row).
	if (cur && !cur.ignored && cur.recordKey === null) {
		const late = ctx.settings.paused
			? "paused"
			: ctx.settings.respectPrivateSession && ctx.privateSession
				? "private"
				: null;
		if (late) {
			cur = { ...cur, ignored: late };
			next = { ...state, current: cur };
		}
	}

	switch (event.type) {
		case "trackStart": {
			// Spotify re-announces the playing track on some UI changes. The same
			// uri is a new play only when it's back at the start after having
			// played for a while; otherwise it's the same play continuing.
			if (
				cur &&
				cur.meta.uri === event.meta.uri &&
				(event.positionMs >= RESTART_HEAD_MS || listened(cur, ctx.now) < RESTART_HEAD_MS)
			) {
				break;
			}
			next = finish(next, ctx, effects);
			next = begin(next, event.meta, event.isPaused, event.positionMs, ctx);
			break;
		}
		case "pause":
			if (cur && cur.playingSince !== null) {
				next = { ...next, current: { ...cur, listenedMs: listened(cur, ctx.now), playingSince: null } };
			}
			break;
		case "resume":
			if (cur && cur.playingSince === null) {
				// A track that was paused when it loaded (Spotify just started) begins
				// when it first plays, not when the tracker first saw it.
				const fresh = cur.listenedMs === 0 && cur.recordKey === null;
				next = { ...next, current: { ...cur, playingSince: ctx.now, ...(fresh ? { startedAt: ctx.now } : {}) } };
			}
			break;
		case "progress": {
			if (!cur) break;
			const d = cur.meta.durationMs;
			const restarted = d > 0 && cur.lastPositionMs >= d * RESTART_TAIL_RATIO && event.positionMs < RESTART_HEAD_MS;
			if (restarted) {
				next = finish(next, ctx, effects);
				next = begin(next, cur.meta, cur.playingSince === null, event.positionMs, ctx);
			} else {
				next = checkThreshold({ ...next, current: { ...cur, lastPositionMs: event.positionMs } }, ctx, effects);
			}
			break;
		}
		case "tick":
			next = checkThreshold(next, ctx, effects);
			break;
		case "stop":
			next = finish(next, ctx, effects);
			break;
	}
	return { state: next, effects };
}
