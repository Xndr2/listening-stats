import { localProvider } from "../stats/local-provider";
import type { StatsProvider } from "../stats/provider";
import { statsfmProvider } from "../stats/statsfm-provider";
import { toLocalDateKey } from "../util/date-key";
import { getPlaylistConfig, getPlaylistState, resolvePlaylistPeriod, setPlaylistState } from "./config";
import { generateCoverDataUrl } from "./cover";

export type BuildResult =
	| { status: "built"; playlistUri: string; trackCount: number }
	| { status: "skipped"; reason: "disabled" | "no-tracks" }
	| { status: "error"; message: string };

const REMOVE_PAGE_SIZE = 100;

function playlistApis(): {
	rootlist: typeof Spicetify.Platform.RootlistAPI;
	playlist: typeof Spicetify.Platform.PlaylistAPI;
} | null {
	const platform = (globalThis as { Spicetify?: typeof Spicetify }).Spicetify?.Platform;
	if (!platform?.RootlistAPI?.createPlaylist || !platform?.PlaylistAPI?.add) return null;
	return { rootlist: platform.RootlistAPI, playlist: platform.PlaylistAPI };
}

async function ensurePlaylist(rootlist: typeof Spicetify.Platform.RootlistAPI, name: string): Promise<string> {
	const existing = getPlaylistState().playlistUri;
	if (existing) {
		try {
			await Spicetify.Platform.PlaylistAPI.getMetadata(existing);
			return existing;
		} catch {
			// deleted or inaccessible - create a fresh one
		}
	}
	const created = await rootlist.createPlaylist(name, { before: "start" });
	const uri = typeof created === "string" ? created : created?.uri;
	if (!uri) throw new Error("createPlaylist returned no URI");
	return uri;
}

async function replaceTracks(
	playlist: typeof Spicetify.Platform.PlaylistAPI,
	playlistUri: string,
	uris: string[],
): Promise<void> {
	if (typeof playlist.clear === "function") {
		await playlist.clear(playlistUri);
	} else {
		// No clear() on this client version - page through and remove by uid
		for (;;) {
			const page = await playlist.getContents(playlistUri, { limit: REMOVE_PAGE_SIZE, offset: 0 });
			if (!page.items.length) break;
			await playlist.remove(
				playlistUri,
				page.items.map(({ uri, uid }) => ({ uri, uid })),
			);
			if (page.items.length < REMOVE_PAGE_SIZE) break;
		}
	}
	await playlist.add(playlistUri, uris, { after: "end" });
}

/**
 * Upload a canvas-generated cover via the client's internal endpoints
 * (PlaylistAPI.uploadImage + spclient register-image). This is the same
 * channel the Spotify UI uses - not the public Web API, so no developer-app
 * rate limits apply. Best-effort: cover failures never fail the build.
 */
async function uploadCover(
	playlist: typeof Spicetify.Platform.PlaylistAPI,
	playlistUri: string,
	dataUrl: string,
): Promise<void> {
	if (typeof playlist.uploadImage !== "function") return;
	const accessToken = Spicetify.Platform.Session?.accessToken;
	if (!accessToken) return;

	const blob = await (await fetch(dataUrl)).blob();
	const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
	const uploadToken = await playlist.uploadImage(file);

	const playlistId = playlistUri.split(":").pop();
	const res = await fetch(`https://spclient.wg.spotify.com/playlist/v2/playlist/${playlistId}/register-image`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ uploadToken }),
	});
	if (!res.ok) throw new Error(`register-image failed: ${res.status}`);

	// Response is protobuf bytes: hex-encode and strip the 0x0a14 field header to get the image id
	const buffer = await res.arrayBuffer();
	const fullHex = [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
	const imageId = fullHex.startsWith("0a14") ? fullHex.slice(4) : fullHex;

	await playlist.setAttributes(playlistUri, { picture: imageId });
	if (typeof playlist.resync === "function") await playlist.resync(playlistUri);
}

/**
 * Best-effort visibility change ("VIEWER" = public, "BLOCKED" = private).
 * PlaylistPermissionsAPI is missing on some client versions; failures are
 * logged, never fatal.
 */
async function setVisibility(playlistUri: string, isPublic: boolean): Promise<void> {
	const permissions = Spicetify.Platform.PlaylistPermissionsAPI;
	if (typeof permissions?.setBasePermission !== "function") return;
	try {
		await permissions.setBasePermission(playlistUri, isPublic ? "VIEWER" : "BLOCKED");
	} catch (err) {
		console.warn("[listening-stats] playlist visibility update failed:", err);
	}
}

/** Apply the configured visibility to the existing playlist (settings toggle). */
export async function applyPlaylistVisibility(isPublic: boolean): Promise<void> {
	const uri = getPlaylistState().playlistUri;
	if (uri) await setVisibility(uri, isPublic);
}

let inFlight: Promise<BuildResult> | null = null;

/**
 * Build or refresh the auto top-songs playlist from the configured provider
 * and period. Stamps lastBuiltDay only on success, so a failed or empty build
 * is retried on the next new-day check. Concurrent callers (scheduler +
 * settings button) share one in-flight build instead of racing.
 */
export function buildTopSongsPlaylist(): Promise<BuildResult> {
	if (!inFlight) {
		inFlight = buildOnce().finally(() => {
			inFlight = null;
		});
	}
	return inFlight;
}

async function buildOnce(): Promise<BuildResult> {
	const config = getPlaylistConfig();
	if (!config.enabled) return { status: "skipped", reason: "disabled" };

	const apis = playlistApis();
	if (!apis) return { status: "error", message: "Spotify playlist APIs unavailable in this client version" };

	try {
		const period = resolvePlaylistPeriod(config);
		const provider: StatsProvider = config.providerId === "statsfm" ? statsfmProvider : localProvider;
		const stats = await provider.calculateStats(period);

		const topTracks = stats.topTracks
			.filter((t) => t.trackUri.startsWith("spotify:track:"))
			.slice(0, config.trackCount);
		if (topTracks.length === 0) return { status: "skipped", reason: "no-tracks" };

		const name = `Listening Stats · ${period.label}`;
		const playlistUri = await ensurePlaylist(apis.rootlist, name);

		await replaceTracks(
			apis.playlist,
			playlistUri,
			topTracks.map((t) => t.trackUri),
		);
		await apis.playlist.setAttributes(playlistUri, {
			name,
			description: `Your top ${topTracks.length} tracks (${period.label.toLowerCase()}) - auto-updated daily by Listening Stats`,
		});
		await setVisibility(playlistUri, config.isPublic);

		try {
			const cover = await generateCoverDataUrl(topTracks[0].albumArt, period.label);
			await uploadCover(apis.playlist, playlistUri, cover);
		} catch (err) {
			console.warn("[listening-stats] playlist cover update failed:", err);
		}

		setPlaylistState({ playlistUri, lastBuiltDay: toLocalDateKey(Date.now()) });
		return { status: "built", playlistUri, trackCount: topTracks.length };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("[listening-stats] playlist build failed:", err);
		return { status: "error", message };
	}
}

/** Daily entry point: rebuild only when the playlist has not been built today. */
export async function maybeUpdateDailyPlaylist(): Promise<void> {
	const config = getPlaylistConfig();
	if (!config.enabled) return;
	if (getPlaylistState().lastBuiltDay === toLocalDateKey(Date.now())) return;
	await buildTopSongsPlaylist();
}
