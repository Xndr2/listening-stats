/**
 * Keeps the auto playlists in step with Spotify.
 *
 * adopt(): reads the user's own playlists, recognises LS ones by their
 * marker and brings this device's list up to date (new device, reinstall,
 * settings changed elsewhere). Playlists the user deleted are forgotten.
 * v2's single playlist is adopted once, on the first run.
 *
 * build(): fills one playlist with the current top tracks.
 * runDue(): builds everything whose refresh is due and that this device
 * looks after.
 */
import { V2_KEYS } from "../constants/storage-keys";
import { fromV2PeriodId, PERIOD_LABELS, periodWindow } from "../providers/periods";
import { PROVIDERS } from "../providers/registry";
import { getSetting } from "../settings/registry";
import { withLock } from "../storage/idb";
import { setLocal } from "../storage/local";
import {
	dayStamp,
	decodeMarker,
	type Marker,
	ownerToken,
	PLAYLIST_PERIODS,
	PLAYLIST_SIZES,
	withMarker,
} from "./marker";
import type { PlaylistApi } from "./spotify-api";
import { getPlaylists, newPlaylistId, type PlaylistConfig, savePlaylists, updatePlaylist } from "./store";

const PHRASE: Record<string, string> = {
	"this-week": "this week",
	"this-month": "this month",
	"last-month": "of last month",
	"last-4-weeks": "of the last 4 weeks",
	"last-6-months": "of the last 6 months",
	"this-year": "this year",
	"all-time": "of all time",
};

export const autoName = (c: Pick<PlaylistConfig, "period">) => `Top tracks · ${PERIOD_LABELS[c.period]}`;
const describe = (c: PlaylistConfig, n: number) =>
	`Your top ${n} tracks ${PHRASE[c.period] ?? ""}. Updated by Listening Stats.`;

/** v2 kept one playlist in playlist-config / playlist-state. */
function v2Playlist(): Omit<PlaylistConfig, "id"> | null {
	try {
		const state = JSON.parse(localStorage.getItem(V2_KEYS.PLAYLIST_STATE) ?? "null") as {
			playlistUri?: unknown;
		} | null;
		const cfg = JSON.parse(localStorage.getItem(V2_KEYS.PLAYLIST_CONFIG) ?? "null") as Record<string, unknown> | null;
		if (typeof state?.playlistUri !== "string" || !cfg?.enabled) return null;
		const period = fromV2PeriodId(String(cfg.periodId ?? "")) ?? "this-week";
		const size = PLAYLIST_SIZES.find((s) => s >= Number(cfg.trackCount ?? 10)) ?? 10;
		return {
			uri: state.playlistUri,
			name: "",
			autoName: true,
			source: cfg.providerId === "statsfm" ? "statsfm" : "local",
			period: (PLAYLIST_PERIODS as readonly string[]).includes(period) ? period : "this-week",
			size,
			refresh: "daily",
			isPublic: cfg.isPublic === true,
			lastBuilt: "",
			owner: "",
			edited: false,
		};
	} catch {
		return null;
	}
}

const V2_ADOPTED = "listening-stats:v3:v2-playlist-adopted";

export async function adopt(api: PlaylistApi): Promise<PlaylistConfig[]> {
	const owned = await api.listOwned();
	// An empty listing usually means the library hasn't loaded yet (or the API
	// changed), not that the user deleted everything: change nothing then.
	if (owned.length === 0) return getPlaylists();
	const byUri = new Map(owned.map((o) => [o.uri, o]));
	const list = getPlaylists().filter((c) => c.uri === null || byUri.has(c.uri));
	const known = new Set(list.map((c) => c.uri));

	for (const o of owned) {
		const m = decodeMarker(o.description);
		if (!m) continue;
		const fromMarker = {
			source: m.source,
			period: m.period,
			size: m.size,
			refresh: m.refresh,
			lastBuilt: m.updated,
			owner: m.owner,
		};
		const existing = list.find((c) => c.uri === o.uri);
		// Local edits win until the next build writes them into the marker.
		if (existing) Object.assign(existing, existing.edited ? { owner: m.owner } : fromMarker, { name: o.name });
		else if (!known.has(o.uri)) {
			list.push({
				id: newPlaylistId(),
				uri: o.uri,
				name: o.name,
				autoName: o.name === autoName(m),
				isPublic: false,
				edited: false,
				...fromMarker,
			});
			known.add(o.uri);
		}
	}

	if (!localStorage.getItem(V2_ADOPTED)) {
		const v2 = v2Playlist();
		if (v2?.uri && byUri.has(v2.uri) && !known.has(v2.uri)) {
			list.push({ id: newPlaylistId(), ...v2, edited: false, name: byUri.get(v2.uri)?.name ?? autoName(v2) });
		}
		setLocal(V2_ADOPTED, "1");
	}

	savePlaylists(list);
	return list;
}

export type BuildStatus =
	| { status: "built"; tracks: number; changed: boolean }
	| { status: "skipped"; reason: "not-due" | "no-tracks" | "elsewhere" | "provider-missing" }
	| { status: "error"; message: string };

/**
 * Another device (or another copy) looks after this playlist. Applies to
 * every source: a copied or hand-edited playlist carrying our marker has a
 * token that doesn't match its uri, so it is never rebuilt without the user
 * pressing "Update from here instead".
 */
export function managedElsewhere(c: PlaylistConfig): boolean {
	return !!c.uri && !!c.owner && c.owner !== ownerToken(c.uri);
}

/** Only real Spotify track ids go into a playlist; anything else could make the add fail. */
const TRACK_URI = /^spotify:track:[A-Za-z0-9]{22}$/;

function isDue(c: PlaylistConfig, today: string): boolean {
	if (c.refresh === "manual") return false;
	if (!c.lastBuilt) return true;
	if (c.refresh === "daily") return c.lastBuilt < today;
	const last = new Date(
		Number(c.lastBuilt.slice(0, 4)),
		Number(c.lastBuilt.slice(4, 6)) - 1,
		Number(c.lastBuilt.slice(6, 8)),
	);
	return Date.now() - last.getTime() >= 7 * 86_400_000;
}

export async function build(
	api: PlaylistApi,
	id: string,
	opts: { force?: boolean; takeOver?: boolean } = {},
): Promise<BuildStatus> {
	return withLock("listening-stats:playlists", async () => {
		const c = getPlaylists().find((p) => p.id === id);
		if (!c) return { status: "error", message: "That playlist isn't set up any more." };
		const today = dayStamp();
		if (!opts.force && !isDue(c, today)) return { status: "skipped", reason: "not-due" };
		if (managedElsewhere(c) && !opts.takeOver) return { status: "skipped", reason: "elsewhere" };

		const provider = PROVIDERS[c.source];
		if (!provider.topTracks) return { status: "skipped", reason: "provider-missing" };
		try {
			const top = await provider.topTracks({
				window: periodWindow(c.period, Date.now(), getSetting("weekStart")),
				rank: getSetting("rankMode"),
				limit: c.size * 2, // some rows (local files, imports) can't go in a playlist
			});
			const uris = top
				.map((t) => t.uri)
				.filter((u) => TRACK_URI.test(u))
				.slice(0, c.size);
			if (uris.length === 0) return { status: "skipped", reason: "no-tracks" };

			let uri = c.uri;
			const name = c.autoName || !c.name ? autoName(c) : c.name;
			const created = !uri;
			if (!uri) {
				uri = await api.create(name);
				// Save right away: if anything below fails, the next try reuses this
				// playlist instead of creating another one.
				updatePlaylist(id, { uri });
			}
			const current = created ? [] : await api.trackUris(uri);
			const changed = current.length !== uris.length || current.some((u, i) => u !== uris[i]);
			if (changed) await api.replaceTracks(uri, uris);

			const marker: Marker = {
				size: c.size,
				period: c.period,
				source: c.source,
				refresh: c.refresh,
				updated: today,
				owner: ownerToken(uri),
			};
			const existing = (await api.listOwned()).find((o) => o.uri === uri)?.description ?? "";
			await api.setDetails(uri, {
				...(c.autoName ? { name } : {}),
				description: withMarker(decodeMarker(existing) ? existing : "", describe(c, uris.length), marker),
			});
			if (created) await api.setPublic(uri, c.isPublic).catch(() => {});

			const list = getPlaylists().map((p) =>
				p.id === id ? { ...p, uri, name, lastBuilt: today, owner: marker.owner, edited: false } : p,
			);
			savePlaylists(list);
			return { status: "built", tracks: uris.length, changed };
		} catch (err) {
			return { status: "error", message: err instanceof Error ? err.message : String(err) };
		}
	});
}

/** Builds every due playlist this device looks after. Errors are returned, not thrown. */
export async function runDue(api: PlaylistApi): Promise<Record<string, BuildStatus>> {
	await adopt(api);
	const out: Record<string, BuildStatus> = {};
	for (const c of getPlaylists()) out[c.id] = await build(api, c.id);
	return out;
}

/**
 * Stops LS managing a playlist. The playlist and its tracks stay in the
 * user's library; only the marker is removed so no device adopts it again.
 */
export async function release(api: PlaylistApi, id: string): Promise<void> {
	await withLock("listening-stats:playlists", async () => {
		const c = getPlaylists().find((p) => p.id === id);
		if (c?.uri) {
			const o = (await api.listOwned()).find((p) => p.uri === c.uri);
			if (o && decodeMarker(o.description)) {
				const text = o.description
					.replace(/\s*\[ls:1;[^\]]*\]\s*$/, "")
					.replace(/\s*Updated by Listening Stats\.?$/, "");
				await api.setDetails(c.uri, { description: text });
			}
		}
		savePlaylists(getPlaylists().filter((p) => p.id !== id));
	});
}
