import { openDB, type IDBPDatabase } from "idb";
import { PlayEvent } from "../types/listeningstats";

const DB_NAME = "listening-stats";
const DB_VERSION = 3;
const STORE_NAME = "playEvents";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (db.objectStoreNames.contains(STORE_NAME) && oldVersion < 3) {
          db.deleteObjectStore(STORE_NAME);
        }

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by-startedAt", "startedAt");
          store.createIndex("by-trackUri", "trackUri");
          store.createIndex("by-artistUri", "artistUri");
        }
      },
    });
  }
  return dbPromise;
}

export async function addPlayEvent(event: PlayEvent): Promise<void> {
  const db = await getDB();
  await db.add(STORE_NAME, event);
}

export async function getPlayEventsByTimeRange(
  start: Date,
  end: Date,
): Promise<PlayEvent[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(start.getTime(), end.getTime());
  return db.getAllFromIndex(STORE_NAME, "by-startedAt", range);
}

export async function getAllPlayEvents(): Promise<PlayEvent[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
  console.log("[ListeningStats] IndexedDB data cleared");
}
