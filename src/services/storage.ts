import { openDB, deleteDB, type IDBPDatabase } from "idb";
import { PlayEvent } from "../types/listeningstats";

const DB_NAME = "listening-stats";
const DB_VERSION = 4;
const STORE_NAME = "playEvents";
const BACKUP_LS_KEY = "listening-stats:migration-backup";
const BACKUP_VERSION_KEY = "listening-stats:migration-version";
const BACKUP_DB_NAME = "listening-stats-backup";

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Create a backup of all play events before migration.
 * Always writes a fresh backup, replacing any stale backup from a previous failed attempt.
 * Tries localStorage first; falls back to a separate IndexedDB database on QuotaExceededError.
 */
async function backupBeforeMigration(): Promise<PlayEvent[]> {
  let events: PlayEvent[] = [];

  try {
    const currentDb = await openDB(DB_NAME);
    const version = currentDb.version;

    if (currentDb.objectStoreNames.contains(STORE_NAME)) {
      events = await currentDb.getAll(STORE_NAME);
    }
    currentDb.close();

    if (events.length === 0) {
      return events;
    }

    // Store old version so we know a migration is in progress
    localStorage.setItem(BACKUP_VERSION_KEY, String(version));

    // Try localStorage first (always overwrite any stale backup)
    try {
      const json = JSON.stringify(events);
      localStorage.setItem(BACKUP_LS_KEY, json);
      console.log(`[ListeningStats] Backed up ${events.length} events to localStorage`);
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        // localStorage full -- fall back to separate IndexedDB database
        console.warn("[ListeningStats] localStorage full, using IndexedDB backup");
        localStorage.removeItem(BACKUP_LS_KEY);

        // Always replace stale backup DB
        try {
          await deleteDB(BACKUP_DB_NAME);
        } catch {
          // ignore if it doesn't exist
        }

        const backupDb = await openDB(BACKUP_DB_NAME, 1, {
          upgrade(db) {
            db.createObjectStore("backup");
          },
        });
        await backupDb.put("backup", events, "events");
        backupDb.close();
        console.log(`[ListeningStats] Backed up ${events.length} events to IndexedDB`);
      } else {
        throw e;
      }
    }
  } catch (e) {
    console.error("[ListeningStats] Backup failed:", e);
  }

  return events;
}

/**
 * Restore play events from backup after a failed migration.
 * Reads from localStorage first, then falls back to the backup IndexedDB database.
 */
async function restoreFromBackup(): Promise<void> {
  let events: PlayEvent[] | null = null;

  // Try localStorage first
  try {
    const json = localStorage.getItem(BACKUP_LS_KEY);
    if (json) {
      events = JSON.parse(json);
    }
  } catch {
    // corrupted JSON, try IndexedDB
  }

  // Fall back to IndexedDB backup
  if (!events) {
    try {
      const backupDb = await openDB(BACKUP_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("backup")) {
            db.createObjectStore("backup");
          }
        },
      });
      events = await backupDb.get("backup", "events");
      backupDb.close();
    } catch {
      // No backup database exists
    }
  }

  if (events && events.length > 0) {
    try {
      // Open the DB at whatever version it ended up at
      const db = await openDB(DB_NAME);
      if (db.objectStoreNames.contains(STORE_NAME)) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        await tx.store.clear();
        for (const event of events) {
          await tx.store.add(event);
        }
        await tx.done;
        console.log(`[ListeningStats] Restored ${events.length} events from backup`);
      }
      db.close();
    } catch (e) {
      console.error("[ListeningStats] Restore failed:", e);
    }
  }

  // Clean up backup artifacts regardless
  await cleanupBackup();
}

/**
 * Remove all backup artifacts (localStorage keys and backup IndexedDB database).
 * Called after both successful migration and successful rollback.
 */
async function cleanupBackup(): Promise<void> {
  try {
    localStorage.removeItem(BACKUP_LS_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(BACKUP_VERSION_KEY);
  } catch {
    // ignore
  }
  try {
    await deleteDB(BACKUP_DB_NAME);
  } catch {
    // ignore if it doesn't exist
  }
}

export function resetDBPromise(): void {
  dbPromise = null;
}

export async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = initDB();
  }
  try {
    const db = await dbPromise;
    // Verify connection is still valid
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      dbPromise = initDB();
      return dbPromise;
    }
    return db;
  } catch {
    // Connection failed, retry with fresh init
    dbPromise = initDB();
    return dbPromise;
  }
}

async function initDB(): Promise<IDBPDatabase> {
  // Check if DB already exists without creating an empty one
  let needsBackup = false;
  let oldDbVersion = 0;

  try {
    const databases = await indexedDB.databases();
    const existing = databases.find((db) => db.name === DB_NAME);
    if (existing && existing.version) {
      oldDbVersion = existing.version;
      needsBackup = oldDbVersion < DB_VERSION;
    }
  } catch {
    // indexedDB.databases() not supported — fall back to opening
    try {
      const existingDb = await openDB(DB_NAME);
      oldDbVersion = existingDb.version;
      existingDb.close();
      needsBackup = oldDbVersion < DB_VERSION && oldDbVersion > 0;
    } catch {
      needsBackup = false;
    }
  }

  // Back up before migration if the DB exists and is an older version
  if (needsBackup) {
    await backupBeforeMigration();
  }

  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Ensure store exists (handles both fresh install and corrupted state)
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by-startedAt", "startedAt");
          store.createIndex("by-trackUri", "trackUri");
          store.createIndex("by-artistUri", "artistUri");
          store.createIndex("by-type", "type");
        } else {
          // Store exists — add any missing indexes
          const store = transaction.objectStore(STORE_NAME);
          if (!store.indexNames.contains("by-startedAt")) {
            store.createIndex("by-startedAt", "startedAt");
          }
          if (!store.indexNames.contains("by-trackUri")) {
            store.createIndex("by-trackUri", "trackUri");
          }
          if (!store.indexNames.contains("by-artistUri")) {
            store.createIndex("by-artistUri", "artistUri");
          }
          if (!store.indexNames.contains("by-type")) {
            store.createIndex("by-type", "type");
          }
        }
      },
    });

    // Successful migration -- clean up backup and notify user
    if (needsBackup) {
      await cleanupBackup();
      Spicetify?.showNotification?.("Database updated successfully");
      console.log(`[ListeningStats] Migration from v${oldDbVersion} to v${DB_VERSION} complete`);
    }

    // Run one-time dedup pass if needed
    const dedupDone = localStorage.getItem("listening-stats:dedup-done");
    if (!dedupDone) {
      const removed = await runDedup(db);
      if (removed > 0) {
        Spicetify?.showNotification?.(`Cleaned up ${removed} duplicate entries`);
      }
      localStorage.setItem("listening-stats:dedup-done", "1");
    }

    return db;
  } catch (e) {
    console.error("[ListeningStats] Migration failed, attempting rollback:", e);

    if (needsBackup) {
      await restoreFromBackup();
    }

    // Re-open at whatever version the DB is now (fallback)
    const fallbackDb = await openDB(DB_NAME);
    console.log(`[ListeningStats] Opened fallback DB at v${fallbackDb.version}`);
    return fallbackDb;
  }
}

/**
 * Internal dedup runner that operates on an already-opened database.
 */
async function runDedup(db: IDBPDatabase): Promise<number> {
  try {
    const allEvents: PlayEvent[] = await db.getAll(STORE_NAME);
    const seen = new Set<string>();
    const duplicateIds: number[] = [];

    for (const event of allEvents) {
      const key = `${event.trackUri}:${event.startedAt}`;
      if (seen.has(key)) {
        duplicateIds.push(event.id!);
      } else {
        seen.add(key);
      }
    }

    if (duplicateIds.length > 0) {
      const tx = db.transaction(STORE_NAME, "readwrite");
      for (const id of duplicateIds) {
        tx.store.delete(id);
      }
      await tx.done;
      console.log(`[ListeningStats] Removed ${duplicateIds.length} duplicate events`);
    }

    return duplicateIds.length;
  } catch (e) {
    console.error("[ListeningStats] Dedup failed:", e);
    return 0;
  }
}

export async function addPlayEvent(event: PlayEvent): Promise<boolean> {
  const db = await getDB();
  const range = IDBKeyRange.only(event.startedAt);
  const existing = await db.getAllFromIndex(STORE_NAME, "by-startedAt", range);
  if (existing.some((e: PlayEvent) => e.trackUri === event.trackUri)) {
    console.warn("[ListeningStats] Duplicate event blocked:", event.trackName);
    return false;
  }
  await db.add(STORE_NAME, event);
  return true;
}

export async function deduplicateExistingEvents(): Promise<number> {
  const db = await getDB();
  return runDedup(db);
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
  resetDBPromise();
  console.log("[ListeningStats] IndexedDB data cleared");
}
