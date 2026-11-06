/** The `artists` store: genres and images fetched from Spotify for local data. */
import type { ArtistRecord } from "../types/play-event";
import { req, txDone } from "./idb";
import { ensureFirstRunSnapshot } from "./snapshot";
import { ARTISTS, getV2Db } from "./v2-db";

export async function allArtistRecords(): Promise<Map<string, ArtistRecord>> {
	const db = await getV2Db();
	if (!db.objectStoreNames.contains(ARTISTS)) return new Map();
	const rows = (await req(db.transaction(ARTISTS).objectStore(ARTISTS).getAll())) as ArtistRecord[];
	return new Map(rows.map((r) => [r.uri, r]));
}

export async function putArtistRecords(records: ArtistRecord[]): Promise<void> {
	if (records.length === 0) return;
	await ensureFirstRunSnapshot();
	const db = await getV2Db();
	const tx = db.transaction(ARTISTS, "readwrite");
	for (const r of records) tx.objectStore(ARTISTS).put(r);
	await txDone(tx);
}
