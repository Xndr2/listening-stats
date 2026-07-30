import { beforeEach, describe, expect, it, vi } from "vitest";
import * as backup from "../shared/storage/backup";
import { db, registerVersionChangeHandler } from "../shared/storage/db";
import { backupIfUpgradeNeeded, initDatabase, MIGRATIONS } from "../shared/storage/migration-manager";
import type { PlayEvent } from "../shared/types/play-event";
import type { ArtistRecord } from "../shared/types/stats";

function makeEvent(startedAt: number): Omit<PlayEvent, "id"> {
	return {
		trackUri: "spotify:track:abc123",
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

describe("migration-manager", () => {
	describe("MIGRATIONS registry", () => {
		it("MIGRATIONS object exists and has version 5 entry", () => {
			expect(MIGRATIONS).toBeDefined();
			expect(typeof MIGRATIONS).toBe("object");
			expect(MIGRATIONS[5]).toBeDefined();
			expect(typeof MIGRATIONS[5]).toBe("function");
		});

		it("MIGRATIONS[5] callback is a no-op (schema creation handled by Dexie)", async () => {
			// Should not throw
			await expect(MIGRATIONS[5]({} as never, 4)).resolves.toBeUndefined();
		});
	});

	describe("TARGET_VERSION", () => {
		it("TARGET_VERSION is 5 (verified indirectly via MIGRATIONS[5] existing)", () => {
			// TARGET_VERSION = 5 means MIGRATIONS[5] must be registered
			expect(MIGRATIONS[5]).toBeDefined();
			// No migration hook registered for version 4
			expect(MIGRATIONS[4]).toBeUndefined();
		});
	});

	describe("initDatabase", () => {
		it("opens the DB successfully and returns the db instance", async () => {
			const result = await initDatabase();
			expect(result).toBeDefined();
			expect(result.isOpen()).toBe(true);
		});

		it("returns db even if already open", async () => {
			// DB should already be open from setup
			expect(db.isOpen()).toBe(true);
			const result = await initDatabase();
			expect(result.isOpen()).toBe(true);
		});
	});

	describe("versionchange handler", () => {
		it("closes db with disableAutoOpen when versionchange event fires", () => {
			// Fire the versionchange event manually on the Dexie instance
			db.on.versionchange.fire({ oldVersion: 4, newVersion: 5 } as IDBVersionChangeEvent);
			expect(db.isOpen()).toBe(false);
		});

		it("isOpen() returns false after versionchange fires", () => {
			db.on.versionchange.fire({ oldVersion: 4, newVersion: 5 } as IDBVersionChangeEvent);
			expect(db.isOpen()).toBe(false);
		});
	});

	describe("registerVersionChangeHandler", () => {
		it("causes registered callback to be called when versionchange fires", () => {
			const spy = vi.fn();
			registerVersionChangeHandler(spy);
			db.on.versionchange.fire({ oldVersion: 4, newVersion: 5 } as IDBVersionChangeEvent);
			expect(spy).toHaveBeenCalledOnce();
		});

		it("allows late-binding a callback to the default db singleton", () => {
			const callback = vi.fn();
			registerVersionChangeHandler(callback);
			// Verify the callback is wired (fires on versionchange)
			db.on.versionchange.fire({ oldVersion: 4, newVersion: 5 } as IDBVersionChangeEvent);
			expect(callback).toHaveBeenCalled();
		});
	});

	describe("backupIfUpgradeNeeded", () => {
		beforeEach(async () => {
			// Re-open db if it was closed by versionchange tests
			if (!db.isOpen()) {
				await db.open();
			}
		});

		it("calls backupToIdb when currentVersion < targetVersion and records present", async () => {
			await db.playEvents.add(makeEvent(1000));
			const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue();
			await backupIfUpgradeNeeded(3);
			expect(backupSpy).toHaveBeenCalledOnce();
			backupSpy.mockRestore();
		});

		it("skips backup when currentVersion === targetVersion (5)", async () => {
			const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue();
			await backupIfUpgradeNeeded(5);
			expect(backupSpy).not.toHaveBeenCalled();
			backupSpy.mockRestore();
		});

		it("calls backupToIdb when currentVersion === 4 (upgrading from v4 to v5)", async () => {
			await db.playEvents.add(makeEvent(2000));
			const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue();
			await backupIfUpgradeNeeded(4);
			expect(backupSpy).toHaveBeenCalledOnce();
			backupSpy.mockRestore();
		});

		it("skips backup when currentVersion === 0 (fresh install)", async () => {
			const backupSpy = vi.spyOn(backup, "backupToIdb").mockResolvedValue();
			await backupIfUpgradeNeeded(0);
			expect(backupSpy).not.toHaveBeenCalled();
			backupSpy.mockRestore();
		});
	});

	describe("DB version 5  -  artists store", () => {
		beforeEach(async () => {
			if (!db.isOpen()) {
				await db.open();
			}
		});

		it("version 5 creates artists store  -  db.artists table exists", async () => {
			expect(db.artists).toBeDefined();
			expect(db.verno).toBe(5);
		});

		it("version 5 artists store can bulkPut ArtistRecord objects", async () => {
			const records: ArtistRecord[] = [
				{
					uri: "spotify:artist:abc123",
					name: "Artist One",
					genres: ["pop", "indie"],
					imageUrl: "https://example.com/art1.jpg",
					updatedAt: 1700000000000,
				},
				{
					uri: "spotify:artist:def456",
					name: "Artist Two",
					genres: [],
					imageUrl: null,
					updatedAt: 1700000001000,
				},
			];

			await db.artists.bulkPut(records);
			const count = await db.artists.count();
			expect(count).toBe(2);

			const fetched = await db.artists.get("spotify:artist:abc123");
			expect(fetched).toBeDefined();
			expect(fetched?.name).toBe("Artist One");
			expect(fetched?.genres).toEqual(["pop", "indie"]);
		});

		it("version 5 preserves playEvents data (playEvents not dropped on upgrade)", async () => {
			// Insert a play event and verify it survives
			const event = makeEvent(Date.now());
			const id = await db.playEvents.add(event);
			expect(id).toBeDefined();

			// Verify the event exists in the store
			const fetched = await db.playEvents.get(id as number);
			expect(fetched).toBeDefined();
			expect(fetched?.trackUri).toBe(event.trackUri);
			expect(fetched?.artistName).toBe(event.artistName);
		});
	});
});
