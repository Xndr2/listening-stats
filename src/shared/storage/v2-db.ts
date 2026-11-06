/**
 * The play history database, shared with v2.
 *
 * v2 used Dexie, which multiplies declared versions by 10: Dexie version(5)
 * is native version 50. v3 never bumps it (a user who downgrades to v2 must
 * still be able to open it) and creates it with v2's exact schema when it
 * doesn't exist yet. v3-only data lives in v3-db.ts.
 */
import { existingVersion, lazyDb, openDb, withLock } from "./idb";

export const V2_DB_NAME = "listening-stats";
export const V2_DB_VERSION = 50;
export const PLAY_EVENTS = "playEvents";
export const ARTISTS = "artists";

/** Creates whatever v2 stores are missing, with v2's index specs. */
function ensureV2Schema(db: IDBDatabase): void {
	if (!db.objectStoreNames.contains(PLAY_EVENTS)) {
		const s = db.createObjectStore(PLAY_EVENTS, { keyPath: "id", autoIncrement: true });
		for (const idx of ["startedAt", "trackUri", "artistUri", "type"]) s.createIndex(idx, idx);
	}
	if (!db.objectStoreNames.contains(ARTISTS)) {
		const s = db.createObjectStore(ARTISTS, { keyPath: "uri" });
		s.createIndex("updatedAt", "updatedAt");
	}
}

async function openV2(): Promise<IDBDatabase> {
	return withLock("listening-stats:open-v2-db", async () => {
		const version = await existingVersion(V2_DB_NAME);
		// Absent, or an older v2 install (native 40 had no artists store):
		// bring it to exactly 50. A versionless open would make an empty v1 DB.
		if (version === null || version < V2_DB_VERSION) {
			return openDb(V2_DB_NAME, V2_DB_VERSION, (db) => ensureV2Schema(db));
		}
		return openDb(V2_DB_NAME, undefined);
	});
}

const handle = lazyDb(openV2);

export const getV2Db = handle.get;
