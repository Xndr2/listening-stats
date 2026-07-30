import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { backupToIdb } from "../shared/storage/backup";
import { db } from "../shared/storage/db";
import { runStartupChecks } from "../shared/storage/integrity";
import type { PlayEvent } from "../shared/types/play-event";

function makeEvent(startedAt: number, trackUri = "spotify:track:abc123"): Omit<PlayEvent, "id"> {
	return {
		trackUri,
		trackName: "Test Track",
		artistName: "Test Artist",
		artistUri: "spotify:artist:xyz",
		albumName: "Test Album",
		albumUri: "spotify:album:def",
		albumArt: "https://example.com/art.jpg",
		durationMs: 180000,
		playedMs: 120000,
		startedAt,
		endedAt: startedAt + 120000,
		type: "play",
	};
}

afterEach(async () => {
	localStorage.clear();
	await Dexie.delete("listening-stats-backup");
});

describe("runStartupChecks", () => {
	it("returns ok=true with no wipe flags when no lastWrite in localStorage (fresh install)", async () => {
		// No lastWrite set  -  fresh install
		const result = await runStartupChecks();
		expect(result.ok).toBe(true);
		expect(result.wipeDetected).toBe(false);
		expect(result.backupAvailable).toBe(false);
		expect(result.restored).toBe(false);
		expect(result.warning).toBeUndefined();
	});

	it("returns ok=true with no wipe when lastWrite set and records present", async () => {
		await db.playEvents.add(makeEvent(1000));
		await db.playEvents.add(makeEvent(2000));
		localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));

		const result = await runStartupChecks();
		expect(result.ok).toBe(true);
		expect(result.wipeDetected).toBe(false);
	});

	it("returns ok=false with wipeDetected=true and warning when lastWrite set, zero records, no backup", async () => {
		localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));
		// Don't add any play events to db

		const result = await runStartupChecks();
		expect(result.wipeDetected).toBe(true);
		expect(result.ok).toBe(false);
		expect(result.backupAvailable).toBe(false);
		expect(result.restored).toBe(false);
		expect(result.warning).toBe("Data was wiped externally and no backup exists");
	});

	it("returns ok=true, restored=true when lastWrite set, zero records, backup available", async () => {
		// First add events and back them up
		await db.playEvents.add(makeEvent(1000));
		await db.playEvents.add(makeEvent(5000));
		await backupToIdb();
		// Simulate wipe: clear playEvents but leave localStorage
		await db.playEvents.clear();
		localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));

		const result = await runStartupChecks();
		expect(result.wipeDetected).toBe(true);
		expect(result.restored).toBe(true);
		expect(result.ok).toBe(true);
		expect(result.backupAvailable).toBe(true);
	});

	it("auto-restores correct event count after wipe with backup available", async () => {
		// Add 2 events and back them up
		await db.playEvents.add(makeEvent(1000));
		await db.playEvents.add(makeEvent(5000));
		await backupToIdb();
		// Simulate wipe
		await db.playEvents.clear();
		localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));

		await runStartupChecks();
		expect(await db.playEvents.count()).toBe(2);
	});

	it("returns ok=false with warning 'DB not openable' when db fails to open", async () => {
		localStorage.setItem(LS_KEYS.LAST_WRITE, String(Date.now()));

		// Spy on db.playEvents.count to throw
		const original = db.playEvents.count.bind(db.playEvents);
		let threw = false;
		const failingCount = async () => {
			if (!threw) {
				threw = true;
				throw new Error("DB unavailable");
			}
			return original();
		};
		db.playEvents.count = failingCount as typeof db.playEvents.count;

		const result = await runStartupChecks();
		expect(result.ok).toBe(false);
		expect(result.warning).toBe("DB not openable");

		// Restore
		db.playEvents.count = original;
	});
});
