import { beforeEach, describe, expect, it, vi } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

vi.mock("../shared/stats/artist-enrichment", async () => {
	const actual = await vi.importActual<typeof import("../shared/stats/artist-enrichment")>(
		"../shared/stats/artist-enrichment",
	);
	return { ...actual, enrichArtists: vi.fn().mockResolvedValue(undefined) };
});

import { buildTopSongsPlaylist, maybeUpdateDailyPlaylist } from "../shared/playlist/builder";
import {
	getPlaylistConfig,
	getPlaylistPeriods,
	getPlaylistState,
	resolvePlaylistPeriod,
	setPlaylistConfig,
	setPlaylistState,
} from "../shared/playlist/config";
import { statsCache } from "../shared/stats/stats-cache";
import { toLocalDateKey } from "../shared/util/date-key";

function makePlayEvent(overrides: Partial<PlayEvent> = {}): PlayEvent {
	return {
		trackUri: "spotify:track:default",
		trackName: "Default Track",
		artistName: "Default Artist",
		artistUri: "spotify:artist:default",
		albumName: "Default Album",
		albumUri: "spotify:album:default",
		durationMs: 200000,
		playedMs: 180000,
		startedAt: Date.now() - 60000,
		endedAt: Date.now(),
		type: "play",
		...overrides,
	};
}

interface FakeApis {
	rootlist: { createPlaylist: ReturnType<typeof vi.fn> };
	playlist: {
		getMetadata: ReturnType<typeof vi.fn>;
		getContents: ReturnType<typeof vi.fn>;
		add: ReturnType<typeof vi.fn>;
		remove: ReturnType<typeof vi.fn>;
		setAttributes: ReturnType<typeof vi.fn>;
		clear?: ReturnType<typeof vi.fn>;
	};
	permissions: { setBasePermission: ReturnType<typeof vi.fn> };
}

function installPlaylistApis(overrides: Partial<FakeApis["playlist"]> = {}): FakeApis {
	const apis: FakeApis = {
		rootlist: { createPlaylist: vi.fn(async () => "spotify:playlist:new123") },
		playlist: {
			getMetadata: vi.fn(async () => ({ name: "existing" })),
			getContents: vi.fn(async () => ({ items: [] })),
			add: vi.fn(async () => {}),
			remove: vi.fn(async () => {}),
			setAttributes: vi.fn(async () => {}),
			...overrides,
		},
		permissions: { setBasePermission: vi.fn(async () => {}) },
	};
	const platform = (globalThis as unknown as { Spicetify: { Platform: Record<string, unknown> } }).Spicetify.Platform;
	platform.RootlistAPI = apis.rootlist;
	platform.PlaylistAPI = apis.playlist;
	platform.PlaylistPermissionsAPI = apis.permissions;
	return apis;
}

describe("playlist config", () => {
	beforeEach(() => {
		localStorage.removeItem(LS_KEYS.PLAYLIST_CONFIG);
		localStorage.removeItem(LS_KEYS.PLAYLIST_STATE);
	});

	it("defaults: disabled, 10 tracks, local provider, this-week, private", () => {
		expect(getPlaylistConfig()).toEqual({
			enabled: false,
			trackCount: 10,
			providerId: "local",
			periodId: "this-week",
			isPublic: false,
		});
	});

	it("never offers a 'today' period for any provider", () => {
		expect(getPlaylistPeriods("local").map((p) => p.id)).not.toContain("today");
		expect(getPlaylistPeriods("statsfm").map((p) => p.id)).not.toContain("sfm-today");
	});

	it("resolvePlaylistPeriod falls back to the provider's first allowed period on unknown/mismatched id", () => {
		setPlaylistConfig({ providerId: "statsfm", periodId: "this-week" });
		const period = resolvePlaylistPeriod(getPlaylistConfig());
		expect(period.id).toBe("sfm-weeks");
	});

	it("rejects invalid stored values", () => {
		localStorage.setItem(LS_KEYS.PLAYLIST_CONFIG, JSON.stringify({ trackCount: -5, providerId: "lastfm" }));
		const config = getPlaylistConfig();
		expect(config.trackCount).toBe(10);
		expect(config.providerId).toBe("local");
	});
});

describe("buildTopSongsPlaylist", () => {
	beforeEach(() => {
		localStorage.removeItem(LS_KEYS.PLAYLIST_CONFIG);
		localStorage.removeItem(LS_KEYS.PLAYLIST_STATE);
		statsCache.invalidate();
	});

	it("skips when disabled", async () => {
		const result = await buildTopSongsPlaylist();
		expect(result).toEqual({ status: "skipped", reason: "disabled" });
	});

	it("skips with no-tracks and does not stamp lastBuiltDay when the period has no plays", async () => {
		installPlaylistApis();
		setPlaylistConfig({ enabled: true });
		const result = await buildTopSongsPlaylist();
		expect(result).toEqual({ status: "skipped", reason: "no-tracks" });
		expect(getPlaylistState().lastBuiltDay).toBeNull();
	});

	it("creates a playlist with top tracks (spotify URIs only), sets attributes, stamps state", async () => {
		const apis = installPlaylistApis();
		setPlaylistConfig({ enabled: true, trackCount: 5 });
		await db.playEvents.bulkAdd([
			makePlayEvent({ trackUri: "spotify:track:a", startedAt: Date.now() - 1000 }),
			makePlayEvent({ trackUri: "spotify:track:a", startedAt: Date.now() - 2000 }),
			makePlayEvent({ trackUri: "spotify:track:b", startedAt: Date.now() - 3000 }),
			// Local file: no spotify track uri - must be excluded from the playlist
			makePlayEvent({ trackUri: "spotify:local:xyz", startedAt: Date.now() - 4000 }),
		]);

		const result = await buildTopSongsPlaylist();
		expect(result.status).toBe("built");
		expect(apis.rootlist.createPlaylist).toHaveBeenCalledWith("Listening Stats · This Week", { before: "start" });
		expect(apis.playlist.add).toHaveBeenCalledWith("spotify:playlist:new123", ["spotify:track:a", "spotify:track:b"], {
			after: "end",
		});
		expect(apis.playlist.setAttributes).toHaveBeenCalledWith(
			"spotify:playlist:new123",
			expect.objectContaining({ name: "Listening Stats · This Week" }),
		);
		const state = getPlaylistState();
		expect(state.playlistUri).toBe("spotify:playlist:new123");
		expect(state.lastBuiltDay).toBe(toLocalDateKey(Date.now()));
	});

	it("reuses the stored playlist when it still exists, clearing old tracks first", async () => {
		const apis = installPlaylistApis({
			getContents: vi.fn(async () => ({ items: [{ uri: "spotify:track:old", uid: "u1" }] })),
		});
		setPlaylistConfig({ enabled: true });
		setPlaylistState({ playlistUri: "spotify:playlist:mine" });
		await db.playEvents.add(makePlayEvent({ startedAt: Date.now() - 1000 }));

		const result = await buildTopSongsPlaylist();
		expect(result.status).toBe("built");
		expect(apis.rootlist.createPlaylist).not.toHaveBeenCalled();
		expect(apis.playlist.remove).toHaveBeenCalledWith("spotify:playlist:mine", [
			{ uri: "spotify:track:old", uid: "u1" },
		]);
		expect(apis.playlist.add).toHaveBeenCalledWith("spotify:playlist:mine", ["spotify:track:default"], {
			after: "end",
		});
	});

	it("makes the playlist private by default and public when isPublic is on", async () => {
		const apis = installPlaylistApis();
		setPlaylistConfig({ enabled: true });
		await db.playEvents.add(makePlayEvent({ startedAt: Date.now() - 1000 }));

		await buildTopSongsPlaylist();
		expect(apis.permissions.setBasePermission).toHaveBeenCalledWith("spotify:playlist:new123", "BLOCKED");

		setPlaylistConfig({ isPublic: true });
		setPlaylistState({ lastBuiltDay: null });
		await buildTopSongsPlaylist();
		expect(apis.permissions.setBasePermission).toHaveBeenLastCalledWith("spotify:playlist:new123", "VIEWER");
	});

	it("creates a fresh playlist when the stored one is gone", async () => {
		const apis = installPlaylistApis({
			getMetadata: vi.fn(async () => {
				throw new Error("not found");
			}),
		});
		setPlaylistConfig({ enabled: true });
		setPlaylistState({ playlistUri: "spotify:playlist:deleted" });
		await db.playEvents.add(makePlayEvent({ startedAt: Date.now() - 1000 }));

		const result = await buildTopSongsPlaylist();
		expect(result.status).toBe("built");
		expect(apis.rootlist.createPlaylist).toHaveBeenCalled();
		expect(getPlaylistState().playlistUri).toBe("spotify:playlist:new123");
	});
});

describe("maybeUpdateDailyPlaylist", () => {
	beforeEach(() => {
		localStorage.removeItem(LS_KEYS.PLAYLIST_CONFIG);
		localStorage.removeItem(LS_KEYS.PLAYLIST_STATE);
		statsCache.invalidate();
	});

	it("does nothing when already built today", async () => {
		const apis = installPlaylistApis();
		setPlaylistConfig({ enabled: true });
		setPlaylistState({ lastBuiltDay: toLocalDateKey(Date.now()) });
		await db.playEvents.add(makePlayEvent({ startedAt: Date.now() - 1000 }));

		await maybeUpdateDailyPlaylist();
		expect(apis.playlist.add).not.toHaveBeenCalled();
	});

	it("rebuilds when lastBuiltDay is a previous day", async () => {
		const apis = installPlaylistApis();
		setPlaylistConfig({ enabled: true });
		setPlaylistState({ lastBuiltDay: "2020-01-01" });
		await db.playEvents.add(makePlayEvent({ startedAt: Date.now() - 1000 }));

		await maybeUpdateDailyPlaylist();
		expect(apis.playlist.add).toHaveBeenCalledTimes(1);
		expect(getPlaylistState().lastBuiltDay).toBe(toLocalDateKey(Date.now()));
	});
});
