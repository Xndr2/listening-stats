/**
 * Some Spotify/Spicetify updates wipe localStorage but keep IndexedDB. v2
 * therefore mirrors the provider connection keys into a small IndexedDB, and
 * v3 keeps that going: restore what's missing at startup, mirror on change.
 *
 * v2's mirror: "listening-stats-credentials", Dexie version(1) = native 10,
 * store "kv", out-of-line keys = the localStorage key names.
 */
import { V2_KEYS } from "../constants/storage-keys";
import { existingVersion, openDb, req, txDone } from "./idb";

export const MIRROR_DB_NAME = "listening-stats-credentials";
const MIRROR_VERSION = 10;

export const MIRRORED_KEYS = [
	V2_KEYS.STATSFM_CONFIG,
	V2_KEYS.LASTFM_CONFIG,
	V2_KEYS.LASTFM_API_KEY,
	V2_KEYS.ACTIVE_PROVIDER,
] as const;

async function openMirror(): Promise<IDBDatabase | null> {
	const v = await existingVersion(MIRROR_DB_NAME);
	const db = await openDb(MIRROR_DB_NAME, v === null ? MIRROR_VERSION : undefined, (d) => {
		if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
	});
	if (!db.objectStoreNames.contains("kv")) {
		db.close();
		return null;
	}
	return db;
}

/** Fills keys missing from localStorage from the mirror. Returns how many it restored. */
export async function restoreMissingCredentials(): Promise<number> {
	const missing = MIRRORED_KEYS.filter((k) => localStorage.getItem(k) === null);
	if (missing.length === 0) return 0;
	const db = await openMirror();
	if (!db) return 0;
	try {
		const store = db.transaction("kv").objectStore("kv");
		let restored = 0;
		for (const key of missing) {
			const value = await req(store.get(key));
			if (typeof value === "string") {
				localStorage.setItem(key, value);
				restored++;
			}
		}
		return restored;
	} finally {
		db.close();
	}
}

/** Copies the current values into the mirror; removed keys (disconnects) are removed there too. */
export async function mirrorCredentials(): Promise<void> {
	const db = await openMirror();
	if (!db) return;
	try {
		const tx = db.transaction("kv", "readwrite");
		const store = tx.objectStore("kv");
		for (const key of MIRRORED_KEYS) {
			const value = localStorage.getItem(key);
			if (value === null) store.delete(key);
			else store.put(value, key);
		}
		await txDone(tx);
	} finally {
		db.close();
	}
}
