/**
 * Before v3 writes to the shared play history for the first time, it copies
 * every play event into v2's own backup database, in v2's format, so v2's
 * "restore from backup" still works after a downgrade.
 *
 * v2's backup DB: "listening-stats-backup", Dexie version(1) = native 10,
 * store "snapshots" with out-of-line keys, the snapshot under "latest".
 * If v2 already left a "latest" snapshot we keep it and write ours next to it.
 */
import { V3_KEYS } from "../constants/storage-keys";
import type { PlayEvent } from "../types/play-event";
import { existingVersion, openDb, req, txDone, withLock } from "./idb";
import { setLocal } from "./local";
import { getV2Db, PLAY_EVENTS, V2_DB_VERSION } from "./v2-db";

export const BACKUP_DB_NAME = "listening-stats-backup";
const BACKUP_DB_VERSION = 10;
const STORE = "snapshots";
export const V3_SNAPSHOT_KEY = "v3-pre-migration";

/** v2's ExportEnvelope. */
export interface SnapshotEnvelope {
	version: 1;
	exportedAt: number;
	fromDbVersion: number;
	count: number;
	events: PlayEvent[];
}

/** Set when the flag couldn't be stored, so a full localStorage doesn't snapshot on every write. */
let doneThisSession = false;

function isDone(): boolean {
	if (doneThisSession) return true;
	try {
		return localStorage.getItem(V3_KEYS.FIRST_RUN_SNAPSHOT_DONE) === "1";
	} catch {
		return false;
	}
}

async function openBackupDb(): Promise<IDBDatabase> {
	const v = await existingVersion(BACKUP_DB_NAME);
	return openDb(BACKUP_DB_NAME, v === null ? BACKUP_DB_VERSION : undefined, (db) => {
		if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
	});
}

/** Takes the one-time snapshot if it hasn't been taken. Safe to call before every write. */
export async function ensureFirstRunSnapshot(): Promise<void> {
	if (isDone()) return;
	await withLock("listening-stats:snapshot", async () => {
		if (isDone()) return;
		const db = await getV2Db();
		const events = (await req(db.transaction(PLAY_EVENTS).objectStore(PLAY_EVENTS).getAll())) as PlayEvent[];
		if (events.length > 0) {
			const backup = await openBackupDb();
			try {
				if (!backup.objectStoreNames.contains(STORE)) throw new Error("v2 backup DB has no snapshots store");
				const tx = backup.transaction(STORE, "readwrite");
				const store = tx.objectStore(STORE);
				const hasLatest = (await req(store.count("latest"))) > 0;
				const envelope: SnapshotEnvelope = {
					version: 1,
					exportedAt: Date.now(),
					// v2 records Dexie's version number (native / 10), so do the same.
					fromDbVersion: V2_DB_VERSION / 10,
					count: events.length,
					events,
				};
				store.put(envelope, hasLatest ? V3_SNAPSHOT_KEY : "latest");
				await txDone(tx);
			} finally {
				backup.close();
			}
		}
		doneThisSession = !setLocal(V3_KEYS.FIRST_RUN_SNAPSHOT_DONE, "1");
	});
}
