/**
 * Data only v3 uses: the error log, cached query results and small metadata.
 * Kept out of the v2 database so v2's schema never changes.
 */
import { lazyDb, openDb, req, txDone } from "./idb";

export const V3_DB_NAME = "listening-stats-v3";
const VERSION = 1;

export type V3Store = "errors" | "cache" | "meta";

const handle = lazyDb(() =>
	openDb(V3_DB_NAME, VERSION, (db) => {
		if (!db.objectStoreNames.contains("errors")) db.createObjectStore("errors", { autoIncrement: true });
		if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
		if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
	}),
);

export const getV3Db = handle.get;

export async function v3Get<T>(store: V3Store, key: IDBValidKey): Promise<T | undefined> {
	const db = await getV3Db();
	return req(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function v3Put(store: V3Store, value: unknown, key?: IDBValidKey): Promise<void> {
	const db = await getV3Db();
	const tx = db.transaction(store, "readwrite");
	tx.objectStore(store).put(value, key);
	await txDone(tx);
}
