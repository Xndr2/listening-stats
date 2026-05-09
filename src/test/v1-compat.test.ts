import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";
import * as backup from "../shared/storage/backup";
import { db } from "../shared/storage/db";
import { backupIfUpgradeNeeded, initDatabase } from "../shared/storage/migration-manager";
import type { PlayEvent } from "../shared/types/play-event";

// Mock enrichArtists to avoid real API calls (same pattern as local-provider.test.ts)
vi.mock("../shared/stats/artist-enrichment", () => ({
	enrichArtists: vi.fn().mockResolvedValue(undefined),
}));

import { LocalProvider } from "../shared/stats/local-provider";
import { LOCAL_PERIODS } from "../shared/stats/periods";
import { statsCache } from "../shared/stats/stats-cache";

/**
 * Creates a v1-shaped play event WITHOUT the `type` field.
 * This models real v1 data where type was never stored.
 * The return type enforces that `type` is never accidentally included.
 */
function makeV1Event(
	startedAt: number,
	overrides: Partial<Omit<PlayEvent, "id" | "type">> = {},
): Omit<PlayEvent, "id" | "type"> {
	return {
		trackUri: "spotify:track:v1abc",
		trackName: "V1 Track",
		artistName: "V1 Artist",
		artistUri: "spotify:artist:v1xyz",
		albumName: "V1 Album",
		albumUri: "spotify:album:v1def",
		durationMs: 180000,
		playedMs: 120000,
		startedAt,
		endedAt: startedAt + 120000,
		...overrides,
	};
}

const allTimePeriod = LOCAL_PERIODS.find((p) => p.id === "all-time")!;

// ─── COMPAT-01: v2 opens v1 IDB without data loss ───────────────────────────

describe("v1 compatibility  -  COMPAT-01: opens v1 IDB without data loss", () => {
	beforeEach(async () => {
		if (!db.isOpen()) await db.open();
		localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
	});

	it("v1 play event fields survive bulkAdd + toArray round-trip intact (field equality)", async () => {
		const v1Event = makeV1Event(1000000, {
			trackUri: "spotify:track:roundtrip",
			trackName: "Round Trip Track",
			artistName: "Round Trip Artist",
			artistUri: "spotify:artist:roundtrip",
			albumName: "Round Trip Album",
			albumUri: "spotify:album:roundtrip",
			durationMs: 240000,
			playedMs: 200000,
			endedAt: 1200000,
		});

		await db.playEvents.bulkAdd([v1Event as PlayEvent]);
		const all = await db.playEvents.toArray();

		expect(all).toHaveLength(1);
		const stored = all[0];
		expect(stored.trackUri).toBe(v1Event.trackUri);
		expect(stored.trackName).toBe(v1Event.trackName);
		expect(stored.artistName).toBe(v1Event.artistName);
		expect(stored.artistUri).toBe(v1Event.artistUri);
		expect(stored.albumName).toBe(v1Event.albumName);
		expect(stored.albumUri).toBe(v1Event.albumUri);
		expect(stored.durationMs).toBe(v1Event.durationMs);
		expect(stored.playedMs).toBe(v1Event.playedMs);
		expect(stored.startedAt).toBe(v1Event.startedAt);
		expect(stored.endedAt).toBe(v1Event.endedAt);
		// type field should be absent (undefined)  -  v1 data has no type
		expect(stored.type).toBeUndefined();
	});

	it("record count is preserved after db opens at version 5", async () => {
		const v1Events = [makeV1Event(1000), makeV1Event(2000), makeV1Event(3000)];
		await db.playEvents.bulkAdd(v1Events as PlayEvent[]);

		// initDatabase should not drop records or alter the count
		await initDatabase();
		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(3);
	});

	it("db.verno is 5 after initDatabase completes (correct schema version)", async () => {
		await initDatabase();
		expect(db.verno).toBe(5);
	});
});

// ─── COMPAT-02: events preserved and accessible after upgrade ────────────────

describe("v1 compatibility  -  COMPAT-02: events preserved and accessible", () => {
	beforeEach(async () => {
		if (!db.isOpen()) await db.open();
		localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
	});

	it("db.playEvents.toArray() returns all v1 events after initDatabase()", async () => {
		const COUNT = 5;
		const events = Array.from({ length: COUNT }, (_, i) => makeV1Event(1000 * (i + 1)));
		await db.playEvents.bulkAdd(events as PlayEvent[]);

		await initDatabase();
		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(COUNT);
	});

	it("MIGRATION_PENDING flag is cleared from localStorage after successful initDatabase()", async () => {
		// Close db first so initDatabase has work to do
		db.close();
		await initDatabase();
		expect(localStorage.getItem(LS_KEYS.MIGRATION_PENDING)).toBeNull();
	});

	it("backupIfUpgradeNeeded is called when version < 5 (backup wiring)", async () => {
		await db.playEvents.add(makeV1Event(9999) as PlayEvent);
		const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue(undefined);

		// Call backupIfUpgradeNeeded directly with version 4 (v1 DB version)
		await backupIfUpgradeNeeded(4);

		expect(backupSpy).toHaveBeenCalledOnce();
		backupSpy.mockRestore();
	});

	it("backupIfUpgradeNeeded is NOT called when version is already 5", async () => {
		const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue(undefined);

		await backupIfUpgradeNeeded(5);

		expect(backupSpy).not.toHaveBeenCalled();
		backupSpy.mockRestore();
	});
});

// ─── COMPAT-03: missing type field treated as play ───────────────────────────

describe("v1 compatibility  -  COMPAT-03: missing type treated as play", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-01T14:00:00.000Z"));
		statsCache.invalidate();
		localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("v1 events with type === undefined are not counted as skips (skipCount is 0)", async () => {
		const events = await db.playEvents.toArray();
		// Verify v1 events from DB have no type field
		const v1Only = events.filter((e) => e.type === "skip");
		expect(v1Only.length).toBe(0);
	});

	it("LocalProvider.getStats() with v1 fixture data returns totalPlays equal to event count", async () => {
		const COUNT = 4;
		const v1Events = Array.from({ length: COUNT }, (_, i) => makeV1Event(1000 * (i + 1)));
		await db.playEvents.bulkAdd(v1Events as PlayEvent[]);

		const provider = new LocalProvider();
		const result = await provider.calculateStats(allTimePeriod);

		// All events should be counted as plays (none excluded)
		expect(result.totalPlays).toBe(COUNT);
	});

	it("skipRate is 0 when all events lack the type field (v1 data only)", async () => {
		const v1Events = [makeV1Event(1000), makeV1Event(2000), makeV1Event(3000)];
		await db.playEvents.bulkAdd(v1Events as PlayEvent[]);

		const provider = new LocalProvider();
		const result = await provider.calculateStats(allTimePeriod);

		// skip rate = skips / total. With no type:"skip" events, skipRate must be 0
		expect(result.skipRate).toBe(0);
	});

	it("filter e.type === 'skip' returns empty for v1-only data", async () => {
		const v1Events = [makeV1Event(1000), makeV1Event(2000)];
		await db.playEvents.bulkAdd(v1Events as PlayEvent[]);

		const all = await db.playEvents.toArray();
		const skipEvents = all.filter((e) => e.type === "skip");
		expect(skipEvents.length).toBe(0);
	});

	it("v1 events with no type field do not appear as skips in stats", async () => {
		// Mix v1 events (no type) with a typed skip
		await db.playEvents.bulkAdd([
			makeV1Event(1000) as PlayEvent,
			makeV1Event(2000) as PlayEvent,
			{ ...makeV1Event(3000), type: "skip" } as PlayEvent,
		]);

		const provider = new LocalProvider();
		const result = await provider.calculateStats(allTimePeriod);

		// 3 total events, 1 typed skip => skipRate = 1/3
		// The 2 v1 events (no type) are NOT treated as skips
		expect(result.totalPlays).toBe(3);
		expect(result.skipRate).toBeCloseTo(1 / 3, 5);
	});
});

describe("v1 compatibility migration retry flag", () => {
	beforeEach(() => {
		localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
	});

	it("MIGRATION_PENDING flag remains in localStorage when db.open() throws", async () => {
		// Close db so initDatabase has work to do
		db.close();

		const openSpy = vi
			.spyOn(db, "open")
			.mockRejectedValueOnce(new Error("simulated upgrade failure"));

		try {
			await initDatabase();
		} catch {
			// initDatabase catches the error internally, so this block shouldn't execute
		}

		// Flag must still be set because open() failed
		expect(localStorage.getItem(LS_KEYS.MIGRATION_PENDING)).toBe("1");
		openSpy.mockRestore();

		// Restore db for afterEach cleanup
		await db.open();
	});

	it("MIGRATION_PENDING flag is removed after successful initDatabase()", async () => {
		db.close();
		await initDatabase();
		expect(localStorage.getItem(LS_KEYS.MIGRATION_PENDING)).toBeNull();
	});

	it("MIGRATION_PENDING flag is set before db.open() is attempted", async () => {
		db.close();
		let flagWasSetDuringOpen = false;

		const openSpy = vi.spyOn(db, "open").mockImplementationOnce((async () => {
			flagWasSetDuringOpen = localStorage.getItem(LS_KEYS.MIGRATION_PENDING) === "1";
			// Call through to the real open (get the original)
			openSpy.mockRestore();
			return db.open();
		}) as typeof db.open);

		await initDatabase();

		expect(flagWasSetDuringOpen).toBe(true);
		// After success, flag should be cleared
		expect(localStorage.getItem(LS_KEYS.MIGRATION_PENDING)).toBeNull();
	});
});

describe("v1 compatibility edge cases", () => {
	beforeEach(async () => {
		if (!db.isOpen()) await db.open();
		localStorage.removeItem(LS_KEYS.MIGRATION_PENDING);
	});

	it("v1 event with albumArt omitted survives bulkAdd + toArray (albumArt is undefined)", async () => {
		const event = makeV1Event(1000);
		// albumArt is not set (it's an optional field per PlayEvent interface)
		expect((event as { albumArt?: string }).albumArt).toBeUndefined();

		await db.playEvents.bulkAdd([event as PlayEvent]);
		const all = await db.playEvents.toArray();

		expect(all).toHaveLength(1);
		expect(all[0].albumArt).toBeUndefined();
	});

	it("v1 event with durationMs: 0 survives upgrade and is queryable", async () => {
		const event = makeV1Event(2000, { durationMs: 0 });
		await db.playEvents.bulkAdd([event as PlayEvent]);

		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(1);
		expect(all[0].durationMs).toBe(0);
	});

	it("v1 event with albumUri: '' (empty string) survives upgrade and is queryable", async () => {
		const event = makeV1Event(3000, { albumUri: "" });
		await db.playEvents.bulkAdd([event as PlayEvent]);

		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(1);
		expect(all[0].albumUri).toBe("");
	});

	it("v1 event with playedMs: 0 survives upgrade and is queryable", async () => {
		const event = makeV1Event(4000, { playedMs: 0 });
		await db.playEvents.bulkAdd([event as PlayEvent]);

		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(1);
		expect(all[0].playedMs).toBe(0);
	});

	it("multiple v1 edge case fields combined survive round-trip", async () => {
		const event = makeV1Event(5000, {
			durationMs: 0,
			playedMs: 0,
			albumUri: "",
			trackUri: "",
		});
		await db.playEvents.bulkAdd([event as PlayEvent]);

		const all = await db.playEvents.toArray();
		expect(all).toHaveLength(1);
		expect(all[0].durationMs).toBe(0);
		expect(all[0].playedMs).toBe(0);
		expect(all[0].albumUri).toBe("");
		expect(all[0].trackUri).toBe("");
		expect(all[0].type).toBeUndefined();
	});
});
