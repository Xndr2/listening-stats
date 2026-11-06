/**
 * Removes everything Listening Stats keeps in this Spotify: every
 * "listening-stats:" localStorage key (settings, connections, keys) and all of
 * its IndexedDB databases (play history, v2's backup, the connection mirror,
 * v3's cache and error log). Nothing that isn't LS's is touched.
 *
 * Open handles close themselves when a delete arrives (see lazyDb), so the
 * deletes don't stay blocked. Callers reload the page afterwards: in-memory
 * state and the tracker would otherwise carry on with the old data.
 */
import { V3_PREFIX } from "../constants/storage-keys";
import { MIRROR_DB_NAME } from "./credential-mirror";
import { BACKUP_DB_NAME } from "./snapshot";
import { V2_DB_NAME } from "./v2-db";
import { V3_DB_NAME } from "./v3-db";

export const LS_DATABASES = [V2_DB_NAME, BACKUP_DB_NAME, MIRROR_DB_NAME, V3_DB_NAME];

/** "listening-stats:", shared by v2's keys and v3's own. */
const KEY_PREFIX = V3_PREFIX.slice(0, V3_PREFIX.indexOf(":") + 1);

function deleteDb(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const r = indexedDB.deleteDatabase(name);
		r.onsuccess = () => resolve();
		r.onerror = () => reject(r.error);
	});
}

export async function wipeEverything(): Promise<void> {
	await Promise.all(LS_DATABASES.map(deleteDb));
	for (const k of Object.keys(localStorage)) if (k.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
}
