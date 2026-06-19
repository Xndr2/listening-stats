import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackingFSMDeps } from "../extension/tracker/fsm";
import { isTrackableItem, parseLocalFileUri, TrackingFSM } from "../extension/tracker/fsm";
import { LOCAL_PERIODS } from "../shared/stats/periods";
import { statsCache } from "../shared/stats/stats-cache";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

vi.mock("../shared/stats/artist-enrichment", async () => {
	const actual = await vi.importActual<typeof import("../shared/stats/artist-enrichment")>(
		"../shared/stats/artist-enrichment",
	);
	return {
		...actual,
		enrichArtists: vi.fn().mockResolvedValue(undefined),
	};
});

import { LocalProvider } from "../shared/stats/local-provider";

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

function makeDeps(overrides: Partial<TrackingFSMDeps> = {}): TrackingFSMDeps {
	return {
		addPlayEvent: vi.fn(() => Promise.resolve(true)),
		getPlayThreshold: vi.fn(() => 30000),
		isTrackingPaused: vi.fn(() => false),
		isSkipRepeatsEnabled: vi.fn(() => false),
		dispatchEvent: vi.fn(),
		...overrides,
	};
}

describe("isTrackableItem", () => {
	it("accepts regular Spotify tracks", () => {
		expect(isTrackableItem({ uri: "spotify:track:abc123" })).toBe(true);
	});

	it("accepts local files", () => {
		expect(isTrackableItem({ uri: "spotify:local:Artist:Album:Title:215" })).toBe(true);
	});

	it("rejects Spotify DJ narration by provider", () => {
		expect(isTrackableItem({ uri: "spotify:track:abc123", provider: "narration" })).toBe(false);
	});

	it("rejects ads by provider", () => {
		expect(isTrackableItem({ uri: "spotify:track:abc123", provider: "ad" })).toBe(false);
	});

	it("rejects narration/ad/interruption URIs", () => {
		expect(isTrackableItem({ uri: "spotify:narration:xyz" })).toBe(false);
		expect(isTrackableItem({ uri: "spotify:ad:xyz" })).toBe(false);
		expect(isTrackableItem({ uri: "spotify:interruption:xyz" })).toBe(false);
	});
});

describe("parseLocalFileUri", () => {
	it("returns null for non-local URIs", () => {
		expect(parseLocalFileUri("spotify:track:abc123")).toBeNull();
	});

	it("parses artist, album, and title with + as spaces", () => {
		const parsed = parseLocalFileUri("spotify:local:Daft+Punk:Discovery:One+More+Time:320");
		expect(parsed).toEqual({
			artist: "Daft Punk",
			album: "Discovery",
			title: "One More Time",
		});
	});

	it("decodes percent-encoded components", () => {
		const parsed = parseLocalFileUri("spotify:local:AC%2FDC:Back+In+Black:Hells+Bells:312");
		expect(parsed?.artist).toBe("AC/DC");
	});

	it("survives malformed percent-encoding", () => {
		const parsed = parseLocalFileUri("spotify:local:Bad%:Album:Title:100");
		expect(parsed?.artist).toBe("Bad%");
	});

	it("handles missing segments as empty strings", () => {
		const parsed = parseLocalFileUri("spotify:local:::Title+Only:90");
		expect(parsed).toEqual({ artist: "", album: "", title: "Title Only" });
	});
});

describe("TrackingFSM with DJ and local files", () => {
	let deps: ReturnType<typeof makeDeps>;
	let fsm: TrackingFSM;

	beforeEach(() => {
		deps = makeDeps();
		fsm = new TrackingFSM(deps);
	});

	it("does not start tracking a DJ narration item", async () => {
		await fsm.handleSongChange({
			isPaused: false,
			item: {
				uri: "spotify:track:dj123",
				name: "DJ intro",
				provider: "narration",
			},
		});
		expect(fsm.state).toBe("idle");
		expect(fsm.getSnapshot().capturedData).toBeNull();
	});

	it("still records the previous track when a DJ narration item starts", async () => {
		vi.useFakeTimers();
		try {
			await fsm.handleSongChange({
				isPaused: false,
				item: {
					uri: "spotify:track:song1",
					name: "Real Song",
					duration: { milliseconds: 180000 },
					metadata: { artist_name: "Artist", artist_uri: "spotify:artist:a1" },
				},
			});
			vi.advanceTimersByTime(60000);
			await fsm.handleSongChange({
				isPaused: false,
				item: {
					uri: "spotify:narration:seg1",
					name: "DJ talking",
					provider: "narration",
				},
			});
			expect(deps.addPlayEvent).toHaveBeenCalledTimes(1);
			const event = vi.mocked(deps.addPlayEvent).mock.calls[0][0];
			expect(event.trackUri).toBe("spotify:track:song1");
			expect(fsm.state).toBe("idle");
		} finally {
			vi.useRealTimers();
		}
	});

	it("tracks local files and derives stable artist/album URIs", async () => {
		await fsm.handleSongChange({
			isPaused: false,
			item: {
				uri: "spotify:local:Daft+Punk:Discovery:One+More+Time:320",
				name: "One More Time",
				duration: { milliseconds: 320000 },
				metadata: { artist_name: "Daft Punk", album_title: "Discovery" },
			},
		});
		const captured = fsm.getSnapshot().capturedData;
		expect(captured?.trackUri).toBe("spotify:local:Daft+Punk:Discovery:One+More+Time:320");
		expect(captured?.artistName).toBe("Daft Punk");
		expect(captured?.artistUri).toBe("local:artist:daft punk");
		expect(captured?.albumUri).toBe("local:album:daft punk:discovery");
	});

	it("falls back to URI-encoded metadata when Player metadata is missing", async () => {
		await fsm.handleSongChange({
			isPaused: false,
			item: {
				uri: "spotify:local:Daft+Punk:Discovery:One+More+Time:320",
				name: "",
				duration: { milliseconds: 320000 },
			},
		});
		const captured = fsm.getSnapshot().capturedData;
		expect(captured?.trackName).toBe("One More Time");
		expect(captured?.artistName).toBe("Daft Punk");
		expect(captured?.albumName).toBe("Discovery");
	});
});

describe("LocalProvider with local files and DJ history", () => {
	const allTimePeriod = LOCAL_PERIODS.find((p) => p.id === "all-time")!;
	let provider: LocalProvider;

	beforeEach(async () => {
		provider = new LocalProvider();
		statsCache.invalidate();
		await db.playEvents.clear();
	});

	it("keeps local-file artists with empty URIs as separate top artists", async () => {
		await db.playEvents.bulkAdd([
			makePlayEvent({
				trackUri: "spotify:local:A:X:Song1:200",
				trackName: "Song1",
				artistName: "Artist A",
				artistUri: "",
				albumName: "Album X",
				albumUri: "",
				startedAt: 1000,
			}),
			makePlayEvent({
				trackUri: "spotify:local:B:Y:Song2:200",
				trackName: "Song2",
				artistName: "Artist B",
				artistUri: "",
				albumName: "Album Y",
				albumUri: "",
				startedAt: 5000,
			}),
		]);

		const result = await provider.calculateStats(allTimePeriod);
		expect(result.topArtists).toHaveLength(2);
		expect(result.topAlbums).toHaveLength(2);
		const names = result.topArtists.map((a) => a.artistName).sort();
		expect(names).toEqual(["Artist A", "Artist B"]);
	});

	it("excludes DJ narration and ad events recorded by older versions", async () => {
		await db.playEvents.bulkAdd([
			makePlayEvent({ trackUri: "spotify:track:real1", startedAt: 1000 }),
			makePlayEvent({
				trackUri: "spotify:narration:dj1",
				trackName: "DJ",
				startedAt: 5000,
			}),
			makePlayEvent({
				trackUri: "spotify:ad:ad1",
				trackName: "Ad",
				startedAt: 9000,
			}),
		]);

		const result = await provider.calculateStats(allTimePeriod);
		expect(result.totalPlays).toBe(1);
		expect(result.topTracks).toHaveLength(1);
		expect(result.topTracks[0].trackUri).toBe("spotify:track:real1");
	});
});
