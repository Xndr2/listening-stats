var ListeningStatsApp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/idb/build/index.js
  function getIdbProxyableTypes() {
    return idbProxyableTypes || (idbProxyableTypes = [
      IDBDatabase,
      IDBObjectStore,
      IDBIndex,
      IDBCursor,
      IDBTransaction
    ]);
  }
  function getCursorAdvanceMethods() {
    return cursorAdvanceMethods || (cursorAdvanceMethods = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey
    ]);
  }
  function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
      const unlisten = () => {
        request.removeEventListener("success", success);
        request.removeEventListener("error", error);
      };
      const success = () => {
        resolve(wrap(request.result));
        unlisten();
      };
      const error = () => {
        reject(request.error);
        unlisten();
      };
      request.addEventListener("success", success);
      request.addEventListener("error", error);
    });
    reverseTransformCache.set(promise, request);
    return promise;
  }
  function cacheDonePromiseForTransaction(tx) {
    if (transactionDoneMap.has(tx))
      return;
    const done = new Promise((resolve, reject) => {
      const unlisten = () => {
        tx.removeEventListener("complete", complete);
        tx.removeEventListener("error", error);
        tx.removeEventListener("abort", error);
      };
      const complete = () => {
        resolve();
        unlisten();
      };
      const error = () => {
        reject(tx.error || new DOMException("AbortError", "AbortError"));
        unlisten();
      };
      tx.addEventListener("complete", complete);
      tx.addEventListener("error", error);
      tx.addEventListener("abort", error);
    });
    transactionDoneMap.set(tx, done);
  }
  function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
  }
  function wrapFunction(func) {
    if (getCursorAdvanceMethods().includes(func)) {
      return function(...args) {
        func.apply(unwrap(this), args);
        return wrap(this.request);
      };
    }
    return function(...args) {
      return wrap(func.apply(unwrap(this), args));
    };
  }
  function transformCachableValue(value) {
    if (typeof value === "function")
      return wrapFunction(value);
    if (value instanceof IDBTransaction)
      cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
      return new Proxy(value, idbProxyTraps);
    return value;
  }
  function wrap(value) {
    if (value instanceof IDBRequest)
      return promisifyRequest(value);
    if (transformCache.has(value))
      return transformCache.get(value);
    const newValue = transformCachableValue(value);
    if (newValue !== value) {
      transformCache.set(value, newValue);
      reverseTransformCache.set(newValue, value);
    }
    return newValue;
  }
  function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
      request.addEventListener("upgradeneeded", (event) => {
        upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
      });
    }
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event.newVersion,
        event
      ));
    }
    openPromise.then((db) => {
      if (terminated)
        db.addEventListener("close", () => terminated());
      if (blocking) {
        db.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
      }
    }).catch(() => {
    });
    return openPromise;
  }
  function deleteDB(name, { blocked } = {}) {
    const request = indexedDB.deleteDatabase(name);
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event
      ));
    }
    return wrap(request).then(() => void 0);
  }
  function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
      return;
    }
    if (cachedMethods.get(prop))
      return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, "");
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
      // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
      !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
    ) {
      return;
    }
    const method = async function(storeName, ...args) {
      const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
      let target2 = tx.store;
      if (useIndex)
        target2 = target2.index(args.shift());
      return (await Promise.all([
        target2[targetFuncName](...args),
        isWrite && tx.done
      ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
  }
  async function* iterate(...args) {
    let cursor = this;
    if (!(cursor instanceof IDBCursor)) {
      cursor = await cursor.openCursor(...args);
    }
    if (!cursor)
      return;
    cursor = cursor;
    const proxiedCursor = new Proxy(cursor, cursorIteratorTraps);
    ittrProxiedCursorToOriginalProxy.set(proxiedCursor, cursor);
    reverseTransformCache.set(proxiedCursor, unwrap(cursor));
    while (cursor) {
      yield proxiedCursor;
      cursor = await (advanceResults.get(proxiedCursor) || cursor.continue());
      advanceResults.delete(proxiedCursor);
    }
  }
  function isIteratorProp(target, prop) {
    return prop === Symbol.asyncIterator && instanceOfAny(target, [IDBIndex, IDBObjectStore, IDBCursor]) || prop === "iterate" && instanceOfAny(target, [IDBIndex, IDBObjectStore]);
  }
  var instanceOfAny, idbProxyableTypes, cursorAdvanceMethods, transactionDoneMap, transformCache, reverseTransformCache, idbProxyTraps, unwrap, readMethods, writeMethods, cachedMethods, advanceMethodProps, methodMap, advanceResults, ittrProxiedCursorToOriginalProxy, cursorIteratorTraps;
  var init_build = __esm({
    "node_modules/idb/build/index.js"() {
      instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
      transactionDoneMap = /* @__PURE__ */ new WeakMap();
      transformCache = /* @__PURE__ */ new WeakMap();
      reverseTransformCache = /* @__PURE__ */ new WeakMap();
      idbProxyTraps = {
        get(target, prop, receiver) {
          if (target instanceof IDBTransaction) {
            if (prop === "done")
              return transactionDoneMap.get(target);
            if (prop === "store") {
              return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
            }
          }
          return wrap(target[prop]);
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        },
        has(target, prop) {
          if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
            return true;
          }
          return prop in target;
        }
      };
      unwrap = (value) => reverseTransformCache.get(value);
      readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
      writeMethods = ["put", "add", "delete", "clear"];
      cachedMethods = /* @__PURE__ */ new Map();
      replaceTraps((oldTraps) => ({
        ...oldTraps,
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
      }));
      advanceMethodProps = ["continue", "continuePrimaryKey", "advance"];
      methodMap = {};
      advanceResults = /* @__PURE__ */ new WeakMap();
      ittrProxiedCursorToOriginalProxy = /* @__PURE__ */ new WeakMap();
      cursorIteratorTraps = {
        get(target, prop) {
          if (!advanceMethodProps.includes(prop))
            return target[prop];
          let cachedFunc = methodMap[prop];
          if (!cachedFunc) {
            cachedFunc = methodMap[prop] = function(...args) {
              advanceResults.set(this, ittrProxiedCursorToOriginalProxy.get(this)[prop](...args));
            };
          }
          return cachedFunc;
        }
      };
      replaceTraps((oldTraps) => ({
        ...oldTraps,
        get(target, prop, receiver) {
          if (isIteratorProp(target, prop))
            return iterate;
          return oldTraps.get(target, prop, receiver);
        },
        has(target, prop) {
          return isIteratorProp(target, prop) || oldTraps.has(target, prop);
        }
      }));
    }
  });

  // src/services/storage.ts
  var storage_exports = {};
  __export(storage_exports, {
    addPlayEvent: () => addPlayEvent,
    clearAllData: () => clearAllData,
    deduplicateExistingEvents: () => deduplicateExistingEvents,
    getAllPlayEvents: () => getAllPlayEvents,
    getDB: () => getDB,
    getPlayEventsByTimeRange: () => getPlayEventsByTimeRange,
    resetDBPromise: () => resetDBPromise
  });
  async function backupBeforeMigration() {
    let events = [];
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
      localStorage.setItem(BACKUP_VERSION_KEY, String(version));
      try {
        const json = JSON.stringify(events);
        localStorage.setItem(BACKUP_LS_KEY, json);
        console.log(`[ListeningStats] Backed up ${events.length} events to localStorage`);
      } catch (e) {
        if (e?.name === "QuotaExceededError" || e?.code === 22) {
          console.warn("[ListeningStats] localStorage full, using IndexedDB backup");
          localStorage.removeItem(BACKUP_LS_KEY);
          try {
            await deleteDB(BACKUP_DB_NAME);
          } catch {
          }
          const backupDb = await openDB(BACKUP_DB_NAME, 1, {
            upgrade(db) {
              db.createObjectStore("backup");
            }
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
  async function restoreFromBackup() {
    let events = null;
    try {
      const json = localStorage.getItem(BACKUP_LS_KEY);
      if (json) {
        events = JSON.parse(json);
      }
    } catch {
    }
    if (!events) {
      try {
        const backupDb = await openDB(BACKUP_DB_NAME, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains("backup")) {
              db.createObjectStore("backup");
            }
          }
        });
        events = await backupDb.get("backup", "events");
        backupDb.close();
      } catch {
      }
    }
    if (events && events.length > 0) {
      try {
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
    await cleanupBackup();
  }
  async function cleanupBackup() {
    try {
      localStorage.removeItem(BACKUP_LS_KEY);
    } catch {
    }
    try {
      localStorage.removeItem(BACKUP_VERSION_KEY);
    } catch {
    }
    try {
      await deleteDB(BACKUP_DB_NAME);
    } catch {
    }
  }
  function resetDBPromise() {
    dbPromise = null;
  }
  async function getDB() {
    if (!dbPromise) {
      dbPromise = initDB();
    }
    try {
      const db = await dbPromise;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        dbPromise = initDB();
        return dbPromise;
      }
      return db;
    } catch {
      dbPromise = initDB();
      return dbPromise;
    }
  }
  async function initDB() {
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
      try {
        const existingDb = await openDB(DB_NAME);
        oldDbVersion = existingDb.version;
        existingDb.close();
        needsBackup = oldDbVersion < DB_VERSION && oldDbVersion > 0;
      } catch {
        needsBackup = false;
      }
    }
    if (needsBackup) {
      await backupBeforeMigration();
    }
    try {
      const db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db2, oldVersion, _newVersion, transaction) {
          if (!db2.objectStoreNames.contains(STORE_NAME)) {
            const store = db2.createObjectStore(STORE_NAME, {
              keyPath: "id",
              autoIncrement: true
            });
            store.createIndex("by-startedAt", "startedAt");
            store.createIndex("by-trackUri", "trackUri");
            store.createIndex("by-artistUri", "artistUri");
            store.createIndex("by-type", "type");
          } else {
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
        }
      });
      if (needsBackup) {
        await cleanupBackup();
        Spicetify?.showNotification?.("Database updated successfully");
        console.log(`[ListeningStats] Migration from v${oldDbVersion} to v${DB_VERSION} complete`);
      }
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
      const fallbackDb = await openDB(DB_NAME);
      console.log(`[ListeningStats] Opened fallback DB at v${fallbackDb.version}`);
      return fallbackDb;
    }
  }
  async function runDedup(db) {
    try {
      const allEvents = await db.getAll(STORE_NAME);
      const seen = /* @__PURE__ */ new Set();
      const duplicateIds = [];
      for (const event of allEvents) {
        const key = `${event.trackUri}:${event.startedAt}`;
        if (seen.has(key)) {
          duplicateIds.push(event.id);
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
  async function addPlayEvent(event) {
    const db = await getDB();
    const range = IDBKeyRange.only(event.startedAt);
    const existing = await db.getAllFromIndex(STORE_NAME, "by-startedAt", range);
    if (existing.some((e) => e.trackUri === event.trackUri)) {
      console.warn("[ListeningStats] Duplicate event blocked:", event.trackName);
      return false;
    }
    await db.add(STORE_NAME, event);
    return true;
  }
  async function deduplicateExistingEvents() {
    const db = await getDB();
    return runDedup(db);
  }
  async function getPlayEventsByTimeRange(start, end) {
    const db = await getDB();
    const range = IDBKeyRange.bound(start.getTime(), end.getTime());
    return db.getAllFromIndex(STORE_NAME, "by-startedAt", range);
  }
  async function getAllPlayEvents() {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  }
  async function clearAllData() {
    const db = await getDB();
    await db.clear(STORE_NAME);
    resetDBPromise();
    console.log("[ListeningStats] IndexedDB data cleared");
  }
  var DB_NAME, DB_VERSION, STORE_NAME, BACKUP_LS_KEY, BACKUP_VERSION_KEY, BACKUP_DB_NAME, dbPromise;
  var init_storage = __esm({
    "src/services/storage.ts"() {
      init_build();
      DB_NAME = "listening-stats";
      DB_VERSION = 4;
      STORE_NAME = "playEvents";
      BACKUP_LS_KEY = "listening-stats:migration-backup";
      BACKUP_VERSION_KEY = "listening-stats:migration-version";
      BACKUP_DB_NAME = "listening-stats-backup";
      dbPromise = null;
    }
  });

  // src/app/index.tsx
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/services/api-resilience.ts
  var ApiError = class extends Error {
    constructor(message, statusCode, retryable = false) {
      super(message);
      this.statusCode = statusCode;
      this.retryable = retryable;
      this.name = "ApiError";
    }
  };
  var CircuitBreaker = class {
    constructor(failureThreshold = 5, resetTimeoutMs = 6e4) {
      this.failureThreshold = failureThreshold;
      this.resetTimeoutMs = resetTimeoutMs;
      this.state = "closed";
      this.failures = 0;
      this.lastFailure = 0;
    }
    async execute(fn) {
      if (this.state === "open") {
        if (Date.now() - this.lastFailure >= this.resetTimeoutMs) {
          this.state = "half_open";
        } else {
          throw new ApiError(
            "Circuit open: API temporarily unavailable",
            void 0,
            true
          );
        }
      }
      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
    reset() {
      this.failures = 0;
      this.state = "closed";
    }
    onSuccess() {
      this.failures = 0;
      this.state = "closed";
    }
    onFailure() {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.failureThreshold) {
        this.state = "open";
      }
    }
  };
  function createBatchCoalescer(batchFn, windowMs = 50, maxBatch = 50) {
    let pending = /* @__PURE__ */ new Map();
    let timer = null;
    function flush() {
      timer = null;
      const batch = pending;
      pending = /* @__PURE__ */ new Map();
      const keys = [...batch.keys()];
      batchFn(keys).then((results) => {
        for (const [key, entries] of batch) {
          const val = results.get(key);
          for (const entry of entries) {
            entry.resolve(val);
          }
        }
      }).catch((err) => {
        for (const entries of batch.values()) {
          for (const entry of entries) {
            entry.reject(err);
          }
        }
      });
    }
    return function request(key) {
      return new Promise((resolve, reject) => {
        const entries = pending.get(key) || [];
        entries.push({ resolve, reject });
        pending.set(key, entries);
        if (pending.size >= maxBatch) {
          if (timer) clearTimeout(timer);
          flush();
        } else if (!timer) {
          timer = setTimeout(flush, windowMs);
        }
      });
    };
  }

  // src/services/preferences.ts
  var PREFS_KEY = "listening-stats:preferences";
  var PREFS_CHANGED_EVENT = "listening-stats:prefs-changed";
  var DEFAULTS = {
    use24HourTime: false,
    itemsPerSection: 5,
    genresPerSection: 5,
    hiddenSections: []
  };
  var cached = null;
  function getPreferences() {
    if (cached) return cached;
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        cached = { ...DEFAULTS, ...JSON.parse(stored) };
        return cached;
      }
    } catch {
    }
    cached = { ...DEFAULTS };
    return cached;
  }
  function setPreference(key, value) {
    const prefs = getPreferences();
    prefs[key] = value;
    cached = prefs;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
    }
    window.dispatchEvent(
      new CustomEvent(PREFS_CHANGED_EVENT, { detail: { key, value } })
    );
  }
  function onPreferencesChanged(callback) {
    const handler = (e) => {
      const { key, value } = e.detail;
      callback(key, value);
    };
    window.addEventListener(PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
  }

  // src/services/lastfm.ts
  var LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
  var STORAGE_KEY = "listening-stats:lastfm";
  var CACHE_TTL_MS = 3e5;
  var configCache = void 0;
  function getConfig() {
    if (configCache !== void 0) return configCache;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        configCache = JSON.parse(stored);
        return configCache;
      }
    } catch {
    }
    configCache = null;
    return null;
  }
  function saveConfig(config) {
    configCache = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
  function clearConfig() {
    configCache = null;
    localStorage.removeItem(STORAGE_KEY);
  }
  function isConnected() {
    const config = getConfig();
    return !!(config?.username && config?.apiKey);
  }
  var cache = /* @__PURE__ */ new Map();
  function getCached(key) {
    const entry = cache.get(key);
    if (!entry || Date.now() >= entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache(key, data) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  function clearLastfmCache() {
    cache.clear();
  }
  var LASTFM_PLACEHOLDER_HASHES = [
    "2a96cbd8b46e442fc41c2b86b821562f",
    "c6f59c1e5e7240a4c0d427abd71f3dbb"
  ];
  function isPlaceholderImage(url) {
    return LASTFM_PLACEHOLDER_HASHES.some((h) => url.includes(h));
  }
  async function lastfmFetch(params) {
    const config = getConfig();
    if (!config) throw new Error("Last.fm not configured");
    const url = new URL(LASTFM_API_URL);
    url.searchParams.set("api_key", config.apiKey);
    url.searchParams.set("format", "json");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const cacheKey = url.toString();
    const cached2 = getCached(cacheKey);
    if (cached2) return cached2;
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 403) throw new Error("Invalid Last.fm API key");
      if (response.status === 429) throw new Error("Last.fm rate limited");
      throw new Error(`Last.fm API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.message || `Last.fm error ${data.error}`);
    }
    setCache(cacheKey, data);
    return data;
  }
  async function validateUser(username, apiKey) {
    const url = new URL(LASTFM_API_URL);
    url.searchParams.set("method", "user.getinfo");
    url.searchParams.set("user", username);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 403) throw new Error("Invalid API key");
      throw new Error(`Validation failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.message || "User not found");
    }
    const user = data.user;
    return {
      valid: true,
      username: user.name,
      totalScrobbles: parseInt(user.playcount, 10) || 0,
      registered: user.registered?.["#text"] || "",
      imageUrl: user.image?.find((i) => i.size === "medium")?.["#text"]
    };
  }
  async function getTopTracks(period, limit = 200) {
    const config = getConfig();
    if (!config) return { tracks: [], total: 0 };
    const data = await lastfmFetch({
      method: "user.gettoptracks",
      user: config.username,
      period,
      limit: String(limit)
    });
    const total = parseInt(data.toptracks?.["@attr"]?.total || "0", 10);
    const tracks = (data.toptracks?.track || []).map((t) => {
      const img = t.image?.find((i) => i.size === "large")?.["#text"]?.trim();
      return {
        name: t.name,
        artist: t.artist?.name || "",
        playCount: parseInt(t.playcount, 10) || 0,
        mbid: t.mbid || void 0,
        url: t.url,
        imageUrl: img && !isPlaceholderImage(img) ? img : void 0,
        durationSecs: parseInt(t.duration, 10) || void 0
      };
    });
    return { tracks, total };
  }
  async function getTopArtists(period, limit = 100) {
    const config = getConfig();
    if (!config) return { artists: [], total: 0 };
    const data = await lastfmFetch({
      method: "user.gettopartists",
      user: config.username,
      period,
      limit: String(limit)
    });
    const total = parseInt(data.topartists?.["@attr"]?.total || "0", 10);
    const artists = (data.topartists?.artist || []).map((a) => {
      const img = a.image?.find((i) => i.size === "large")?.["#text"]?.trim();
      return {
        name: a.name,
        playCount: parseInt(a.playcount, 10) || 0,
        mbid: a.mbid || void 0,
        url: a.url,
        imageUrl: img && !isPlaceholderImage(img) ? img : void 0
      };
    });
    return { artists, total };
  }
  async function getTopAlbums(period, limit = 100) {
    const config = getConfig();
    if (!config) return { albums: [], total: 0 };
    const data = await lastfmFetch({
      method: "user.gettopalbums",
      user: config.username,
      period,
      limit: String(limit)
    });
    const total = parseInt(data.topalbums?.["@attr"]?.total || "0", 10);
    const albums = (data.topalbums?.album || []).map((a) => {
      const img = a.image?.find((i) => i.size === "large")?.["#text"]?.trim();
      return {
        name: a.name,
        artist: a.artist?.name || "",
        playCount: parseInt(a.playcount, 10) || 0,
        mbid: a.mbid || void 0,
        url: a.url,
        imageUrl: img && !isPlaceholderImage(img) ? img : void 0
      };
    });
    return { albums, total };
  }
  async function getRecentTracks(limit = 50) {
    const config = getConfig();
    if (!config) return [];
    const data = await lastfmFetch({
      method: "user.getrecenttracks",
      user: config.username,
      limit: String(limit)
    });
    const tracks = data.recenttracks?.track || [];
    return tracks.filter((t) => t.date || t["@attr"]?.nowplaying).map((t) => {
      const img = t.image?.find((i) => i.size === "large")?.["#text"]?.trim();
      return {
        name: t.name,
        artist: t.artist?.["#text"] || t.artist?.name || "",
        album: t.album?.["#text"] || "",
        albumArt: img && !isPlaceholderImage(img) ? img : void 0,
        playedAt: t.date?.uts ? new Date(parseInt(t.date.uts, 10) * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        nowPlaying: t["@attr"]?.nowplaying === "true"
      };
    });
  }
  async function getUserInfo() {
    const config = getConfig();
    if (!config) return null;
    try {
      return await validateUser(config.username, config.apiKey);
    } catch {
      return null;
    }
  }

  // src/services/tracker.ts
  init_storage();
  var STORAGE_KEY2 = "listening-stats:pollingData";
  var LOGGING_KEY = "listening-stats:logging";
  var STATS_UPDATED_EVENT = "listening-stats:updated";
  var THRESHOLD_KEY = "listening-stats:playThreshold";
  var DEFAULT_THRESHOLD_MS = 1e4;
  var activeProviderType = null;
  function isLoggingEnabled() {
    try {
      return localStorage.getItem(LOGGING_KEY) === "1";
    } catch {
      return false;
    }
  }
  function setLoggingEnabled(enabled) {
    try {
      if (enabled) localStorage.setItem(LOGGING_KEY, "1");
      else localStorage.removeItem(LOGGING_KEY);
    } catch {
    }
  }
  function getPlayThreshold() {
    try {
      const stored = localStorage.getItem(THRESHOLD_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        if (val >= 0 && val <= 6e4) return val;
      }
    } catch {
    }
    return DEFAULT_THRESHOLD_MS;
  }
  function log(...args) {
    if (isLoggingEnabled()) console.log("[ListeningStats]", ...args);
  }
  function onStatsUpdated(callback) {
    const handler = () => callback();
    window.addEventListener(STATS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(STATS_UPDATED_EVENT, handler);
  }
  function emitStatsUpdated() {
    window.dispatchEvent(new CustomEvent(STATS_UPDATED_EVENT));
    localStorage.setItem("listening-stats:lastUpdate", Date.now().toString());
  }
  function defaultPollingData() {
    return {
      hourlyDistribution: new Array(24).fill(0),
      activityDates: [],
      knownArtistUris: [],
      skipEvents: 0,
      totalPlays: 0,
      lastPollTimestamp: 0,
      trackPlayCounts: {},
      artistPlayCounts: {},
      seeded: false
    };
  }
  function getPollingData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY2);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed.hourlyDistribution) || parsed.hourlyDistribution.length !== 24) {
          parsed.hourlyDistribution = new Array(24).fill(0);
        }
        if (!parsed.trackPlayCounts) parsed.trackPlayCounts = {};
        if (!parsed.artistPlayCounts) parsed.artistPlayCounts = {};
        if (parsed.seeded === void 0) parsed.seeded = false;
        return parsed;
      }
    } catch (error) {
      console.warn("[ListeningStats] Failed to load polling data:", error);
    }
    return defaultPollingData();
  }
  function savePollingData(data) {
    try {
      if (data.activityDates.length > 400) {
        data.activityDates = data.activityDates.slice(-365);
      }
      if (data.knownArtistUris.length > 5e3) {
        data.knownArtistUris = data.knownArtistUris.slice(-5e3);
      }
      const trackEntries = Object.entries(data.trackPlayCounts);
      if (trackEntries.length > 2e3) {
        const sorted = trackEntries.sort((a, b) => b[1] - a[1]).slice(0, 2e3);
        data.trackPlayCounts = Object.fromEntries(sorted);
      }
      const artistEntries = Object.entries(data.artistPlayCounts);
      if (artistEntries.length > 1e3) {
        const sorted = artistEntries.sort((a, b) => b[1] - a[1]).slice(0, 1e3);
        data.artistPlayCounts = Object.fromEntries(sorted);
      }
      localStorage.setItem(STORAGE_KEY2, JSON.stringify(data));
    } catch (error) {
      console.warn("[ListeningStats] Failed to save polling data:", error);
    }
  }
  function clearPollingData() {
    localStorage.removeItem(STORAGE_KEY2);
  }
  var currentTrackUri = null;
  var playStartTime = null;
  var accumulatedPlayTime = 0;
  var isPlaying = false;
  var currentTrackDuration = 0;
  var lastProgressMs = 0;
  var progressHandler = null;
  async function handleSongChange() {
    if (currentTrackUri && playStartTime !== null) {
      const totalPlayedMs = accumulatedPlayTime + (isPlaying ? Date.now() - playStartTime : 0);
      const threshold = getPlayThreshold();
      const skipped = totalPlayedMs < threshold && currentTrackDuration > threshold;
      if (previousTrackData) {
        log(
          skipped ? "Skipped:" : "Tracked:",
          `${previousTrackData.artistName} - ${previousTrackData.trackName}`,
          `(${Math.round(totalPlayedMs / 1e3)}s / ${Math.round(currentTrackDuration / 1e3)}s)`
        );
      }
      await writePlayEvent(totalPlayedMs, skipped);
    }
    const playerData = Spicetify.Player.data;
    if (playerData?.item) {
      currentTrackUri = playerData.item.uri;
      currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
      playStartTime = Date.now();
      accumulatedPlayTime = 0;
      isPlaying = !playerData.isPaused;
      const meta = playerData.item.metadata;
      const name = playerData.item.name || meta?.title || "Unknown";
      const artist = meta?.artist_name || "Unknown";
      log("Now playing:", `${artist} - ${name}`);
    } else {
      currentTrackUri = null;
      playStartTime = null;
      accumulatedPlayTime = 0;
      isPlaying = false;
      currentTrackDuration = 0;
    }
  }
  var previousTrackData = null;
  function captureCurrentTrackData() {
    const playerData = Spicetify.Player.data;
    if (!playerData?.item) {
      previousTrackData = null;
      return;
    }
    const meta = playerData.item.metadata;
    previousTrackData = {
      trackUri: playerData.item.uri,
      trackName: playerData.item.name || meta?.title || "Unknown Track",
      artistName: meta?.artist_name || "Unknown Artist",
      artistUri: meta?.artist_uri || "",
      albumName: meta?.album_title || "Unknown Album",
      albumUri: meta?.album_uri || "",
      albumArt: meta?.image_url || meta?.image_xlarge_url,
      durationMs: playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0,
      startedAt: Date.now()
    };
  }
  async function writePlayEvent(totalPlayedMs, skipped) {
    if (!previousTrackData) return;
    if (skipped === void 0) {
      const threshold = getPlayThreshold();
      skipped = totalPlayedMs < threshold && previousTrackData.durationMs > threshold;
    }
    const event = {
      trackUri: previousTrackData.trackUri,
      trackName: previousTrackData.trackName,
      artistName: previousTrackData.artistName,
      artistUri: previousTrackData.artistUri,
      albumName: previousTrackData.albumName,
      albumUri: previousTrackData.albumUri,
      albumArt: previousTrackData.albumArt,
      durationMs: previousTrackData.durationMs,
      playedMs: totalPlayedMs,
      startedAt: previousTrackData.startedAt,
      endedAt: Date.now(),
      type: skipped ? "skip" : "play"
    };
    try {
      const written = await addPlayEvent(event);
      if (written) {
        const data = getPollingData();
        data.totalPlays++;
        if (skipped) {
          data.skipEvents++;
        }
        savePollingData(data);
        if (activeProviderType === "local") {
          emitStatsUpdated();
        }
      } else {
        log("Dedup guard blocked duplicate event, polling data unchanged");
      }
    } catch (err) {
      console.warn("[ListeningStats] Failed to write play event:", err);
    }
  }
  function handlePlayPause() {
    const wasPlaying = isPlaying;
    isPlaying = !Spicetify.Player.data?.isPaused;
    if (!currentTrackUri || playStartTime === null) return;
    if (wasPlaying && !isPlaying) {
      accumulatedPlayTime += Date.now() - playStartTime;
      log("Paused");
    } else if (!wasPlaying && isPlaying) {
      playStartTime = Date.now();
      log("Resumed");
    }
  }
  function handleProgress() {
    const progress = Spicetify.Player.getProgress();
    const duration = Spicetify.Player.getDuration();
    const repeat = Spicetify.Player.getRepeat();
    if (repeat === 2 && duration > 0) {
      const wasNearEnd = lastProgressMs > duration * 0.9;
      const nowNearStart = progress < duration * 0.1;
      if (wasNearEnd && nowNearStart && currentTrackUri) {
        log("Repeat-one loop detected, recording play");
        handleSongChange();
        captureCurrentTrackData();
      }
    }
    lastProgressMs = progress;
  }
  var pollIntervalId = null;
  var activeSongChangeHandler = null;
  function initPoller(providerType) {
    const win = window;
    if (win.__lsSongHandler) {
      Spicetify.Player.removeEventListener("songchange", win.__lsSongHandler);
    }
    if (win.__lsPauseHandler) {
      Spicetify.Player.removeEventListener("onplaypause", win.__lsPauseHandler);
    }
    if (win.__lsProgressHandler) {
      Spicetify.Player.removeEventListener("onprogress", win.__lsProgressHandler);
    }
    activeProviderType = providerType;
    captureCurrentTrackData();
    activeSongChangeHandler = () => {
      lastProgressMs = 0;
      handleSongChange();
      captureCurrentTrackData();
    };
    Spicetify.Player.addEventListener("songchange", activeSongChangeHandler);
    Spicetify.Player.addEventListener("onplaypause", handlePlayPause);
    progressHandler = handleProgress;
    Spicetify.Player.addEventListener("onprogress", progressHandler);
    win.__lsSongHandler = activeSongChangeHandler;
    win.__lsPauseHandler = handlePlayPause;
    win.__lsProgressHandler = progressHandler;
    const playerData = Spicetify.Player.data;
    if (playerData?.item) {
      currentTrackUri = playerData.item.uri;
      currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
      playStartTime = Date.now();
      isPlaying = !playerData.isPaused;
    }
  }
  function destroyPoller() {
    if (activeSongChangeHandler) {
      Spicetify.Player.removeEventListener("songchange", activeSongChangeHandler);
      activeSongChangeHandler = null;
    }
    Spicetify.Player.removeEventListener("onplaypause", handlePlayPause);
    if (progressHandler) {
      Spicetify.Player.removeEventListener("onprogress", progressHandler);
      progressHandler = null;
    }
    const win = window;
    win.__lsSongHandler = null;
    win.__lsPauseHandler = null;
    win.__lsProgressHandler = null;
    lastProgressMs = 0;
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    activeProviderType = null;
    previousTrackData = null;
  }

  // src/services/providers/lastfm.ts
  var PERIODS = [
    "recent",
    "7day",
    "1month",
    "3month",
    "6month",
    "12month",
    "overall"
  ];
  var PERIOD_LABELS = {
    recent: "Recent",
    "7day": "7 Days",
    "1month": "1 Month",
    "3month": "3 Months",
    "6month": "6 Months",
    "12month": "12 Months",
    overall: "Overall"
  };
  function createLastfmProvider() {
    return {
      type: "lastfm",
      periods: [...PERIODS],
      periodLabels: PERIOD_LABELS,
      defaultPeriod: "recent",
      init() {
        initPoller("lastfm");
      },
      destroy() {
        destroyPoller();
      },
      async calculateStats(period) {
        if (period === "recent") {
          return calculateRecentStats();
        }
        return calculateRankedStats(period);
      }
    };
  }
  async function calculateRecentStats() {
    const [recentLfm, userInfo] = await Promise.all([
      getRecentTracks(50),
      getUserInfo().catch(() => null)
    ]);
    const pollingData = getPollingData();
    const recentTracks = recentLfm.filter((t) => !t.nowPlaying).map((t) => ({
      trackUri: "",
      trackName: t.name,
      artistName: t.artist,
      artistUri: "",
      albumName: t.album,
      albumUri: "",
      albumArt: t.albumArt,
      durationMs: 0,
      playedAt: t.playedAt
    }));
    const trackMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      const key = `${t.artistName}|||${t.trackName}`;
      const existing = trackMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        trackMap.set(key, {
          trackName: t.trackName,
          artistName: t.artistName,
          albumArt: t.albumArt,
          count: 1
        });
      }
    }
    const topTracks = Array.from(trackMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((t, i) => ({
      trackUri: "",
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      rank: i + 1,
      totalTimeMs: 0,
      playCount: t.count
    }));
    const artistMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      const existing = artistMap.get(t.artistName);
      if (existing) {
        existing.count++;
      } else {
        artistMap.set(t.artistName, { artistName: t.artistName, count: 1 });
      }
    }
    const topArtists = Array.from(artistMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((a, i) => ({
      artistUri: "",
      artistName: a.artistName,
      artistImage: void 0,
      rank: i + 1,
      genres: [],
      playCount: a.count
    }));
    const albumMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      if (!t.albumName) continue;
      const key = `${t.artistName}|||${t.albumName}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        albumMap.set(key, {
          albumName: t.albumName,
          artistName: t.artistName,
          albumArt: t.albumArt,
          count: 1
        });
      }
    }
    const topAlbums = Array.from(albumMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((a) => ({
      albumUri: "",
      albumName: a.albumName,
      artistName: a.artistName,
      albumArt: a.albumArt,
      trackCount: a.count,
      playCount: a.count
    }));
    const hourlyDistribution = new Array(24).fill(0);
    for (const t of recentTracks) {
      const hour = new Date(t.playedAt).getHours();
      hourlyDistribution[hour]++;
    }
    const uniqueTrackNames = new Set(
      recentTracks.map((t) => `${t.artistName}|||${t.trackName}`)
    );
    const uniqueArtistNames = new Set(recentTracks.map((t) => t.artistName));
    let estimatedTimeMs = 0;
    const sorted = [...recentTracks].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );
    const SESSION_GAP_MS = 6 * 60 * 1e3;
    const AVG_TRACK_MS = 21e4;
    for (let i = 0; i < sorted.length; i++) {
      if (i < sorted.length - 1) {
        const gap = new Date(sorted[i + 1].playedAt).getTime() - new Date(sorted[i].playedAt).getTime();
        estimatedTimeMs += gap > 0 && gap <= SESSION_GAP_MS ? gap : AVG_TRACK_MS;
      } else {
        estimatedTimeMs += AVG_TRACK_MS;
      }
    }
    const activityDates = [
      ...new Set(
        recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0])
      )
    ];
    return {
      totalTimeMs: estimatedTimeMs,
      trackCount: recentTracks.length,
      uniqueTrackCount: uniqueTrackNames.size,
      uniqueArtistCount: uniqueArtistNames.size,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      hourlyUnit: "plays",
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      recentTracks,
      genres: {},
      topGenres: [],
      streakDays: calculateStreak(activityDates),
      newArtistsCount: 0,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: activityDates.length,
      lastfmConnected: true,
      totalScrobbles: userInfo?.totalScrobbles
    };
  }
  async function calculateRankedStats(period) {
    const [
      lfmTracksResult,
      lfmArtistsResult,
      lfmAlbumsResult,
      recentLfm,
      userInfo
    ] = await Promise.all([
      getTopTracks(period, 50),
      getTopArtists(period, 50),
      getTopAlbums(period, 50),
      getRecentTracks(50).catch(() => []),
      getUserInfo().catch(() => null)
    ]);
    const lfmTracks = lfmTracksResult.tracks;
    const lfmArtists = lfmArtistsResult.artists;
    const lfmAlbums = lfmAlbumsResult.albums;
    const pollingData = getPollingData();
    const topTracks = lfmTracks.slice(0, 10).map((t, i) => ({
      trackUri: "",
      trackName: t.name,
      artistName: t.artist,
      albumArt: t.imageUrl,
      rank: i + 1,
      totalTimeMs: (t.durationSecs || 0) * 1e3,
      playCount: t.playCount
    }));
    const topArtists = lfmArtists.slice(0, 10).map((a, i) => ({
      artistUri: "",
      artistName: a.name,
      artistImage: a.imageUrl,
      rank: i + 1,
      genres: [],
      playCount: a.playCount
    }));
    const topAlbums = lfmAlbums.slice(0, 10).map((a) => ({
      albumUri: "",
      albumName: a.name,
      artistName: a.artist,
      albumArt: a.imageUrl,
      trackCount: 0,
      playCount: a.playCount
    }));
    const recentTracks = (Array.isArray(recentLfm) ? recentLfm : []).filter((t) => !t.nowPlaying).map((t) => ({
      trackUri: "",
      trackName: t.name,
      artistName: t.artist,
      artistUri: "",
      albumName: t.album,
      albumUri: "",
      albumArt: t.albumArt,
      durationMs: 0,
      playedAt: t.playedAt
    }));
    const hourlyDistribution = new Array(24).fill(0);
    for (const t of recentTracks) {
      const hour = new Date(t.playedAt).getHours();
      hourlyDistribution[hour]++;
    }
    const totalPlays = lfmTracks.reduce((sum, t) => sum + t.playCount, 0);
    const totalTimeMs = lfmTracks.reduce(
      (sum, t) => sum + (t.durationSecs || 210) * 1e3 * t.playCount,
      0
    );
    const activityDates = [
      ...new Set(
        recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0])
      )
    ];
    return {
      totalTimeMs,
      trackCount: totalPlays,
      uniqueTrackCount: lfmTracksResult.total,
      uniqueArtistCount: lfmArtistsResult.total,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      hourlyUnit: "plays",
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      recentTracks,
      genres: {},
      topGenres: [],
      streakDays: calculateStreak(activityDates),
      newArtistsCount: 0,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: activityDates.length,
      lastfmConnected: true,
      totalScrobbles: userInfo?.totalScrobbles
    };
  }
  function calculateStreak(activityDates) {
    const dateSet = new Set(activityDates);
    const today = /* @__PURE__ */ new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (dateSet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  // src/services/providers/local.ts
  init_storage();
  var PERIODS2 = ["today", "this_week", "this_month", "all_time"];
  var PERIOD_LABELS2 = {
    today: "Today",
    this_week: "This Week",
    this_month: "This Month",
    all_time: "All Time"
  };
  function createLocalProvider() {
    return {
      type: "local",
      periods: [...PERIODS2],
      periodLabels: PERIOD_LABELS2,
      defaultPeriod: "today",
      init() {
        resetDBPromise();
        initPoller("local");
      },
      destroy() {
        destroyPoller();
        resetDBPromise();
      },
      async calculateStats(period) {
        const events = await getEventsForPeriod(period);
        const allEvents = period === "all_time" ? events : await getAllPlayEvents();
        return aggregateEvents(events, allEvents);
      },
      clearData() {
        clearAllData();
      }
    };
  }
  function getTimeRange(period) {
    const now = /* @__PURE__ */ new Date();
    const end = now;
    let start;
    switch (period) {
      case "today": {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "this_week": {
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      }
      case "this_month": {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      default:
        start = /* @__PURE__ */ new Date(0);
        break;
    }
    return { start, end };
  }
  async function getEventsForPeriod(period) {
    if (period === "all_time") {
      return getAllPlayEvents();
    }
    const { start, end } = getTimeRange(period);
    return getPlayEventsByTimeRange(start, end);
  }
  async function aggregateEvents(events, allEvents) {
    const completedEvents = events.filter((e) => e.type !== "skip");
    const trackMap = /* @__PURE__ */ new Map();
    for (const e of completedEvents) {
      const existing = trackMap.get(e.trackUri);
      if (existing) {
        existing.count++;
        existing.totalMs += e.playedMs;
      } else {
        trackMap.set(e.trackUri, {
          trackUri: e.trackUri,
          trackName: e.trackName,
          artistName: e.artistName,
          albumArt: e.albumArt,
          count: 1,
          totalMs: e.playedMs
        });
      }
    }
    const topTracks = Array.from(trackMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((t, i) => ({
      trackUri: t.trackUri,
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      rank: i + 1,
      totalTimeMs: t.totalMs,
      playCount: t.count
    }));
    const artistMap = /* @__PURE__ */ new Map();
    for (const e of completedEvents) {
      const key = e.artistUri || e.artistName;
      const existing = artistMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        artistMap.set(key, {
          artistUri: e.artistUri,
          artistName: e.artistName,
          count: 1
        });
      }
    }
    const topArtistAggregated = Array.from(artistMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    const topArtists = topArtistAggregated.map((a, i) => ({
      artistUri: a.artistUri,
      artistName: a.artistName,
      rank: i + 1,
      genres: [],
      playCount: a.count
    }));
    const albumMap = /* @__PURE__ */ new Map();
    for (const e of completedEvents) {
      const existing = albumMap.get(e.albumUri);
      if (existing) {
        existing.trackCount++;
      } else {
        albumMap.set(e.albumUri, {
          albumUri: e.albumUri,
          albumName: e.albumName || "Unknown Album",
          artistName: e.artistName,
          albumArt: e.albumArt,
          trackCount: 1
        });
      }
    }
    const topAlbums = Array.from(albumMap.values()).sort((a, b) => b.trackCount - a.trackCount).slice(0, 10).map((a) => ({
      ...a,
      playCount: a.trackCount
    }));
    const hourlyDistribution = new Array(24).fill(0);
    for (const e of events) {
      const hour = new Date(e.startedAt).getHours();
      hourlyDistribution[hour] += e.playedMs;
    }
    const genreMap = /* @__PURE__ */ new Map();
    for (const a of topArtists) {
      for (const genre of a.genres) {
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      }
    }
    const genres = {};
    for (const [g, c] of genreMap) genres[g] = c;
    const topGenres = Array.from(genreMap.entries()).map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const recent = events.sort((a, b) => b.startedAt - a.startedAt).slice(0, 50);
    const recentTracks = recent.map((e) => ({
      trackUri: e.trackUri,
      trackName: e.trackName,
      artistName: e.artistName,
      artistUri: e.artistUri,
      albumName: e.albumName || "Unknown Album",
      albumUri: e.albumUri,
      albumArt: e.albumArt,
      durationMs: e.durationMs,
      playedAt: new Date(e.startedAt).toISOString()
    }));
    const uniqueTrackUris = new Set(completedEvents.map((e) => e.trackUri));
    const uniqueArtistUris = new Set(
      completedEvents.map((e) => e.artistUri).filter(Boolean)
    );
    const periodDates = new Set(
      events.map((e) => new Date(e.startedAt).toISOString().split("T")[0])
    );
    const allDates = Array.from(new Set(
      allEvents.map((e) => new Date(e.startedAt).toISOString().split("T")[0])
    ));
    const totalTimeMs = events.reduce((sum, e) => sum + e.playedMs, 0);
    const skipEvents = events.length - completedEvents.length;
    return {
      totalTimeMs,
      trackCount: events.length,
      uniqueTrackCount: uniqueTrackUris.size,
      uniqueArtistCount: uniqueArtistUris.size,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      recentTracks,
      genres,
      topGenres,
      streakDays: calculateStreak2(allDates),
      newArtistsCount: 0,
      skipRate: events.length > 0 ? skipEvents / events.length : 0,
      listenedDays: periodDates.size,
      lastfmConnected: false
    };
  }
  function calculateStreak2(activityDates) {
    const dateSet = new Set(activityDates);
    const today = /* @__PURE__ */ new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (dateSet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  // src/services/statsfm.ts
  var API_BASE = "https://api.stats.fm/api/v1";
  var STORAGE_KEY3 = "listening-stats:statsfm";
  var CACHE_TTL_MS2 = 12e4;
  var configCache2 = void 0;
  function getConfig2() {
    if (configCache2 !== void 0) return configCache2;
    try {
      const stored = localStorage.getItem(STORAGE_KEY3);
      if (stored) {
        configCache2 = JSON.parse(stored);
        return configCache2;
      }
    } catch {
    }
    configCache2 = null;
    return null;
  }
  function saveConfig2(config) {
    configCache2 = config;
    localStorage.setItem(STORAGE_KEY3, JSON.stringify(config));
  }
  function clearConfig2() {
    configCache2 = null;
    localStorage.removeItem(STORAGE_KEY3);
  }
  function isConnected2() {
    const config = getConfig2();
    return !!config?.username;
  }
  var cache2 = /* @__PURE__ */ new Map();
  function getCached2(key) {
    const entry = cache2.get(key);
    if (!entry || Date.now() >= entry.expiresAt) {
      cache2.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache2(key, data) {
    cache2.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS2 });
  }
  function clearStatsfmCache() {
    cache2.clear();
  }
  async function statsfmFetch(path) {
    const url = `${API_BASE}${path}`;
    const cached2 = getCached2(url);
    if (cached2) return cached2;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) throw new Error("User not found");
      if (response.status === 403) throw new Error("Profile is private");
      if (response.status === 429)
        throw new Error("Rate limited. Try again later");
      throw new Error(`stats.fm API error: ${response.status}`);
    }
    const data = await response.json();
    setCache2(url, data);
    return data;
  }
  async function validateUser2(username) {
    const data = await statsfmFetch(
      `/users/${encodeURIComponent(username)}`
    );
    const item = data.item || data;
    if (!item || !item.customId) {
      throw new Error("User not found");
    }
    return {
      id: item.id,
      customId: item.customId,
      displayName: item.displayName || item.customId,
      image: item.image || void 0,
      isPlus: !!item.isPlus
    };
  }
  function getUsername() {
    const config = getConfig2();
    if (!config?.username) throw new Error("stats.fm not configured");
    return encodeURIComponent(config.username);
  }
  async function getTopTracks2(range, limit = 50) {
    const data = await statsfmFetch(
      `/users/${getUsername()}/top/tracks?range=${range}&limit=${limit}&orderBy=COUNT`
    );
    return data.items || [];
  }
  async function getTopArtists2(range, limit = 50) {
    const data = await statsfmFetch(
      `/users/${getUsername()}/top/artists?range=${range}&limit=${limit}&orderBy=COUNT`
    );
    return data.items || [];
  }
  async function getTopAlbums2(range, limit = 50) {
    try {
      const data = await statsfmFetch(
        `/users/${getUsername()}/top/albums?range=${range}&limit=${limit}&orderBy=COUNT`
      );
      return data.items || [];
    } catch {
      return [];
    }
  }
  async function getTopGenres(range, limit = 20) {
    const data = await statsfmFetch(
      `/users/${getUsername()}/top/genres?range=${range}&limit=${limit}`
    );
    return data.items || [];
  }
  async function getRecentStreams(limit = 50) {
    const data = await statsfmFetch(
      `/users/${getUsername()}/streams/recent?limit=${limit}`
    );
    return data.items || [];
  }
  async function getStreamStats(range) {
    const data = await statsfmFetch(
      `/users/${getUsername()}/streams/stats?range=${range}`
    );
    const item = data.items || data;
    return {
      durationMs: item.durationMs || 0,
      count: item.count || 0,
      cardinality: item.cardinality || { tracks: 0, artists: 0, albums: 0 }
    };
  }
  async function getDateStats(range, timeZoneOffset) {
    const tz = timeZoneOffset ?? -(/* @__PURE__ */ new Date()).getTimezoneOffset();
    const data = await statsfmFetch(
      `/users/${getUsername()}/streams/stats/dates?range=${range}&timeZoneOffset=${tz}`
    );
    const item = data.items || data;
    return { hours: item.hours || {} };
  }
  async function refreshPlusStatus() {
    const config = getConfig2();
    if (!config?.username) return false;
    try {
      const info = await validateUser2(config.username);
      if (info.isPlus !== (config.isPlus ?? false)) {
        saveConfig2({ ...config, isPlus: info.isPlus });
        return true;
      }
    } catch {
    }
    return false;
  }
  function extractSpotifyUri(externalIds, type) {
    const ids = externalIds?.spotify;
    if (!ids || ids.length === 0) return "";
    const id = ids[0];
    if (id.startsWith("spotify:")) return id;
    return `spotify:${type}:${id}`;
  }

  // src/services/providers/statsfm.ts
  var FREE_PERIODS = ["weeks", "months", "lifetime"];
  var FREE_LABELS = {
    weeks: "4 Weeks",
    months: "6 Months",
    lifetime: "Lifetime"
  };
  var PLUS_PERIODS = ["today", "weeks", "months", "lifetime"];
  var PLUS_LABELS = {
    today: "Today",
    weeks: "4 Weeks",
    months: "6 Months",
    lifetime: "Lifetime"
  };
  function createStatsfmProvider() {
    const config = getConfig2();
    const isPlus = config?.isPlus ?? false;
    const periods = isPlus ? [...PLUS_PERIODS] : [...FREE_PERIODS];
    const periodLabels = isPlus ? { ...PLUS_LABELS } : { ...FREE_LABELS };
    return {
      type: "statsfm",
      periods,
      periodLabels,
      defaultPeriod: "weeks",
      init() {
        initPoller("statsfm");
        refreshPlusStatus().catch(() => {
        });
      },
      destroy() {
        destroyPoller();
      },
      async calculateStats(period) {
        return calculateStatsfmStats(period);
      }
    };
  }
  async function calculateStatsfmStats(range) {
    const [
      topTracksRaw,
      topArtistsRaw,
      topAlbumsRaw,
      topGenresRaw,
      recentRaw,
      streamStats,
      dateStats
    ] = await Promise.all([
      getTopTracks2(range, 50),
      getTopArtists2(range, 50),
      getTopAlbums2(range, 50),
      getTopGenres(range, 20),
      getRecentStreams(50).catch(() => []),
      getStreamStats(range).catch(() => ({
        durationMs: 0,
        count: 0,
        cardinality: { tracks: 0, artists: 0, albums: 0 }
      })),
      getDateStats(range).catch(() => ({ hours: {} }))
    ]);
    const pollingData = getPollingData();
    const topTracks = topTracksRaw.slice(0, 10).map((item, i) => ({
      trackUri: extractSpotifyUri(item.track.externalIds, "track"),
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      albumArt: item.track.albums?.[0]?.image || void 0,
      rank: i + 1,
      totalTimeMs: item.playedMs || (item.streams ? item.track.durationMs * item.streams : item.track.durationMs),
      playCount: item.streams ?? void 0
    }));
    const topArtists = topArtistsRaw.slice(0, 10).map((item, i) => ({
      artistUri: extractSpotifyUri(item.artist.externalIds, "artist"),
      artistName: item.artist.name,
      artistImage: item.artist.image || void 0,
      rank: i + 1,
      genres: item.artist.genres || [],
      playCount: item.streams ?? void 0
    }));
    let topAlbums = topAlbumsRaw.slice(0, 10).map((item) => ({
      albumUri: extractSpotifyUri(item.album.externalIds, "album"),
      albumName: item.album.name,
      artistName: item.album.artists?.[0]?.name || "Unknown Artist",
      albumArt: item.album.image || void 0,
      trackCount: 0,
      playCount: item.streams ?? void 0
    }));
    if (topAlbums.length === 0 && recentRaw.length > 0) {
      const albumMap = /* @__PURE__ */ new Map();
      for (const item of recentRaw) {
        const album = item.track.albums?.[0];
        if (!album?.name) continue;
        const key = `${item.track.artists?.[0]?.name}|||${album.name}`;
        const existing = albumMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          albumMap.set(key, {
            albumName: album.name,
            artistName: item.track.artists?.[0]?.name || "Unknown Artist",
            albumArt: album.image || void 0,
            count: 1
          });
        }
      }
      topAlbums = Array.from(albumMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((a) => ({
        albumUri: "",
        albumName: a.albumName,
        artistName: a.artistName,
        albumArt: a.albumArt,
        trackCount: a.count,
        playCount: a.count
      }));
    }
    const recentTracks = recentRaw.map((item) => ({
      trackUri: extractSpotifyUri(item.track.externalIds, "track"),
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      artistUri: item.track.artists?.[0]?.externalIds?.spotify?.[0] ? extractSpotifyUri(item.track.artists[0].externalIds, "artist") : "",
      albumName: item.track.albums?.[0]?.name || "",
      albumUri: "",
      albumArt: item.track.albums?.[0]?.image || void 0,
      durationMs: item.durationMs || item.track.durationMs,
      playedAt: new Date(item.endTime).toISOString()
    }));
    const genres = {};
    for (const g of topGenresRaw) {
      genres[g.genre.tag] = g.streams ?? g.position;
    }
    const topGenres = topGenresRaw.slice(0, 10).map((g) => ({ genre: g.genre.tag, count: g.streams ?? g.position }));
    let hourlyDistribution = new Array(24).fill(0);
    const hasDateStats = Object.keys(dateStats.hours).length > 0;
    if (hasDateStats) {
      for (const [hour, stat] of Object.entries(dateStats.hours)) {
        const h = parseInt(hour, 10);
        if (h >= 0 && h < 24) {
          hourlyDistribution[h] = stat.count;
        }
      }
    } else {
      for (const t of recentTracks) {
        const hour = new Date(t.playedAt).getHours();
        hourlyDistribution[hour]++;
      }
    }
    const uniqueTrackCount = streamStats.cardinality?.tracks || new Set(
      topTracksRaw.map(
        (t) => `${t.track.artists?.[0]?.name}|||${t.track.name}`
      )
    ).size;
    const uniqueArtistCount = streamStats.cardinality?.artists || new Set(topArtistsRaw.map((a) => a.artist.name)).size;
    const totalPlays = topTracksRaw.reduce((sum, t) => sum + (t.streams || 0), 0);
    const totalTimeMs = topTracksRaw.reduce(
      (sum, t) => sum + (t.playedMs || (t.streams ? t.track.durationMs * t.streams : 0)),
      0
    );
    const activityDates = [
      ...new Set(
        recentTracks.map((t) => new Date(t.playedAt).toISOString().split("T")[0])
      )
    ];
    return {
      totalTimeMs: streamStats.durationMs || totalTimeMs,
      trackCount: streamStats.count || totalPlays,
      uniqueTrackCount,
      uniqueArtistCount,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      hourlyUnit: "plays",
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      recentTracks,
      genres,
      topGenres,
      streakDays: calculateStreak3(activityDates),
      newArtistsCount: 0,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: activityDates.length,
      lastfmConnected: false
    };
  }
  function calculateStreak3(activityDates) {
    const dateSet = new Set(activityDates);
    const today = /* @__PURE__ */ new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (dateSet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  // src/services/providers/index.ts
  var STORAGE_KEY4 = "listening-stats:provider";
  var activeProvider = null;
  function getSelectedProviderType() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY4);
      if (stored === "local" || stored === "lastfm" || stored === "statsfm") {
        return stored;
      }
    } catch {
    }
    return null;
  }
  function setSelectedProviderType(type) {
    localStorage.setItem(STORAGE_KEY4, type);
  }
  function clearProviderSelection() {
    if (activeProvider) {
      activeProvider.destroy();
      activeProvider = null;
    }
    localStorage.removeItem(STORAGE_KEY4);
  }
  function getActiveProvider() {
    return activeProvider;
  }
  function activateProvider(type, skipInit = false) {
    if (activeProvider) {
      if (!skipInit) activeProvider.destroy();
      activeProvider = null;
    }
    setSelectedProviderType(type);
    switch (type) {
      case "lastfm":
        activeProvider = createLastfmProvider();
        break;
      case "local":
        activeProvider = createLocalProvider();
        break;
      case "statsfm":
        activeProvider = createStatsfmProvider();
        break;
    }
    if (!skipInit) {
      activeProvider.init();
    }
  }

  // src/services/stats.ts
  var statsCache = /* @__PURE__ */ new Map();
  var STATS_CACHE_TTL = 12e4;
  function clearStatsCache() {
    statsCache.clear();
  }
  async function calculateStats(period) {
    const provider = getActiveProvider();
    if (!provider) {
      throw new Error("No tracking provider active");
    }
    const cacheKey = `${provider.type}:${period}`;
    const cached2 = statsCache.get(cacheKey);
    if (cached2 && Date.now() < cached2.expiresAt) {
      return cached2.data;
    }
    const data = await provider.calculateStats(period);
    statsCache.set(cacheKey, { data, expiresAt: Date.now() + STATS_CACHE_TTL });
    return data;
  }
  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
  function formatDurationLong(ms) {
    const totalSeconds = Math.floor(ms / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes} min`;
    }
  }
  function getPeriodDisplayName(period) {
    const provider = getActiveProvider();
    if (provider) {
      return provider.periodLabels[period] || period;
    }
    return period;
  }

  // src/services/updater.ts
  var GITHUB_REPO = "Xndr2/listening-stats";
  var STORAGE_KEY5 = "listening-stats:lastUpdateCheck";
  var INSTALL_CMD_LINUX = `curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash`;
  var INSTALL_CMD_WINDOWS = `irm https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1 | iex`;
  function getCurrentVersion() {
    try {
      return "1.3.32";
    } catch {
      return "0.0.0";
    }
  }
  async function checkForUpdates() {
    const currentVersion = getCurrentVersion();
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: { Accept: "application/vnd.github.v3+json" }
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch release info");
      }
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const distAsset = release.assets.find(
        (a) => a.name === "listening-stats.zip" || a.name === "dist.zip" || a.name.endsWith(".zip")
      );
      const available = isNewerVersion(latestVersion, currentVersion);
      localStorage.setItem(
        STORAGE_KEY5,
        JSON.stringify({
          checkedAt: Date.now(),
          latestVersion,
          available
        })
      );
      return {
        available,
        currentVersion,
        latestVersion,
        changelog: release.body || "No changelog provided.",
        downloadUrl: distAsset?.browser_download_url || null,
        releaseUrl: release.html_url
      };
    } catch (error) {
      console.error("[ListeningStats] Update check failed:", error);
      return {
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        changelog: "",
        downloadUrl: null,
        releaseUrl: null
      };
    }
  }
  function isNewerVersion(latest, current) {
    const latestParts = latest.split(".").map(Number);
    const currentParts = current.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  }
  function getInstallCommand() {
    const isWindows = navigator.platform.toLowerCase().includes("win");
    return isWindows ? INSTALL_CMD_WINDOWS : INSTALL_CMD_LINUX;
  }
  async function copyInstallCommand() {
    const cmd = getInstallCommand();
    try {
      await navigator.clipboard.writeText(cmd);
      return true;
    } catch (e) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = cmd;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
      } catch {
        return false;
      }
    }
  }

  // src/app/format.ts
  var numberFormatter = new Intl.NumberFormat();
  function formatNumber(n) {
    return numberFormatter.format(n);
  }
  function formatHour(h) {
    const { use24HourTime } = getPreferences();
    if (use24HourTime) {
      return h.toString().padStart(2, "0") + ":00";
    }
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }
  function renderMarkdown(text) {
    if (!text) return "";
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const codeBlocks = [];
    html = html.replace(/`([^`]+)`/g, (_match, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<code>${code}</code>`);
      return `\0CODE${idx}\0`;
    });
    const lines = html.split("\n");
    const processed = [];
    let inList = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.match(/^###\s+(.+)$/)) {
        if (inList) {
          processed.push("</ul>");
          inList = false;
        }
        processed.push(`<h5>${line.replace(/^###\s+/, "")}</h5>`);
        continue;
      }
      if (line.match(/^##\s+(.+)$/)) {
        if (inList) {
          processed.push("</ul>");
          inList = false;
        }
        processed.push(`<h4>${line.replace(/^##\s+/, "")}</h4>`);
        continue;
      }
      if (line.match(/^[\-\*]\s+(.+)$/)) {
        if (!inList) {
          processed.push("<ul>");
          inList = true;
        }
        processed.push(`<li>${line.replace(/^[\-\*]\s+/, "")}</li>`);
        continue;
      }
      if (inList) {
        processed.push("</ul>");
        inList = false;
      }
      if (line.trim() === "") {
        processed.push("<br>");
        continue;
      }
      processed.push(line);
    }
    if (inList) {
      processed.push("</ul>");
    }
    html = processed.join("\n");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => codeBlocks[parseInt(idx)]);
    html = html.replace(/(?<!\>)\n(?!\<)/g, "<br>");
    return html;
  }

  // src/app/icons.ts
  var Icons = {
    heart: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1.69 2A4.582 4.582 0 018 2.023 4.583 4.583 0 0114.31 2a4.583 4.583 0 010 6.496L8 14.153l-6.31-5.657A4.583 4.583 0 011.69 2m6.31 10.06l5.715-5.12a3.087 3.087 0 00-4.366-4.371L8 3.839l-1.35-1.27a3.087 3.087 0 00-4.366 4.37z"/></svg>',
    heartFilled: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M15.724 4.22A4.313 4.313 0 0012.192.814a4.269 4.269 0 00-3.622 1.13.837.837 0 01-1.14 0 4.272 4.272 0 00-6.21 5.855l5.916 7.05a1.128 1.128 0 001.727 0l5.916-7.05a4.228 4.228 0 00.945-3.577z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    album: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16,6 12,2 8,6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    genre: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
    radio: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12a2 2 0 002 2h16a2 2 0 002-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/></svg>'
  };

  // src/app/components/UpdateBanner.tsx
  function UpdateBanner({
    updateInfo,
    commandCopied,
    onDismiss,
    onCopyCommand
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-container" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-icon" }, "\u{1F389}"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-title" }, "Update Available!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-version" }, "v", updateInfo.currentVersion, " \u2192 v", updateInfo.latestVersion)), updateInfo.changelog && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-changelog", dangerouslySetInnerHTML: { __html: renderMarkdown(updateInfo.changelog) } }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-links" }, /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "stats.fm Setup Guide",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Last.fm Setup Guide",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "update-banner-btn secondary", onClick: onDismiss }, "I'll do this later"), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `update-banner-btn primary ${commandCopied ? "copied" : ""}`,
        onClick: onCopyCommand
      },
      commandCopied ? "\u2713 Copied!" : "\u{1F4CB} Copy Command"
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "updating-text" }, "Paste the command in your terminal, then restart Spotify."))));
  }

  // src/app/components/Footer.tsx
  function Footer({ version, updateInfo, onShowUpdate }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-footer" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "version-text" }, "v", version, " - made with love by", " ", /* @__PURE__ */ Spicetify.React.createElement("a", { href: "https://github.com/Xndr2/listening-stats" }, "Xndr")), updateInfo?.available && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: onShowUpdate }, "Update v", updateInfo.latestVersion));
  }

  // src/services/export.ts
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function exportStatsAsJSON(stats, period) {
    const periodName = getPeriodDisplayName(period);
    const data = {
      period: periodName,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalListeningTime: formatDuration(stats.totalTimeMs),
      totalTimeMs: stats.totalTimeMs,
      trackCount: stats.trackCount,
      uniqueTrackCount: stats.uniqueTrackCount,
      uniqueArtistCount: stats.uniqueArtistCount,
      streakDays: stats.streakDays,
      skipRate: Math.round(stats.skipRate * 100),
      topTracks: stats.topTracks.map((t) => ({
        rank: t.rank,
        track: t.trackName,
        artist: t.artistName,
        playCount: t.playCount || 0
      })),
      topArtists: stats.topArtists.map((a) => ({
        rank: a.rank,
        artist: a.artistName,
        genres: a.genres,
        playCount: a.playCount || 0
      })),
      topAlbums: stats.topAlbums.map((a) => ({
        album: a.albumName,
        artist: a.artistName,
        playCount: a.playCount || 0
      })),
      topGenres: stats.topGenres.map((g) => ({
        genre: g.genre,
        count: g.count
      }))
    };
    const filename = `listening-stats-${period}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
  }
  function exportStatsAsCSV(stats, period) {
    const periodName = getPeriodDisplayName(period);
    const lines = [];
    lines.push(`Period,${periodName}`);
    lines.push(`Exported,${(/* @__PURE__ */ new Date()).toISOString()}`);
    lines.push(`Total Time,${formatDuration(stats.totalTimeMs)}`);
    lines.push(`Track Count,${stats.trackCount}`);
    lines.push(`Unique Tracks,${stats.uniqueTrackCount}`);
    lines.push(`Unique Artists,${stats.uniqueArtistCount}`);
    lines.push("");
    lines.push("Top Tracks");
    lines.push("Rank,Track,Artist,Play Count");
    for (const t of stats.topTracks) {
      lines.push(
        `${t.rank},"${t.trackName.replace(/"/g, '""')}","${t.artistName.replace(/"/g, '""')}",${t.playCount || 0}`
      );
    }
    lines.push("");
    lines.push("Top Artists");
    lines.push("Rank,Artist,Genres,Play Count");
    for (const a of stats.topArtists) {
      lines.push(
        `${a.rank},"${a.artistName.replace(/"/g, '""')}","${(a.genres || []).join("; ")}",${a.playCount || 0}`
      );
    }
    lines.push("");
    lines.push("Top Albums");
    lines.push("Album,Artist,Play Count");
    for (const a of stats.topAlbums) {
      lines.push(
        `"${a.albumName.replace(/"/g, '""')}","${a.artistName.replace(/"/g, '""')}",${a.playCount || 0}`
      );
    }
    const filename = `listening-stats-${period}-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    downloadFile(lines.join("\n"), filename, "text/csv");
  }
  async function exportRawEventsAsJSON() {
    const { getAllPlayEvents: getAllPlayEvents2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    const events = await getAllPlayEvents2();
    const filename = `listening-stats-raw-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    downloadFile(JSON.stringify(events, null, 2), filename, "application/json");
  }
  async function exportRawEventsAsCSV() {
    const { getAllPlayEvents: getAllPlayEvents2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    const events = await getAllPlayEvents2();
    const lines = [];
    lines.push(
      "Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At"
    );
    for (const e of events) {
      lines.push(
        [
          `"${e.trackName.replace(/"/g, '""')}"`,
          `"${e.artistName.replace(/"/g, '""')}"`,
          `"${e.albumName.replace(/"/g, '""')}"`,
          e.durationMs,
          e.playedMs,
          new Date(e.startedAt).toISOString(),
          new Date(e.endedAt).toISOString()
        ].join(",")
      );
    }
    const filename = `listening-stats-raw-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    downloadFile(lines.join("\n"), filename, "text/csv");
  }

  // src/services/spotify-api.ts
  var STORAGE_PREFIX = "listening-stats:";
  var QUEUE_DELAY_MS = 300;
  var MAX_BATCH = 50;
  var CACHE_TTL_MS3 = 3e5;
  var DEFAULT_BACKOFF_MS = 6e4;
  var MAX_BACKOFF_MS = 6e5;
  var rateLimitedUntil = 0;
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}rateLimitedUntil`);
    if (stored) {
      const val = parseInt(stored, 10);
      rateLimitedUntil = Date.now() >= val ? 0 : val;
      if (rateLimitedUntil === 0) {
        localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
      }
    }
  } catch {
  }
  function isApiAvailable() {
    return Date.now() >= rateLimitedUntil;
  }
  function resetRateLimit() {
    rateLimitedUntil = 0;
    localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
    circuitBreaker.reset();
  }
  function setRateLimit(error) {
    let backoffMs = DEFAULT_BACKOFF_MS;
    const retryAfterRaw = error?.headers?.["retry-after"] ?? error?.body?.["Retry-After"] ?? error?.headers?.["Retry-After"];
    if (retryAfterRaw != null) {
      const parsed = parseInt(String(retryAfterRaw), 10);
      if (!isNaN(parsed) && parsed > 0) {
        backoffMs = Math.min(parsed * 1e3, MAX_BACKOFF_MS);
      }
    }
    rateLimitedUntil = Date.now() + backoffMs;
    localStorage.setItem(
      `${STORAGE_PREFIX}rateLimitedUntil`,
      rateLimitedUntil.toString()
    );
  }
  var cache3 = /* @__PURE__ */ new Map();
  function getCached3(key) {
    const entry = cache3.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      cache3.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache3(key, data) {
    cache3.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS3 });
  }
  function clearApiCaches() {
    cache3.clear();
  }
  var PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
  var queue = [];
  var draining = false;
  var inflight = /* @__PURE__ */ new Map();
  var circuitBreaker = new CircuitBreaker(5, 6e4);
  function enqueueWithPriority(key, fn, priority = "normal") {
    const existing = inflight.get(key);
    if (existing) return existing;
    const promise = new Promise((resolve, reject) => {
      queue.push({ key, fn, resolve, reject, priority });
      queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      if (!draining) drainQueue();
    });
    inflight.set(key, promise);
    promise.finally(() => inflight.delete(key));
    return promise;
  }
  async function drainQueue() {
    draining = true;
    while (queue.length > 0) {
      if (!isApiAvailable()) {
        const waitMs = rateLimitedUntil - Date.now();
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const item = queue.shift();
      try {
        const result = await circuitBreaker.execute(() => item.fn());
        item.resolve(result);
      } catch (error) {
        if (error?.message?.includes("429") || error?.status === 429 || error?.statusCode === 429) {
          setRateLimit(error);
        }
        item.reject(error);
      }
      if (queue.length > 0) {
        await new Promise((r) => setTimeout(r, QUEUE_DELAY_MS));
      }
    }
    draining = false;
  }
  async function apiFetch(url) {
    const cached2 = getCached3(url);
    if (cached2) return cached2;
    return enqueueWithPriority(url, async () => {
      let response;
      try {
        response = await Spicetify.CosmosAsync.get(url);
      } catch (err) {
        if (err?.status === 429 || String(err?.message || "").includes("429")) {
          setRateLimit(err);
          throw new ApiError(
            err?.message || "Rate limited",
            429,
            true
          );
        }
        const status = err?.status;
        throw new ApiError(
          err?.message || "API request failed",
          status,
          status !== void 0 && (status === 429 || status >= 500)
        );
      }
      if (!response) {
        throw new ApiError("Empty API response", void 0, false);
      }
      if (response.error) {
        const status = response.error.status;
        const message = response.error.message || `Spotify API error ${status}`;
        if (status === 429) setRateLimit(response);
        throw new ApiError(message, status, status === 429 || status >= 500);
      }
      setCache3(url, response);
      return response;
    });
  }
  var SEARCH_CACHE_KEY = "listening-stats:searchCache";
  var searchCache = /* @__PURE__ */ new Map();
  try {
    const stored = localStorage.getItem(SEARCH_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const [k, v] of Object.entries(parsed)) {
        searchCache.set(k, v);
      }
    }
  } catch {
  }
  var artistCoalescer = createBatchCoalescer(
    async (ids) => {
      const results = /* @__PURE__ */ new Map();
      for (let i = 0; i < ids.length; i += MAX_BATCH) {
        const chunk = ids.slice(i, i + MAX_BATCH);
        try {
          const response = await apiFetch(
            `https://api.spotify.com/v1/artists?ids=${chunk.join(",")}`
          );
          if (response?.artists) {
            for (const artist of response.artists.filter(Boolean)) {
              if (artist.id) results.set(artist.id, artist);
            }
          }
        } catch (error) {
          console.warn("[ListeningStats] Artist batch fetch failed:", error);
        }
      }
      return results;
    },
    50,
    MAX_BATCH
  );

  // src/app/components/SettingsPanel.tsx
  init_storage();
  var { useState } = Spicetify.React;
  function SettingsCategory({
    title,
    children,
    defaultOpen = false
  }) {
    const [open, setOpen] = useState(defaultOpen);
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-category" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `settings-category-header ${open ? "open" : ""}`,
        onClick: () => setOpen(!open)
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", null, title),
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `settings-chevron ${open ? "open" : ""}` })
    ), open && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-category-body" }, children));
  }
  var PROVIDER_NAMES = {
    local: "Local Tracking",
    lastfm: "Last.fm",
    statsfm: "stats.fm"
  };
  function SettingsPanel({
    onRefresh,
    onCheckUpdates,
    onProviderChanged,
    onClose,
    onReset,
    stats,
    period
  }) {
    const currentProvider = getSelectedProviderType();
    const [showProviderPicker, setShowProviderPicker] = useState(false);
    const [lfmUsername, setLfmUsername] = useState("");
    const [lfmApiKey, setLfmApiKey] = useState("");
    const [lfmValidating, setLfmValidating] = useState(false);
    const [lfmError, setLfmError] = useState("");
    const lfmConnected = isConnected();
    const lfmConfig = getConfig();
    const [sfmUsername, setSfmUsername] = useState("");
    const [sfmValidating, setSfmValidating] = useState(false);
    const [sfmError, setSfmError] = useState("");
    const sfmConnected = isConnected2();
    const sfmConfig = getConfig2();
    const [loggingOn, setLoggingOn] = useState(isLoggingEnabled());
    const prefs = getPreferences();
    const [use24h, setUse24h] = useState(prefs.use24HourTime);
    const [itemCount, setItemCount] = useState(prefs.itemsPerSection);
    const [genreCount, setGenreCount] = useState(prefs.genresPerSection);
    const [hiddenSections, setHiddenSections] = useState(prefs.hiddenSections);
    const switchProvider = (type) => {
      activateProvider(type);
      setShowProviderPicker(false);
      onProviderChanged?.();
    };
    const handleLastfmSwitch = async () => {
      if (!lfmUsername.trim() || !lfmApiKey.trim()) {
        setLfmError("Both fields are required");
        return;
      }
      setLfmValidating(true);
      setLfmError("");
      try {
        const info = await validateUser(
          lfmUsername.trim(),
          lfmApiKey.trim()
        );
        saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
        switchProvider("lastfm");
      } catch (err) {
        setLfmError(err.message || "Connection failed");
      } finally {
        setLfmValidating(false);
      }
    };
    const handleStatsfmSwitch = async () => {
      if (!sfmUsername.trim()) {
        setSfmError("Username is required");
        return;
      }
      setSfmValidating(true);
      setSfmError("");
      try {
        const info = await validateUser2(sfmUsername.trim());
        saveConfig2({ username: info.customId, isPlus: info.isPlus });
        switchProvider("statsfm");
      } catch (err) {
        setSfmError(err.message || "Connection failed");
      } finally {
        setSfmValidating(false);
      }
    };
    const handleSfmDisconnect = () => {
      clearConfig2();
      clearStatsfmCache();
      Spicetify.showNotification("Disconnected from stats.fm");
      onRefresh();
    };
    const handleLfmDisconnect = () => {
      clearConfig();
      clearLastfmCache();
      Spicetify.showNotification("Disconnected from Last.fm");
      onRefresh();
    };
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-panel" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "settings-title" }, "Settings"), onClose && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "settings-close-btn",
        onClick: onClose,
        dangerouslySetInnerHTML: { __html: Icons.close || "&times;" }
      }
    )), /* @__PURE__ */ Spicetify.React.createElement(SettingsCategory, { title: "Data Source", defaultOpen: true }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-current" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Currently using:", " ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, currentProvider ? PROVIDER_NAMES[currentProvider] : "None")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => setShowProviderPicker(!showProviderPicker)
      },
      "Change"
    )), !showProviderPicker && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "provider-guides-row" }, currentProvider !== "statsfm" && !sfmConnected && /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "provider-setup-link",
        href: "https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "stats.fm Setup Guide",
      " ",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    ), currentProvider !== "lastfm" && !lfmConnected && /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "provider-setup-link",
        href: "https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Last.fm Setup Guide",
      " ",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), showProviderPicker && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-picker" }, sfmConnected || currentProvider === "statsfm" ? /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: `provider-option ${currentProvider === "statsfm" ? "active" : ""}`,
        onClick: () => switchProvider("statsfm"),
        role: "button",
        tabIndex: 0
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "stats.fm"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", sfmConfig?.username || "..."),
      /* @__PURE__ */ Spicetify.React.createElement(
        "a",
        {
          className: "provider-setup-link",
          href: "https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide",
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: (e) => e.stopPropagation()
        },
        "View Setup Guide",
        " ",
        /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
      )
    ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "provider-option lastfm-setup" }, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "stats.fm"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form compact" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "stats.fm username",
        value: sfmUsername,
        onChange: (e) => setSfmUsername(e.target.value),
        disabled: sfmValidating
      }
    ), sfmError && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "lastfm-error" }, sfmError), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn primary",
        onClick: handleStatsfmSwitch,
        disabled: sfmValidating
      },
      sfmValidating ? "Connecting..." : "Connect & Switch"
    )), /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "provider-setup-link",
        href: "https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "View Setup Guide",
      " ",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), lfmConnected || currentProvider === "lastfm" ? /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: `provider-option ${currentProvider === "lastfm" ? "active" : ""}`,
        onClick: () => switchProvider("lastfm"),
        role: "button",
        tabIndex: 0
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Last.fm"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", lfmConfig?.username || "..."),
      /* @__PURE__ */ Spicetify.React.createElement(
        "a",
        {
          className: "provider-setup-link",
          href: "https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide",
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: (e) => e.stopPropagation()
        },
        "View Setup Guide",
        " ",
        /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
      )
    ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "provider-option lastfm-setup" }, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Last.fm"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form compact" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "Username",
        value: lfmUsername,
        onChange: (e) => setLfmUsername(e.target.value),
        disabled: lfmValidating
      }
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "API key",
        value: lfmApiKey,
        onChange: (e) => setLfmApiKey(e.target.value),
        disabled: lfmValidating
      }
    ), lfmError && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "lastfm-error" }, lfmError), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn primary",
        onClick: handleLastfmSwitch,
        disabled: lfmValidating
      },
      lfmValidating ? "Connecting..." : "Connect & Switch"
    )), /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "provider-setup-link",
        href: "https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "View Setup Guide",
      " ",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `provider-option ${currentProvider === "local" ? "active" : ""}`,
        onClick: () => switchProvider("local")
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Local Tracking"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Tracks on this device with IndexedDB")
    )), currentProvider === "lastfm" && lfmConnected && lfmConfig && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Last.fm Account"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-connected" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-info" }, /* @__PURE__ */ Spicetify.React.createElement(
      "span",
      {
        className: "lastfm-status-icon",
        dangerouslySetInnerHTML: { __html: Icons.check }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, lfmConfig.username))), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
        onClick: () => {
          handleLfmDisconnect();
          switchProvider("local");
        }
      },
      "Disconnect"
    ))), currentProvider === "statsfm" && sfmConnected && sfmConfig && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "stats.fm Account"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-connected" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-info" }, /* @__PURE__ */ Spicetify.React.createElement(
      "span",
      {
        className: "lastfm-status-icon",
        dangerouslySetInnerHTML: { __html: Icons.check }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, sfmConfig.username))), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
        onClick: () => {
          handleSfmDisconnect();
          switchProvider("local");
        }
      },
      "Disconnect"
    )))), /* @__PURE__ */ Spicetify.React.createElement(SettingsCategory, { title: "Display" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "24-hour time"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Show times as 14:00 instead of 2pm")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `settings-toggle ${use24h ? "active" : ""}`,
        onClick: () => {
          const next = !use24h;
          setPreference("use24HourTime", next);
          setUse24h(next);
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: "settings-toggle-knob" })
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Items per section"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Number of tracks, artists, and albums shown in each list")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-item-count-picker" }, [3, 5, 10].map((n) => /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        key: n,
        className: `settings-count-btn ${itemCount === n ? "active" : ""}`,
        onClick: () => {
          setPreference("itemsPerSection", n);
          setItemCount(n);
        }
      },
      n
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Genres shown"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Number of genres displayed in the Top Genres section")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-item-count-picker" }, [3, 5, 10].map((n) => /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        key: n,
        className: `settings-count-btn ${genreCount === n ? "active" : ""}`,
        onClick: () => {
          setPreference("genresPerSection", n);
          setGenreCount(n);
        }
      },
      n
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-section-vis" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Visible sections"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Toggle which sections appear on the dashboard"), [
      { id: "overview", label: "Overview" },
      { id: "toplists", label: "Top Lists" },
      { id: "genres", label: "Top Genres" },
      { id: "activity", label: "Activity Chart" },
      { id: "recent", label: "Recently Played" }
    ].map(({ id, label }) => {
      const isHidden = hiddenSections.includes(id);
      return /* @__PURE__ */ Spicetify.React.createElement("div", { key: id, className: "settings-toggle-row compact" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "settings-vis-label" }, label), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: `settings-toggle ${!isHidden ? "active" : ""}`,
          onClick: () => {
            const next = isHidden ? hiddenSections.filter((s) => s !== id) : [...hiddenSections, id];
            setPreference("hiddenSections", next);
            setHiddenSections(next);
          }
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: "settings-toggle-knob" })
      ));
    }))), /* @__PURE__ */ Spicetify.React.createElement(SettingsCategory, { title: "Layout" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Card Order"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Drag section headers on the main page to reorder cards.")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          window.dispatchEvent(
            new CustomEvent("listening-stats:reset-layout")
          );
          setPreference("hiddenSections", []);
          setHiddenSections([]);
          setPreference("itemsPerSection", 5);
          setItemCount(5);
          setPreference("genresPerSection", 5);
          setGenreCount(5);
          Spicetify.showNotification("Layout reset to default");
        }
      },
      "Reset to Default"
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Feature Tour"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Walk through the app's features with a guided tooltip tour.")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          onClose?.();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("listening-stats:start-tour"));
          }, 300);
        }
      },
      "Restart Tour"
    ))), /* @__PURE__ */ Spicetify.React.createElement(SettingsCategory, { title: "Advanced" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Console Logging"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Log tracked songs, skips, and playback events to the browser console (F12).")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `settings-toggle ${loggingOn ? "active" : ""}`,
        onClick: () => {
          const next = !loggingOn;
          setLoggingEnabled(next);
          setLoggingOn(next);
          Spicetify.showNotification(
            next ? "Logging enabled. Open DevTools (Ctrl + Shift + I) to see output" : "Logging disabled"
          );
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: "settings-toggle-knob" })
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-actions-row" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          clearStatsCache();
          onRefresh();
        }
      },
      "Refresh"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          resetRateLimit();
          clearApiCaches();
          clearStatsCache();
          clearLastfmCache();
          clearStatsfmCache();
          Spicetify.showNotification("Cache cleared");
        }
      },
      "Clear Cache"
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onCheckUpdates }, "Check Updates")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-export" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Export Data"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-actions-row" }, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        disabled: !stats,
        onClick: () => stats && period && exportStatsAsJSON(stats, period)
      },
      "Export JSON"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        disabled: !stats,
        onClick: () => stats && period && exportStatsAsCSV(stats, period)
      },
      "Export CSV"
    ), currentProvider === "local" && /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          exportRawEventsAsJSON();
          Spicetify.showNotification("Exporting...");
        }
      },
      "Raw History (JSON)"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          exportRawEventsAsCSV();
          Spicetify.showNotification("Exporting...");
        }
      },
      "Raw History (CSV)"
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-danger-zone" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Danger Zone"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-danger-desc" }, "Wipe all data and return to the setup screen. This clears the IndexedDB database, all saved accounts, caches, and preferences."), currentProvider === "local" && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
        style: { marginBottom: 8 },
        onClick: () => {
          if (confirm(
            "Delete all local tracking data? This cannot be undone."
          )) {
            clearAllData();
            clearPollingData();
            Spicetify.showNotification("All local data cleared");
            onRefresh();
          }
        }
      },
      "Reset Local Data"
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
        onClick: () => {
          if (confirm(
            "This will delete ALL data including your IndexedDB history, saved accounts, and preferences. This cannot be undone. Continue?"
          )) {
            clearAllData();
            clearPollingData();
            clearStatsCache();
            clearApiCaches();
            resetRateLimit();
            clearConfig();
            clearLastfmCache();
            clearConfig2();
            clearStatsfmCache();
            clearProviderSelection();
            try {
              localStorage.removeItem(
                "listening-stats:sfm-promo-dismissed"
              );
              localStorage.removeItem("listening-stats:lastUpdateCheck");
              localStorage.removeItem("listening-stats:lastUpdate");
              localStorage.removeItem("listening-stats:searchCache");
              localStorage.removeItem("listening-stats:logging");
              localStorage.removeItem("listening-stats:preferences");
              localStorage.removeItem("listening-stats:tour-seen");
              localStorage.removeItem("listening-stats:tour-version");
              localStorage.removeItem("listening-stats:card-order");
            } catch {
            }
            onReset?.();
          }
        }
      },
      "Wipe Everything"
    ))));
  }

  // src/app/utils.ts
  function navigateToUri(uri) {
    if (uri && Spicetify.Platform?.History) {
      const [, type, id] = uri.split(":");
      if (type && id) {
        Spicetify.Platform.History.push(`/${type}/${id}`);
      }
    }
  }
  async function toggleLike(trackUri, isLiked) {
    try {
      if (isLiked) {
        await Spicetify.Platform.LibraryAPI.remove({ uris: [trackUri] });
      } else {
        await Spicetify.Platform.LibraryAPI.add({ uris: [trackUri] });
      }
      return !isLiked;
    } catch (error) {
      console.error("[ListeningStats] Failed to toggle like:", error);
      return isLiked;
    }
  }
  async function checkLikedTracks(trackUris) {
    const result = /* @__PURE__ */ new Map();
    if (trackUris.length === 0) return result;
    try {
      const contains = await Spicetify.Platform.LibraryAPI.contains(...trackUris);
      trackUris.forEach((uri, i) => result.set(uri, contains[i]));
    } catch (error) {
      console.error("[ListeningStats] Failed to check liked status:", error);
    }
    return result;
  }
  function formatMinutes(ms) {
    return `${Math.round(ms / 6e4)} min`;
  }
  var PAYOUT_PER_STREAM = 4e-3;
  function estimateArtistPayout(streamCount) {
    const payout = streamCount * PAYOUT_PER_STREAM;
    return payout.toFixed(2);
  }
  function getRankClass(index) {
    if (index === 0) return "gold";
    if (index === 1) return "silver";
    if (index === 2) return "bronze";
    return "";
  }
  function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const minutes = Math.floor(diffMs / 6e4);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  // src/app/components/AnimatedNumber.tsx
  var { useState: useState2, useEffect, useRef } = Spicetify.React;
  function AnimatedNumber({
    value,
    duration = 800,
    format
  }) {
    const [display, setDisplay] = useState2("0");
    const prevValue = useRef(0);
    useEffect(() => {
      const start = prevValue.current;
      const end = value;
      prevValue.current = value;
      if (start === end) {
        setDisplay(format ? format(end) : String(end));
        return;
      }
      const startTime = performance.now();
      function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * eased;
        setDisplay(
          format ? format(Math.round(current)) : String(Math.round(current))
        );
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      requestAnimationFrame(animate);
    }, [value, duration]);
    return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, display);
  }

  // src/app/components/PeriodTabs.tsx
  function PeriodTabs({
    period,
    periods,
    periodLabels,
    onPeriodChange
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "period-tabs" }, periods.map((p) => /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        key: p,
        className: `period-tab ${period === p ? "active" : ""}`,
        onClick: () => onPeriodChange(p)
      },
      periodLabels[p] || p
    )));
  }

  // src/app/components/PortalTooltip.tsx
  var { useState: useState3, useRef: useRef2, useCallback } = Spicetify.React;
  function PortalTooltip({ text, children, className, style }) {
    const [show, setShow] = useState3(false);
    const [pos, setPos] = useState3({ top: 0, left: 0 });
    const ref = useRef2(null);
    const onEnter = useCallback(() => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setPos({
          top: rect.top - 8,
          left: rect.left + rect.width / 2
        });
      }
      setShow(true);
    }, []);
    const onLeave = useCallback(() => setShow(false), []);
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        ref,
        className,
        style,
        onMouseEnter: onEnter,
        onMouseLeave: onLeave
      },
      children,
      show && Spicetify.ReactDOM.createPortal(
        /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            className: "stat-tooltip-portal",
            style: {
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9990
            }
          },
          text
        ),
        document.body
      )
    );
  }

  // src/app/components/OverviewCards.tsx
  function OverviewCards({
    stats,
    period,
    periods,
    periodLabels,
    onPeriodChange
  }) {
    const payout = estimateArtistPayout(stats.trackCount);
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card hero" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value" }, formatDurationLong(stats.totalTimeMs)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Time Listened"), /* @__PURE__ */ Spicetify.React.createElement(
      PeriodTabs,
      {
        period,
        periods,
        periodLabels,
        onPeriodChange
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-secondary" }, /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Total number of tracks played (including repeats)" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.trackCount, format: formatNumber })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Tracks"))), /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Number of different artists you've listened to" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueArtistCount, format: formatNumber })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Artists"))), /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Number of different tracks you've listened to" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueTrackCount, format: formatNumber })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Unique"))), stats.lastfmConnected && stats.totalScrobbles ? /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Total plays recorded by Last.fm" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, formatNumber(stats.totalScrobbles)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Scrobbles"))) : null)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Estimated amount Spotify paid artists from your streams ($0.004/stream)" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value green" }, "$", payout), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Spotify paid artists"))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Consecutive days with at least one play" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value orange" }, formatNumber(stats.streakDays)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Day Streak"))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: stats.newArtistsCount > 0 ? "Artists you listened to for the first time in this period" : "Number of days with at least one play in this period" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, stats.newArtistsCount > 0 ? /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, formatNumber(stats.newArtistsCount)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "New Artists")) : /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, formatNumber(stats.listenedDays)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Days Listened")))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "Percentage of tracks skipped before the play threshold" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value red" }, Math.floor(stats.skipRate * 100), "%"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Skip Rate")))))));
  }

  // src/app/components/ImageWithRetry.tsx
  var { useState: useState4, useRef: useRef3, useEffect: useEffect2 } = Spicetify.React;
  function ImageWithRetry({
    src,
    className = "",
    alt = "",
    maxRetries = 3
  }) {
    const [attempt, setAttempt] = useState4(0);
    const [failed, setFailed] = useState4(false);
    const prevSrcRef = useRef3(src);
    const timerRef = useRef3(null);
    useEffect2(() => {
      if (prevSrcRef.current !== src) {
        prevSrcRef.current = src;
        setAttempt(0);
        setFailed(false);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    }, [src]);
    useEffect2(() => {
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);
    const handleError = () => {
      if (attempt < maxRetries) {
        const delay = 1e3 * Math.pow(2, attempt);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setAttempt((prev) => prev + 1);
        }, delay);
      } else {
        setFailed(true);
      }
    };
    if (failed || !src) {
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: `${className} placeholder` });
    }
    const retrySrc = attempt > 0 ? src + (src.includes("?") ? "&" : "?") + `retry=${attempt}` : src;
    return /* @__PURE__ */ Spicetify.React.createElement(
      "img",
      {
        key: retrySrc,
        src: retrySrc,
        className,
        alt,
        onError: handleError
      }
    );
  }

  // src/app/components/TopLists.tsx
  function TopLists({
    stats,
    likedTracks,
    onLikeToggle,
    showLikeButtons = true,
    period = ""
  }) {
    const itemCount = getPreferences().itemsPerSection;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-lists-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.music } }), "Top Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topTracks.slice(0, itemCount).map((t, i) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: t.trackUri || `track-${i}`,
        className: "item-row",
        onClick: () => t.trackUri && navigateToUri(t.trackUri)
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
      t.albumArt ? /* @__PURE__ */ Spicetify.React.createElement(ImageWithRetry, { src: t.albumArt, className: "item-art" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art placeholder" }),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, t.trackName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, t.artistName)),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, t.playCount ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, formatNumber(t.playCount), " plays") : null, t.totalTimeMs > 0 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(t.totalTimeMs))),
      showLikeButtons && (t.trackUri ? /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: `heart-btn ${likedTracks.get(t.trackUri) ? "liked" : ""}`,
          onClick: (e) => onLikeToggle(t.trackUri, e),
          dangerouslySetInnerHTML: {
            __html: likedTracks.get(t.trackUri) ? Icons.heartFilled : Icons.heart
          }
        }
      ) : /* @__PURE__ */ Spicetify.React.createElement(PortalTooltip, { text: "No Spotify link, can't save to library" }, /* @__PURE__ */ Spicetify.React.createElement(
        "span",
        {
          className: "heart-btn disabled",
          dangerouslySetInnerHTML: { __html: Icons.heart }
        }
      )))
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.users } }), "Top Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topArtists.slice(0, itemCount).map((a, i) => {
      return /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          key: a.artistUri || a.artistName,
          className: "item-row",
          onClick: () => a.artistUri && navigateToUri(a.artistUri)
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
        a.artistImage ? /* @__PURE__ */ Spicetify.React.createElement(
          ImageWithRetry,
          {
            src: a.artistImage,
            className: "item-art round"
          }
        ) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art round placeholder artist-placeholder" }),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.artistName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.genres?.slice(0, 2).join(", ") || "")),
        a.playCount ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, formatNumber(a.playCount), " plays")) : null
      );
    }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.album } }), "Top Albums")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topAlbums.slice(0, itemCount).map((a, i) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: a.albumUri || `album-${i}`,
        className: "item-row",
        onClick: () => a.albumUri && navigateToUri(a.albumUri)
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
      a.albumArt ? /* @__PURE__ */ Spicetify.React.createElement(ImageWithRetry, { src: a.albumArt, className: "item-art" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art placeholder" }),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.albumName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.artistName)),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, a.playCount ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, formatNumber(a.playCount), " plays") : null, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatNumber(a.trackCount), " tracks"))
    )))));
  }

  // src/app/components/RecentlyPlayed.tsx
  function RecentlyPlayed({ recentTracks }) {
    if (recentTracks.length === 0) {
      return null;
    }
    const limit = 12;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "recent-title" }, "Recently Played")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-scroll" }, recentTracks.slice(0, limit).map((t) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: `${t.trackUri || t.trackName}-${t.playedAt}`,
        className: "recent-card",
        onClick: () => t.trackUri && navigateToUri(t.trackUri)
      },
      t.albumArt ? /* @__PURE__ */ Spicetify.React.createElement(ImageWithRetry, { src: t.albumArt, className: "recent-art" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-art placeholder" }),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-name" }, t.trackName),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-meta" }, t.artistName),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-time" }, timeAgo(t.playedAt))
    ))));
  }

  // src/app/components/EmptyState.tsx
  function EmptyState({
    stats,
    period,
    periods,
    periodLabels,
    onPeriodChange
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card hero" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value" }, formatDurationLong(stats?.totalTimeMs ?? 0)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "No data for ", getPeriodDisplayName(period)), /* @__PURE__ */ Spicetify.React.createElement(
      PeriodTabs,
      {
        period,
        periods,
        periodLabels,
        onPeriodChange
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-secondary" }, "Play some music to see your statistics here!"))));
  }

  // src/app/components/LoadingSkeleton.tsx
  function LoadingSkeleton() {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-title-line" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-subtitle-line" })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-card skeleton-hero" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-card" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-card" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-card" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-card" }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-lists-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-list-title" }), Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ Spicetify.React.createElement("div", { key: i, className: "skeleton-item" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-circle" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-item-lines" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-short" }))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-list-title" }), Array.from({ length: 5 }).map((_, i) => /* @__PURE__ */ Spicetify.React.createElement("div", { key: i, className: "skeleton-item" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-circle" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-item-lines" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line" }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "skeleton-line skeleton-short" })))))));
  }

  // src/app/components/LastfmBanner.tsx
  var { useState: useState5, useEffect: useEffect3 } = Spicetify.React;

  // src/app/components/SetupWizard.tsx
  var { useState: useState6, useEffect: useEffect4 } = Spicetify.React;
  var STEPS = ["choose", "configure", "validate", "success"];
  function SetupWizard({ onComplete }) {
    const [stepIndex, setStepIndex] = useState6(0);
    const [provider, setProvider] = useState6(null);
    const [username, setUsername] = useState6("");
    const [apiKey, setApiKey] = useState6("");
    const [validating, setValidating] = useState6(false);
    const [validationError, setValidationError] = useState6("");
    const [confirmedUsername, setConfirmedUsername] = useState6("");
    const currentStep = STEPS[stepIndex];
    const goBack = () => {
      if (stepIndex > 0) {
        setValidationError("");
        setValidating(false);
        setStepIndex(stepIndex - 1);
      }
    };
    const handleChooseProvider = (choice) => {
      if (choice === "local") {
        activateProvider("local");
        onComplete();
        return;
      }
      setProvider(choice);
      setUsername("");
      setApiKey("");
      setValidationError("");
      setStepIndex(1);
    };
    const handleConfigureNext = () => {
      if (provider === "statsfm" && !username.trim()) return;
      if (provider === "lastfm" && (!username.trim() || !apiKey.trim())) return;
      setStepIndex(2);
    };
    const providerLabel = provider === "statsfm" ? "stats.fm" : provider === "lastfm" ? "Last.fm" : "";
    const canAdvanceConfigure = provider === "statsfm" ? username.trim().length > 0 : provider === "lastfm" ? username.trim().length > 0 && apiKey.trim().length > 0 : false;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-wizard" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-progress" }, STEPS.map((step, i) => {
      let cls = "wizard-dot";
      if (i === stepIndex) cls += " wizard-dot--active";
      else if (i < stepIndex) cls += " wizard-dot--completed";
      return /* @__PURE__ */ Spicetify.React.createElement("div", { key: step, className: cls });
    })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-step" }, currentStep === "choose" && /* @__PURE__ */ Spicetify.React.createElement(ChooseStep, { onChoose: handleChooseProvider }), currentStep === "configure" && /* @__PURE__ */ Spicetify.React.createElement(
      ConfigureStep,
      {
        provider,
        username,
        apiKey,
        onUsernameChange: setUsername,
        onApiKeyChange: setApiKey,
        onBack: goBack,
        onNext: handleConfigureNext,
        canAdvance: canAdvanceConfigure
      }
    ), currentStep === "validate" && /* @__PURE__ */ Spicetify.React.createElement(
      ValidateStep,
      {
        provider,
        username,
        apiKey,
        validating,
        error: validationError,
        onValidating: setValidating,
        onError: setValidationError,
        onSuccess: (name) => {
          setConfirmedUsername(name);
          setStepIndex(3);
        },
        onBack: goBack
      }
    ), currentStep === "success" && /* @__PURE__ */ Spicetify.React.createElement(
      SuccessStep,
      {
        provider,
        username: confirmedUsername,
        onComplete
      }
    )));
  }
  function ChooseStep({
    onChoose
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h2", { className: "wizard-step-title" }, "Choose your data source"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "wizard-step-desc" }, "Select where your listening stats come from."), /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "wizard-card recommended",
        onClick: () => onChoose("statsfm")
      },
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-card-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-card-icon" }, /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2V4zm6 3a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm4-1a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V7a1 1 0 0 0-1-1zm4 2a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1z" }))), /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "stats.fm"), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "setup-badge" }, "Recommended"))),
      /* @__PURE__ */ Spicetify.React.createElement("p", { className: "wizard-card-desc" }, "Accurate play counts and listening time. Just needs your username.")
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-card", onClick: () => onChoose("lastfm") }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-card-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-card-icon" }, /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.422 0 3.19 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" }))), /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Last.fm"))), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "wizard-card-desc" }, "Accurate play counts across all devices. Requires an API key.")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-divider" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "or")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "setup-alt-option",
        onClick: () => onChoose("local")
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.music } }),
      /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Use Local Tracking instead"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "Tracks on this device only, no account needed"))
    ));
  }
  function ConfigureStep({
    provider,
    username,
    apiKey,
    onUsernameChange,
    onApiKeyChange,
    onBack,
    onNext,
    canAdvance
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h2", { className: "wizard-step-title" }, "Configure ", provider === "statsfm" ? "stats.fm" : "Last.fm"), provider === "statsfm" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-form" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "stats.fm username",
        value: username,
        onChange: (e) => onUsernameChange(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && canAdvance) onNext();
        }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "wizard-helper" }, "Your stats.fm username (from the URL bar, not your display name).", " ", /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        href: "https://stats.fm",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Don't have an account? Create one at stats.fm"
    ))), provider === "lastfm" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-form" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "Last.fm username",
        value: username,
        onChange: (e) => onUsernameChange(e.target.value)
      }
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "Last.fm API key",
        value: apiKey,
        onChange: (e) => onApiKeyChange(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && canAdvance) onNext();
        }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-helper" }, /* @__PURE__ */ Spicetify.React.createElement("p", { style: { margin: "0 0 4px 0" } }, "How to get your API key:"), /* @__PURE__ */ Spicetify.React.createElement("ol", { style: { margin: 0, paddingLeft: "18px" } }, /* @__PURE__ */ Spicetify.React.createElement("li", null, "Visit", " ", /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        href: "https://www.last.fm/api/account/create",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "last.fm/api/account/create"
    )), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Fill in the application form (any name works)"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Copy the API key shown on the next page")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onBack }, "Back"), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn primary",
        onClick: onNext,
        disabled: !canAdvance
      },
      "Next"
    )));
  }
  function ValidateStep({
    provider,
    username,
    apiKey,
    validating,
    error,
    onValidating,
    onError,
    onSuccess,
    onBack
  }) {
    const runValidation = () => {
      onValidating(true);
      onError("");
      if (provider === "statsfm") {
        validateUser2(username.trim()).then((info) => {
          saveConfig2({ username: info.customId, isPlus: info.isPlus });
          activateProvider("statsfm");
          onSuccess(info.customId);
        }).catch((err) => {
          onError(err.message || "Connection failed");
          onValidating(false);
        });
      } else {
        validateUser(username.trim(), apiKey.trim()).then((info) => {
          saveConfig({ username: info.username, apiKey: apiKey.trim() });
          activateProvider("lastfm");
          onSuccess(info.username);
        }).catch((err) => {
          onError(err.message || "Connection failed");
          onValidating(false);
        });
      }
    };
    useEffect4(() => {
      runValidation();
    }, []);
    if (error) {
      return /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h2", { className: "wizard-step-title" }, "Validation Failed"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-error" }, error), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onBack }, "Back"), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn primary",
          onClick: () => {
            onError("");
            runValidation();
          }
        },
        "Try Again"
      )));
    }
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-validating" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-spinner" }), /* @__PURE__ */ Spicetify.React.createElement("p", null, "Validating your account..."));
  }
  function SuccessStep({
    provider,
    username,
    onComplete
  }) {
    const providerLabel = provider === "statsfm" ? "stats.fm" : "Last.fm";
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-success" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "wizard-success-icon" }, /* @__PURE__ */ Spicetify.React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2.5",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      },
      /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
      /* @__PURE__ */ Spicetify.React.createElement("polyline", { points: "22 4 12 14.01 9 11.01" })
    )), /* @__PURE__ */ Spicetify.React.createElement("h2", { className: "wizard-step-title" }, "You're all set!"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "wizard-step-desc" }, "Connected to ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, providerLabel), " as", " ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, username), "."), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: onComplete }, "Start Exploring"));
  }

  // src/app/components/SetupScreen.tsx
  function SetupScreen({ onProviderSelected }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-screen" }, /* @__PURE__ */ Spicetify.React.createElement(SetupWizard, { onComplete: onProviderSelected }));
  }

  // src/app/components/ActivityChart.tsx
  function ActivityChart({
    hourlyDistribution,
    peakHour,
    hourlyUnit = "ms"
  }) {
    if (!hourlyDistribution.some((h) => h > 0)) {
      return null;
    }
    const max = Math.max(...hourlyDistribution, 1);
    const formatValue = (val) => {
      if (hourlyUnit === "plays") {
        return `${val} ${val === 1 ? "play" : "plays"}`;
      }
      return formatMinutes(val);
    };
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "activity-title" }, "Activity by Hour"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-peak" }, "Peak: ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, formatHour(peakHour)))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-chart" }, hourlyDistribution.map((val, hr) => {
      const h = val > 0 ? Math.max(val / max * 100, 5) : 0;
      return /* @__PURE__ */ Spicetify.React.createElement(
        PortalTooltip,
        {
          key: hr,
          text: `${formatHour(hr)}: ${formatValue(val)}`,
          className: `activity-bar ${hr === peakHour && val > 0 ? "peak" : ""}`,
          style: { height: `${h}%`, animationDelay: `${hr * 0.02}s` }
        }
      );
    })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "chart-labels" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, formatHour(0)), /* @__PURE__ */ Spicetify.React.createElement("span", null, formatHour(6)), /* @__PURE__ */ Spicetify.React.createElement("span", null, formatHour(12)), /* @__PURE__ */ Spicetify.React.createElement("span", null, formatHour(18)), /* @__PURE__ */ Spicetify.React.createElement("span", null, formatHour(0))));
  }

  // src/app/components/DraggableSection.tsx
  var React = Spicetify.React;
  function GripIcon() {
    return /* @__PURE__ */ Spicetify.React.createElement(
      "svg",
      {
        className: "drag-grip-icon",
        viewBox: "0 0 16 16",
        fill: "currentColor",
        xmlns: "http://www.w3.org/2000/svg"
      },
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "5.5", cy: "3", r: "1.5" }),
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "10.5", cy: "3", r: "1.5" }),
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "5.5", cy: "8", r: "1.5" }),
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "10.5", cy: "8", r: "1.5" }),
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "5.5", cy: "13", r: "1.5" }),
      /* @__PURE__ */ Spicetify.React.createElement("circle", { cx: "10.5", cy: "13", r: "1.5" })
    );
  }
  function DraggableSection({
    id,
    children,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
    dropPosition
  }) {
    const wrapperClass = "draggable-section" + (isDragging ? " is-dragging" : "");
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: wrapperClass,
        "data-section-id": id,
        onDragOver: (e) => onDragOver(e, id),
        onDrop: (e) => {
          e.preventDefault();
          onDrop(e, id);
        }
      },
      dropPosition === "before" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "drop-indicator" }),
      /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "section-drag-handle",
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            onDragStart(id);
          },
          onDragEnd: () => onDragEnd()
        },
        /* @__PURE__ */ Spicetify.React.createElement(GripIcon, null)
      ),
      children,
      dropPosition === "after" && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "drop-indicator" })
    );
  }

  // src/app/components/TourOverlay.tsx
  var { useState: useState7, useEffect: useEffect5, useRef: useRef4, useCallback: useCallback2 } = Spicetify.React;
  var TOOLTIP_WIDTH = 320;
  var TOOLTIP_HEIGHT = 180;
  var OFFSET = 16;
  var EDGE_PADDING = 16;
  var REPOSITION_DEBOUNCE = 100;
  function lockScroll() {
    const el = document.querySelector(".main-view-container__scroll-node");
    if (!el) return () => {
    };
    const prev = el.style.overflowY;
    el.style.overflowY = "hidden";
    return () => {
      el.style.overflowY = prev;
    };
  }
  function computeTooltipPosition(targetRect, placement) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = 0;
    let left = 0;
    let actualPlacement = placement;
    const spotTop = targetRect.top - 8;
    const spotLeft = targetRect.left - 8;
    const spotWidth = targetRect.width + 16;
    const spotHeight = targetRect.height + 16;
    const spotRight = spotLeft + spotWidth;
    const spotBottom = spotTop + spotHeight;
    if (placement === "bottom" || placement === "top") {
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
      if (placement === "bottom") {
        top = spotBottom + OFFSET;
        if (top + TOOLTIP_HEIGHT > vh - EDGE_PADDING) {
          top = spotTop - OFFSET - TOOLTIP_HEIGHT;
          actualPlacement = "top";
        }
      } else {
        top = spotTop - OFFSET - TOOLTIP_HEIGHT;
        if (top < EDGE_PADDING) {
          top = spotBottom + OFFSET;
          actualPlacement = "bottom";
        }
      }
    } else {
      top = targetRect.top + targetRect.height / 2 - TOOLTIP_HEIGHT / 2;
      if (placement === "right") {
        left = spotRight + OFFSET;
        if (left + TOOLTIP_WIDTH > vw - EDGE_PADDING) {
          left = spotLeft - OFFSET - TOOLTIP_WIDTH;
          actualPlacement = "left";
        }
      } else {
        left = spotLeft - OFFSET - TOOLTIP_WIDTH;
        if (left < EDGE_PADDING) {
          left = spotRight + OFFSET;
          actualPlacement = "right";
        }
      }
    }
    left = Math.max(EDGE_PADDING, Math.min(left, vw - TOOLTIP_WIDTH - EDGE_PADDING));
    top = Math.max(EDGE_PADDING, Math.min(top, vh - TOOLTIP_HEIGHT - EDGE_PADDING));
    return { top, left, actualPlacement };
  }
  function TourOverlay({
    step,
    stepIndex,
    totalSteps,
    onNext,
    onPrev,
    onEnd,
    abortSignal
  }) {
    const [targetRect, setTargetRect] = useState7(null);
    const debounceRef = useRef4(0);
    const updatePosition = useCallback2(() => {
      const el = document.querySelector(step.target);
      if (!el) {
        if (!abortSignal.current.cancelled) {
          onNext();
        }
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      });
    }, [step.target, onNext, abortSignal]);
    useEffect5(() => {
      const el = document.querySelector(step.target);
      if (!el) {
        if (!abortSignal.current.cancelled) {
          onNext();
        }
        return;
      }
      const needsHighlight = step.target === ".section-drag-handle";
      if (needsHighlight) {
        el.classList.add("tour-highlight-handle");
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const unlockScroll = lockScroll();
      const timer = setTimeout(() => {
        if (abortSignal.current.cancelled) {
          unlockScroll();
          return;
        }
        requestAnimationFrame(() => {
          updatePosition();
          unlockScroll();
        });
      }, 500);
      return () => {
        clearTimeout(timer);
        unlockScroll();
        if (needsHighlight) {
          el.classList.remove("tour-highlight-handle");
        }
      };
    }, [step.target, updatePosition, onNext, abortSignal]);
    useEffect5(() => {
      const handleReposition = () => {
        clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(updatePosition, REPOSITION_DEBOUNCE);
      };
      const scrollContainer = document.querySelector(
        ".main-view-container__scroll-node"
      );
      scrollContainer?.addEventListener("scroll", handleReposition);
      window.addEventListener("scroll", handleReposition);
      window.addEventListener("resize", handleReposition);
      return () => {
        clearTimeout(debounceRef.current);
        scrollContainer?.removeEventListener("scroll", handleReposition);
        window.removeEventListener("scroll", handleReposition);
        window.removeEventListener("resize", handleReposition);
      };
    }, [updatePosition]);
    useEffect5(() => {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onEnd();
        } else if (e.key === "ArrowRight") {
          onNext();
        } else if (e.key === "ArrowLeft") {
          onPrev();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onEnd, onNext, onPrev]);
    if (!targetRect) return null;
    const placement = step.placement || "bottom";
    const { top: tooltipTop, left: tooltipLeft } = computeTooltipPosition(
      targetRect,
      placement
    );
    const isLastStep = stepIndex === totalSteps - 1;
    return Spicetify.React.createElement(
      Spicetify.React.Fragment,
      null,
      // Click-away backdrop
      Spicetify.React.createElement("div", {
        className: "tour-backdrop",
        onClick: onEnd
      }),
      // Spotlight
      Spicetify.React.createElement("div", {
        className: "tour-spotlight",
        style: {
          top: targetRect.top - 8,
          left: targetRect.left - 8,
          width: targetRect.width + 16,
          height: targetRect.height + 16
        }
      }),
      // Tooltip
      Spicetify.React.createElement(
        "div",
        {
          className: "tour-tooltip",
          style: { top: tooltipTop, left: tooltipLeft }
        },
        Spicetify.React.createElement(
          "h4",
          { className: "tour-tooltip-title" },
          step.title
        ),
        Spicetify.React.createElement(
          "p",
          { className: "tour-tooltip-content" },
          step.content
        ),
        Spicetify.React.createElement(
          "div",
          { className: "tour-tooltip-footer" },
          Spicetify.React.createElement(
            "span",
            { className: "tour-tooltip-counter" },
            `${stepIndex + 1} of ${totalSteps}`
          ),
          Spicetify.React.createElement(
            "div",
            { className: "tour-tooltip-actions" },
            stepIndex > 0 ? Spicetify.React.createElement(
              "button",
              { className: "tour-btn", onClick: onPrev },
              "Back"
            ) : null,
            Spicetify.React.createElement(
              "button",
              { className: "tour-btn", onClick: onEnd },
              "Skip"
            ),
            Spicetify.React.createElement(
              "button",
              {
                className: "tour-btn tour-btn--primary",
                onClick: isLastStep ? onEnd : onNext
              },
              isLastStep ? "Done" : "Next"
            )
          )
        )
      )
    );
  }

  // src/app/components/GenreChips.tsx
  function GenreChips({ topGenres }) {
    if (topGenres.length === 0) return null;
    const limit = getPreferences().genresPerSection;
    const genres = topGenres.slice(0, limit);
    const maxCount = genres[0]?.count || 1;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-bars-section" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "genre-bars-title" }, "Top Genres"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-bars" }, genres.map((g, i) => {
      const pct = g.count / maxCount * 100;
      return /* @__PURE__ */ Spicetify.React.createElement("div", { key: g.genre, className: "genre-bar-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "genre-bar-rank" }, i + 1), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-bar-track" }, /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "genre-bar-fill",
          style: { width: `${pct}%`, animationDelay: `${0.1 + i * 0.04}s` }
        }
      ), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "genre-bar-name" }, g.genre)), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "genre-bar-count" }, g.count));
    })));
  }

  // src/app/components/Header.tsx
  var { useState: useState8, useEffect: useEffect6, useRef: useRef5 } = Spicetify.React;
  var PROVIDER_NAMES2 = {
    local: "Local Tracking",
    lastfm: "Last.fm",
    statsfm: "stats.fm"
  };
  var ANNOUNCEMENT_URL = "https://raw.githubusercontent.com/Xndr2/listening-stats/main/ANNOUNCEMENT.md";
  function Announcement() {
    const [html, setHtml] = useState8(null);
    const fetched = useRef5(false);
    useEffect6(() => {
      if (fetched.current) return;
      fetched.current = true;
      const url = ANNOUNCEMENT_URL + "?t=" + Math.floor(Date.now() / 3e5);
      fetch(url).then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      }).then((text) => {
        const trimmed = text.trim();
        if (trimmed) setHtml(renderMarkdown(trimmed));
      }).catch(() => {
      });
    }, []);
    if (!html) return null;
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "stats-announcement",
        dangerouslySetInnerHTML: { __html: html }
      }
    );
  }
  function Header({
    onShare,
    onToggleSettings,
    providerType
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "stats-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-subtitle" }, "Your personal music analytics", providerType && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "provider-badge" }, "via ", PROVIDER_NAMES2[providerType])), /* @__PURE__ */ Spicetify.React.createElement(Announcement, null)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "header-actions" }, onToggleSettings && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "header-btn",
        onClick: onToggleSettings,
        title: "Settings",
        dangerouslySetInnerHTML: { __html: Icons.settings }
      }
    ), onShare && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "header-btn",
        onClick: onShare,
        title: "Share stats",
        dangerouslySetInnerHTML: { __html: Icons.share }
      }
    ))));
  }

  // src/services/share-card.ts
  function getProviderLabel(providerType) {
    if (providerType === "lastfm") return "via Last.fm";
    if (providerType === "statsfm") return "via stats.fm";
    if (providerType === "local") return "via Local Tracking";
    return "";
  }
  function getUsername2(providerType) {
    if (providerType === "lastfm") return getConfig()?.username || null;
    if (providerType === "statsfm") return getConfig2()?.username || null;
    return null;
  }
  var FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  var GREEN = [29, 185, 84];
  var GOLD = "#ffd700";
  var SILVER = "#c0c0c0";
  var BRONZE = "#cd7f32";
  async function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 5e3);
      img.src = url;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRoundRect(ctx, x, y, w, h, r) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }
  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + "\u2026").width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + "\u2026";
  }
  function rankColor(i) {
    return i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : "#888";
  }
  function rgb(c, a = 1) {
    return a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  function formatHourLabel(h) {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  }
  function extractDominantColor(img) {
    try {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      const max = Math.max(d[0], d[1], d[2]);
      if (max < 60) return GREEN;
      return [d[0], d[1], d[2]];
    } catch {
      return GREEN;
    }
  }
  function drawBlurredBackground(ctx, img, x, y, w, h, blur) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(img, dx - blur, dy - blur, dw + blur * 2, dh + blur * 2);
    ctx.filter = "none";
    ctx.restore();
  }
  function drawNoiseTexture(ctx, x, y, w, h, opacity) {
    const tileSize = 128;
    const offscreen = document.createElement("canvas");
    offscreen.width = tileSize;
    offscreen.height = tileSize;
    const octx = offscreen.getContext("2d");
    const imgData = octx.createImageData(tileSize, tileSize);
    const alpha = Math.round(opacity * 255);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = alpha;
    }
    octx.putImageData(imgData, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let ty = y; ty < y + h; ty += tileSize) {
      for (let tx = x; tx < x + w; tx += tileSize) {
        ctx.drawImage(offscreen, tx, ty);
      }
    }
    ctx.restore();
  }
  function drawAccentDivider(ctx, x, y, w, accent) {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, rgb(accent, 0.6));
    grad.addColorStop(0.5, rgb(accent, 0.15));
    grad.addColorStop(1, rgb(accent, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, 2);
  }
  function drawHourlyChart(ctx, data, x, y, w, h, accent, peakHour, barCount = 24) {
    const maxVal = Math.max(...data, 1);
    const gap = 4;
    const barW = (w - gap * (barCount - 1)) / barCount;
    const chartH = h - 24;
    const minBarH = 4;
    for (let i = 0; i < barCount; i++) {
      const val = data[i] || 0;
      const barH = Math.max(
        val > 0 ? val / maxVal * chartH : 0,
        val > 0 ? minBarH : 2
      );
      const bx = x + i * (barW + gap);
      const by = y + chartH - barH;
      const isPeak = i === peakHour;
      ctx.fillStyle = isPeak ? rgb(accent, 1) : rgb(accent, 0.4);
      fillRoundRect(ctx, bx, by, barW, barH, Math.min(barW / 2, 3));
      if (isPeak) {
        ctx.shadowColor = rgb(accent, 0.6);
        ctx.shadowBlur = 8;
        fillRoundRect(ctx, bx, by, barW, barH, Math.min(barW / 2, 3));
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${11}px ${FONT}`;
    ctx.textAlign = "center";
    for (let i = 0; i < barCount; i += 3) {
      const bx = x + i * (barW + gap) + barW / 2;
      ctx.fillText(formatHourLabel(i), bx, y + h);
    }
    ctx.textAlign = "left";
  }
  function drawGenrePills(ctx, genres, x, y, maxW, accent) {
    ctx.font = `500 ${13}px ${FONT}`;
    const pillH = 28;
    const pillGap = 8;
    const pillPadX = 14;
    let cx = x;
    for (const g of genres.slice(0, 6)) {
      const textW = ctx.measureText(g.genre).width;
      const pillW = textW + pillPadX * 2;
      if (cx + pillW > x + maxW) break;
      ctx.fillStyle = rgb(accent, 0.15);
      fillRoundRect(ctx, cx, y, pillW, pillH, pillH / 2);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.textBaseline = "middle";
      ctx.fillText(g.genre, cx + pillPadX, y + pillH / 2);
      ctx.textBaseline = "alphabetic";
      cx += pillW + pillGap;
    }
  }
  async function drawArt(ctx, url, x, y, size, radius) {
    if (!url) return null;
    const img = await loadImage(url);
    if (!img) return null;
    ctx.save();
    roundRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
    return img;
  }
  function drawPlaceholderArt(ctx, x, y, size, radius) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, x, y, size, size, radius);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = `${size * 0.4}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u266B", x + size / 2, y + size / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  function drawStatCard(ctx, x, y, w, h, value, label, accent, highlight = false) {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    fillRoundRect(ctx, x, y, w, h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = highlight ? rgb(accent) : "#fff";
    ctx.font = `bold ${30}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(value, x + w / 2, y + h * 0.48);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `500 ${12}px ${FONT}`;
    ctx.fillText(label, x + w / 2, y + h * 0.76);
    ctx.textAlign = "left";
  }
  function drawSectionHeader(ctx, title, x, y, accent) {
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(x + 5, y + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${20}px ${FONT}`;
    ctx.fillText(title, x + 18, y + 18);
    return y + 36;
  }
  function calculateStoryHeight(stats) {
    const pad = 56;
    let y = pad;
    y += 80;
    y += 260 + 100;
    y += 68 + 10 + 68 + 32;
    y += 16;
    const rowH = 68;
    const headerH = 40;
    const trackCount = Math.min(5, stats.topTracks.length);
    if (trackCount > 0) {
      y += headerH + rowH * trackCount + 28;
    }
    const artistCount = Math.min(5, stats.topArtists.length);
    if (artistCount > 0) {
      y += 16 + headerH + rowH * artistCount + 28;
    }
    const albumCount = Math.min(5, stats.topAlbums.length);
    if (albumCount > 0) {
      y += 16 + headerH + rowH * albumCount + 28;
    }
    if (stats.hourlyDistribution.some((v) => v > 0)) {
      y += 16 + headerH + 140 + 20;
    }
    if (stats.topGenres.length > 0) {
      y += 16 + 36 + 20;
    }
    y += 48;
    return Math.max(y, 900);
  }
  var STORY_W = 1080;
  var LAND_W = 1600;
  var LAND_H = 900;
  async function generateStoryCard(stats, period, providerType) {
    const w = STORY_W;
    const h = calculateStoryHeight(stats);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const pad = 56;
    const innerW = w - pad * 2;
    const rightEdge = w - pad;
    let accent = GREEN;
    let heroImg = null;
    if (stats.topTracks[0]?.albumArt) {
      heroImg = await loadImage(stats.topTracks[0].albumArt);
      if (heroImg) accent = extractDominantColor(heroImg);
    }
    if (heroImg) {
      drawBlurredBackground(ctx, heroImg, 0, 0, w, h, 60);
    }
    const baseOverlay = ctx.createLinearGradient(0, 0, 0, h);
    baseOverlay.addColorStop(0, "rgba(8,8,14,0.78)");
    baseOverlay.addColorStop(0.3, "rgba(8,8,14,0.88)");
    baseOverlay.addColorStop(1, "rgba(8,8,14,0.94)");
    ctx.fillStyle = baseOverlay;
    ctx.fillRect(0, 0, w, h);
    const username = getUsername2(providerType);
    let headerY = pad;
    if (username) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `500 ${16}px ${FONT}`;
      ctx.fillText(`@${username}`, pad, headerY + 14);
      headerY += 28;
    }
    const title = username ? `${username}'s Stats` : "My Listening Stats";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${44}px ${FONT}`;
    ctx.fillText(truncateText(ctx, title, innerW), pad, headerY + 38);
    const periodText = getPeriodDisplayName(period);
    ctx.font = `600 ${16}px ${FONT}`;
    const periodTextW = ctx.measureText(periodText).width;
    const pillW = periodTextW + 22;
    ctx.fillStyle = rgb(accent, 0.25);
    fillRoundRect(ctx, pad, headerY + 50, pillW, 28, 14);
    ctx.fillStyle = rgb(accent);
    ctx.fillText(periodText, pad + 11, headerY + 69);
    const providerLabel = getProviderLabel(providerType);
    if (providerLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${14}px ${FONT}`;
      ctx.fillText(providerLabel, pad + pillW + 12, headerY + 69);
    }
    headerY += 80;
    const artSize = 260;
    const artX = (w - artSize) / 2;
    const artY = headerY;
    if (stats.topTracks[0]) {
      const drew = await drawArt(ctx, stats.topTracks[0].albumArt, artX, artY, artSize, 16);
      if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 16);
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.shadowColor = rgb(accent, 0.4);
      ctx.shadowBlur = 50;
      ctx.fillStyle = "rgba(0,0,0,0)";
      fillRoundRect(ctx, artX, artY, artSize, artSize, 16);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${28}px ${FONT}`;
      ctx.fillText(truncateText(ctx, stats.topTracks[0].trackName, innerW - 40), w / 2, artY + artSize + 40);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${18}px ${FONT}`;
      ctx.fillText(truncateText(ctx, stats.topTracks[0].artistName, innerW - 40), w / 2, artY + artSize + 68);
      ctx.fillStyle = rgb(accent, 0.7);
      ctx.font = `600 ${14}px ${FONT}`;
      ctx.fillText("#1 Most Played", w / 2, artY + artSize + 92);
      ctx.textAlign = "left";
    } else {
      drawPlaceholderArt(ctx, artX, artY, artSize, 16);
    }
    let y = artY + artSize + 110;
    const gridGap = 10;
    const cardW = (innerW - gridGap * 2) / 3;
    const cardH = 68;
    drawStatCard(ctx, pad, y, cardW, cardH, formatDurationLong(stats.totalTimeMs), "LISTENED", accent, true);
    drawStatCard(ctx, pad + cardW + gridGap, y, cardW, cardH, `${stats.trackCount}`, "PLAYS", accent);
    drawStatCard(ctx, pad + (cardW + gridGap) * 2, y, cardW, cardH, `${stats.uniqueTrackCount}`, "UNIQUE", accent);
    const row2Y = y + cardH + gridGap;
    drawStatCard(ctx, pad, row2Y, cardW, cardH, `${stats.uniqueArtistCount}`, "ARTISTS", accent);
    drawStatCard(ctx, pad + cardW + gridGap, row2Y, cardW, cardH, stats.streakDays > 0 ? `${stats.streakDays}d` : "-", "STREAK", accent, stats.streakDays > 0);
    drawStatCard(ctx, pad + (cardW + gridGap) * 2, row2Y, cardW, cardH, `${Math.round(stats.skipRate * 100)}%`, "SKIP RATE", accent);
    y = row2Y + cardH + 32;
    const listArtSize = 56;
    const listRowH = 68;
    async function drawStoryList(items, startY, sectionTitle, maxItems) {
      drawAccentDivider(ctx, pad, startY, innerW, accent);
      startY += 16;
      startY = drawSectionHeader(ctx, sectionTitle, pad, startY, accent);
      const count = Math.min(maxItems, items.length);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      fillRoundRect(ctx, pad - 12, startY - 8, innerW + 24, listRowH * count + 16, 14);
      for (let i = 0; i < count; i++) {
        const item = items[i];
        const rowY = startY + i * listRowH;
        const artY2 = rowY + (listRowH - listArtSize) / 2;
        const radius = item.circular ? listArtSize / 2 : 8;
        const drew = await drawArt(ctx, item.art, pad, artY2, listArtSize, radius);
        if (!drew) drawPlaceholderArt(ctx, pad, artY2, listArtSize, radius);
        const textX = pad + listArtSize + 16;
        const centerY = rowY + listRowH / 2;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${15}px ${FONT}`;
        const rk = `${i + 1}`;
        ctx.fillText(rk, textX, centerY - 9);
        const rkW = ctx.measureText(rk).width + 8;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${16}px ${FONT}`;
        ctx.fillText(truncateText(ctx, item.name, rightEdge - textX - rkW - (item.plays ? 90 : 10)), textX + rkW, centerY - 9);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${13}px ${FONT}`;
        ctx.fillText(truncateText(ctx, item.sub, rightEdge - textX - rkW - (item.plays ? 90 : 10)), textX + rkW, centerY + 11);
        if (item.plays) {
          ctx.fillStyle = rgb(accent);
          ctx.font = `600 ${14}px ${FONT}`;
          ctx.textAlign = "right";
          ctx.fillText(`${item.plays} plays`, rightEdge, centerY + 1);
          ctx.textAlign = "left";
        }
      }
      return startY + listRowH * count + 28;
    }
    if (stats.topTracks.length > 0) {
      y = await drawStoryList(
        stats.topTracks.map((t) => ({ name: t.trackName, sub: t.artistName, art: t.albumArt, plays: t.playCount })),
        y,
        "Top Tracks",
        5
      );
    }
    if (stats.topArtists.length > 0) {
      y = await drawStoryList(
        stats.topArtists.map((a) => ({ name: a.artistName, sub: a.playCount ? `${a.playCount} plays` : "", art: a.artistImage, circular: true })),
        y,
        "Top Artists",
        5
      );
    }
    if (stats.topAlbums.length > 0) {
      y = await drawStoryList(
        stats.topAlbums.map((a) => ({ name: a.albumName, sub: a.artistName, art: a.albumArt, plays: a.playCount })),
        y,
        "Top Albums",
        5
      );
    }
    if (stats.hourlyDistribution.some((v) => v > 0)) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 16;
      ctx.fillStyle = rgb(accent);
      ctx.beginPath();
      ctx.arc(pad + 5, y + 12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${20}px ${FONT}`;
      ctx.fillText("Activity by Hour", pad + 18, y + 18);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${14}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`Peak: ${formatHourLabel(stats.peakHour)}`, rightEdge, y + 18);
      ctx.textAlign = "left";
      y += 40;
      drawHourlyChart(ctx, stats.hourlyDistribution, pad, y, innerW, 140, accent, stats.peakHour);
      y += 140 + 20;
    }
    if (stats.topGenres.length > 0) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 20;
      drawGenrePills(ctx, stats.topGenres, pad, y, innerW, accent);
      y += 44;
    }
    drawNoiseTexture(ctx, 0, 0, w, h, 0.02);
    const topBar = ctx.createLinearGradient(0, 0, w, 0);
    topBar.addColorStop(0, rgb(accent));
    topBar.addColorStop(1, rgb(accent, 0.3));
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = `${14}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Listening Stats for Spicetify", w / 2, h - 20);
    ctx.textAlign = "left";
    return canvas;
  }
  async function generateLandscapeCard(stats, period, providerType) {
    const w = LAND_W;
    const h = LAND_H;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    let accent = GREEN;
    let heroImg = null;
    if (stats.topTracks[0]?.albumArt) {
      heroImg = await loadImage(stats.topTracks[0].albumArt);
      if (heroImg) accent = extractDominantColor(heroImg);
    }
    if (heroImg) {
      drawBlurredBackground(ctx, heroImg, 0, 0, w, h, 60);
    }
    const baseOverlay = ctx.createLinearGradient(0, 0, 0, h);
    baseOverlay.addColorStop(0, "rgba(8,8,14,0.82)");
    baseOverlay.addColorStop(1, "rgba(8,8,14,0.92)");
    ctx.fillStyle = baseOverlay;
    ctx.fillRect(0, 0, w, h);
    const pad = 56;
    const innerW = w - pad * 2;
    const username = getUsername2(providerType);
    const leftW = 440;
    let heroY = pad;
    if (username) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `500 ${16}px ${FONT}`;
      ctx.fillText(`@${username}`, pad, heroY + 14);
      heroY += 32;
    }
    const title = username ? `${username}'s Stats` : "My Listening Stats";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${32}px ${FONT}`;
    ctx.fillText(truncateText(ctx, title, leftW - 20), pad, heroY + 28);
    const periodText = getPeriodDisplayName(period);
    ctx.font = `600 ${14}px ${FONT}`;
    const pTextW = ctx.measureText(periodText).width;
    const pPillW = pTextW + 20;
    ctx.fillStyle = rgb(accent, 0.25);
    fillRoundRect(ctx, pad, heroY + 40, pPillW, 26, 13);
    ctx.fillStyle = rgb(accent);
    ctx.fillText(periodText, pad + 10, heroY + 57);
    const providerLabel = getProviderLabel(providerType);
    if (providerLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${13}px ${FONT}`;
      ctx.fillText(providerLabel, pad + pPillW + 10, heroY + 57);
    }
    heroY += 80;
    const artSize = 220;
    const artX = pad;
    const artY = heroY;
    if (stats.topTracks[0]) {
      const drew = await drawArt(ctx, stats.topTracks[0].albumArt, artX, artY, artSize, 14);
      if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 14);
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.shadowColor = rgb(accent, 0.35);
      ctx.shadowBlur = 50;
      ctx.fillStyle = "rgba(0,0,0,0)";
      fillRoundRect(ctx, artX, artY, artSize, artSize, 14);
      ctx.restore();
      const infoX = artX + artSize + 24;
      const infoMaxW = leftW - artSize - 24;
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${22}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].trackName, infoMaxW),
        infoX,
        artY + 30
      );
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${16}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].artistName, infoMaxW),
        infoX,
        artY + 56
      );
      ctx.fillStyle = rgb(accent, 0.7);
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.fillText("#1 Most Played", infoX, artY + 78);
      if (stats.topTracks[0].playCount) {
        ctx.fillStyle = rgb(accent);
        ctx.font = `bold ${36}px ${FONT}`;
        ctx.fillText(`${stats.topTracks[0].playCount}`, infoX, artY + 130);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `500 ${13}px ${FONT}`;
        ctx.fillText("plays", infoX, artY + 150);
      }
    } else {
      drawPlaceholderArt(ctx, artX, artY, artSize, 14);
    }
    const statY = artY + artSize + 28;
    const statCardW = (leftW - 12) / 3;
    const statCardH = 60;
    drawStatCard(ctx, pad, statY, statCardW, statCardH, formatDuration(stats.totalTimeMs), "LISTENED", accent, true);
    drawStatCard(ctx, pad + statCardW + 6, statY, statCardW, statCardH, `${stats.trackCount}`, "PLAYS", accent);
    drawStatCard(ctx, pad + (statCardW + 6) * 2, statY, statCardW, statCardH, `${stats.uniqueArtistCount}`, "ARTISTS", accent);
    const stat2Y = statY + statCardH + 8;
    drawStatCard(ctx, pad, stat2Y, statCardW, statCardH, `${stats.uniqueTrackCount}`, "UNIQUE", accent);
    drawStatCard(ctx, pad + statCardW + 6, stat2Y, statCardW, statCardH, stats.streakDays > 0 ? `${stats.streakDays}d` : "-", "STREAK", accent, stats.streakDays > 0);
    drawStatCard(ctx, pad + (statCardW + 6) * 2, stat2Y, statCardW, statCardH, `${Math.round(stats.skipRate * 100)}%`, "SKIP RATE", accent);
    if (stats.topGenres.length > 0) {
      drawGenrePills(ctx, stats.topGenres, pad, stat2Y + statCardH + 16, leftW, accent);
    }
    const rX = pad + leftW + 40;
    const rInnerW = w - rX - pad;
    const colGap = 24;
    const colW = (rInnerW - colGap * 2) / 3;
    const listArtSize = 44;
    const listRowH = 56;
    const listHeaderH = 32;
    async function drawRankedList(items, colX, startY, title2, maxItems) {
      ctx.fillStyle = rgb(accent);
      ctx.beginPath();
      ctx.arc(colX + 5, startY + 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${16}px ${FONT}`;
      ctx.fillText(title2, colX + 18, startY + 14);
      let y = startY + listHeaderH;
      const count = Math.min(maxItems, items.length);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      fillRoundRect(ctx, colX - 10, y - 6, colW + 20, listRowH * count + 12, 12);
      for (let i = 0; i < count; i++) {
        const item = items[i];
        const rowY = y + i * listRowH;
        const artY2 = rowY + (listRowH - listArtSize) / 2;
        const radius = item.circular ? listArtSize / 2 : 6;
        const drew = await drawArt(ctx, item.art, colX, artY2, listArtSize, radius);
        if (!drew) drawPlaceholderArt(ctx, colX, artY2, listArtSize, radius);
        const textX = colX + listArtSize + 12;
        const centerY = rowY + listRowH / 2;
        const maxTextW = colX + colW - textX;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${13}px ${FONT}`;
        const rk = `${i + 1}`;
        ctx.fillText(rk, textX, centerY - 7);
        const rkW = ctx.measureText(rk).width + 6;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${13}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, item.name, maxTextW - rkW),
          textX + rkW,
          centerY - 7
        );
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `${11}px ${FONT}`;
        const subText = item.plays ? `${item.sub} \u2022 ${item.plays}` : item.sub;
        ctx.fillText(
          truncateText(ctx, subText, maxTextW - rkW),
          textX + rkW,
          centerY + 9
        );
      }
    }
    const listStartY = pad;
    const maxListItems = 5;
    await drawRankedList(
      stats.topTracks.map((t) => ({
        name: t.trackName,
        sub: t.artistName,
        art: t.albumArt,
        plays: t.playCount
      })),
      rX,
      listStartY,
      "Top Tracks",
      maxListItems
    );
    await drawRankedList(
      stats.topArtists.map((a) => ({
        name: a.artistName,
        sub: a.playCount ? `${a.playCount} plays` : "",
        art: a.artistImage,
        circular: true
      })),
      rX + colW + colGap,
      listStartY,
      "Top Artists",
      maxListItems
    );
    await drawRankedList(
      stats.topAlbums.map((a) => ({
        name: a.albumName,
        sub: a.artistName,
        art: a.albumArt,
        plays: a.playCount
      })),
      rX + (colW + colGap) * 2,
      listStartY,
      "Top Albums",
      maxListItems
    );
    const chartY = listStartY + listHeaderH + listRowH * maxListItems + 36;
    if (stats.hourlyDistribution.some((v) => v > 0)) {
      ctx.fillStyle = rgb(accent);
      ctx.beginPath();
      ctx.arc(rX + 5, chartY + 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${16}px ${FONT}`;
      ctx.fillText("Activity by Hour", rX + 18, chartY + 14);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${13}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(`Peak: ${formatHourLabel(stats.peakHour)}`, rX + rInnerW, chartY + 14);
      ctx.textAlign = "left";
      const chartTopY = chartY + 28;
      const chartH = h - chartTopY - 40;
      if (chartH > 40) {
        drawHourlyChart(ctx, stats.hourlyDistribution, rX, chartTopY, rInnerW, chartH, accent, stats.peakHour);
      }
    }
    drawNoiseTexture(ctx, 0, 0, w, h, 0.018);
    const topBar = ctx.createLinearGradient(0, 0, w, 0);
    topBar.addColorStop(0, rgb(accent));
    topBar.addColorStop(1, rgb(accent, 0.3));
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = `${13}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Listening Stats for Spicetify", w / 2, h - 14);
    ctx.textAlign = "left";
    return canvas;
  }
  async function generateShareCard(options) {
    const { stats, period, format, providerType } = options;
    const canvas = format === "story" ? await generateStoryCard(stats, period, providerType) : await generateLandscapeCard(stats, period, providerType);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }
  async function shareOrDownload(blob) {
    if (navigator.share) {
      try {
        const file = new File([blob], "listening-stats.png", {
          type: "image/png"
        });
        await navigator.share({ files: [file] });
        return "shared";
      } catch {
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "listening-stats.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  // src/app/components/ShareCardModal.tsx
  var { useState: useState9, useRef: useRef6, useEffect: useEffect7 } = Spicetify.React;
  function ShareCardModal({
    stats,
    period,
    providerType,
    onClose
  }) {
    const [format, setFormat] = useState9("story");
    const [generating, setGenerating] = useState9(false);
    const [previewUrl, setPreviewUrl] = useState9(null);
    const blobRef = useRef6(null);
    useEffect7(() => {
      generatePreview();
    }, [format]);
    async function generatePreview() {
      setGenerating(true);
      try {
        const blob = await generateShareCard({
          stats,
          period,
          format,
          providerType
        });
        blobRef.current = blob;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error("[ListeningStats] Failed to generate share card:", e);
      }
      setGenerating(false);
    }
    async function handleShare() {
      if (!blobRef.current) return;
      const result = await shareOrDownload(blobRef.current);
      if (result === "copied") {
        Spicetify.showNotification("Image copied to clipboard!");
      } else if (result === "downloaded") {
        Spicetify.showNotification("Image downloaded!");
      }
      onClose();
    }
    async function handleDownload() {
      if (!blobRef.current) return;
      const url = URL.createObjectURL(blobRef.current);
      const a = document.createElement("a");
      a.href = url;
      a.download = "listening-stats.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Spicetify.showNotification("Image downloaded!");
    }
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "share-modal-overlay",
        onClick: (e) => {
          if (e.target.classList.contains("share-modal-overlay"))
            onClose();
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-modal" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-modal-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Share Your Stats"), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "settings-close-btn",
          onClick: onClose,
          dangerouslySetInnerHTML: { __html: Icons.close || "&times;" }
        }
      )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-format-toggle" }, /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: `share-format-btn ${format === "story" ? "active" : ""}`,
          onClick: () => setFormat("story")
        },
        "Story (9:16)"
      ), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: `share-format-btn ${format === "landscape" ? "active" : ""}`,
          onClick: () => setFormat("landscape")
        },
        "Landscape (16:9)"
      )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-preview" }, generating ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-generating" }, "Generating...") : previewUrl ? /* @__PURE__ */ Spicetify.React.createElement(
        "img",
        {
          src: previewUrl,
          className: "share-preview-img",
          alt: "Share card preview"
        }
      ) : null), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn primary",
          onClick: handleShare,
          disabled: generating
        },
        "Share / Copy"
      ), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn",
          onClick: handleDownload,
          disabled: generating
        },
        "Download"
      )))
    );
  }

  // src/app/hooks/useSectionOrder.ts
  var { useState: useState10, useCallback: useCallback3, useEffect: useEffect8 } = Spicetify.React;
  var LAYOUT_KEY = "listening-stats:card-order";
  var DEFAULT_ORDER = [
    "overview",
    "toplists",
    "genres",
    "activity",
    "recent"
  ];
  function useSectionOrder() {
    const [order, setOrder] = useState10(() => {
      try {
        const stored = localStorage.getItem(LAYOUT_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const validated = parsed.filter((id) => DEFAULT_ORDER.includes(id));
            for (const id of DEFAULT_ORDER) {
              if (!validated.includes(id)) {
                validated.push(id);
              }
            }
            return validated;
          }
        }
      } catch {
      }
      return [...DEFAULT_ORDER];
    });
    const reorder = useCallback3((newOrder) => {
      setOrder(newOrder);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(newOrder));
      } catch {
      }
    }, []);
    const resetOrder = useCallback3(() => {
      const defaultCopy = [...DEFAULT_ORDER];
      setOrder(defaultCopy);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(defaultCopy));
      } catch {
      }
    }, []);
    useEffect8(() => {
      const handler = () => resetOrder();
      window.addEventListener("listening-stats:reset-layout", handler);
      return () => {
        window.removeEventListener("listening-stats:reset-layout", handler);
      };
    }, [resetOrder]);
    return { order, reorder, resetOrder };
  }

  // src/app/hooks/useTour.ts
  var { useState: useState11, useCallback: useCallback4, useRef: useRef7, createContext, useContext } = Spicetify.React;
  var TourContext = createContext(null);
  function TourProvider({ children }) {
    const [isActive, setIsActive] = useState11(false);
    const [currentStep, setCurrentStep] = useState11(0);
    const [steps, setSteps] = useState11([]);
    const abortRef = useRef7({ cancelled: false });
    const endTour = useCallback4(() => {
      abortRef.current.cancelled = true;
      setIsActive(false);
      setCurrentStep(0);
      setSteps([]);
    }, []);
    const startTour = useCallback4((tourSteps) => {
      abortRef.current = { cancelled: false };
      setSteps(tourSteps);
      setCurrentStep(0);
      setIsActive(true);
    }, []);
    const nextStep = useCallback4(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          abortRef.current.cancelled = true;
          setTimeout(endTour, 0);
          return prev;
        }
        return prev + 1;
      });
    }, [steps.length, endTour]);
    const prevStep = useCallback4(() => {
      setCurrentStep((prev) => Math.max(0, prev - 1));
    }, []);
    const value = {
      isActive,
      currentStep,
      steps,
      totalSteps: steps.length,
      startTour,
      nextStep,
      prevStep,
      endTour
    };
    const overlay = isActive && steps.length > 0 ? Spicetify.ReactDOM.createPortal(
      Spicetify.React.createElement(TourOverlay, {
        step: steps[currentStep],
        stepIndex: currentStep,
        totalSteps: steps.length,
        onNext: nextStep,
        onPrev: prevStep,
        onEnd: endTour,
        abortSignal: abortRef
      }),
      document.body
    ) : null;
    return Spicetify.React.createElement(
      TourContext.Provider,
      { value },
      children,
      overlay
    );
  }
  function useTour() {
    const ctx = useContext(TourContext);
    if (!ctx) throw new Error("useTour must be used within TourProvider");
    return ctx;
  }

  // src/app/styles.css
  var styles_default = `/* Listening Stats - Main Styles */

/* ===== Accent Color Variables ===== */
.stats-page,
.settings-overlay,
.share-modal-overlay,
.update-banner-container {
  --ls-accent: #1db954;
  --ls-accent-hover: #1ed760;
  --ls-accent-rgb: 29, 185, 84;
}

/* ===== Sidebar Icon ===== */
[href="/listening-stats"] svg {
  fill: currentColor !important;
  color: var(--text-subdued) !important;
}
[href="/listening-stats"]:hover svg,
[href="/listening-stats"][aria-current="page"] svg {
  color: var(--text-base) !important;
}

/* ===== Page Layout ===== */
.stats-page {
  padding: 32px 48px;
  padding-top: 72px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ===== Header ===== */
.stats-header {
  margin-bottom: 24px;
}

.stats-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.stats-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 4px 0;
  letter-spacing: -0.5px;
}

.stats-subtitle {
  font-size: 14px;
  color: var(--text-subdued);
  margin: 0;
}

.stats-announcement {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-subdued);
  margin-top: 8px;
}

.stats-announcement strong {
  color: var(--text-base, #fff);
}

.stats-announcement a {
  color: var(--text-subdued);
  text-decoration: underline;
}

.stats-announcement a:hover {
  color: var(--text-base, #fff);
}

.stats-announcement p {
  margin: 0 0 2px 0;
}

.stats-announcement p:last-child {
  margin-bottom: 0;
}

/* Header Actions */
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-btn {
  background: var(--background-tinted-base);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-subdued);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.header-btn:hover {
  background: var(--background-tinted-highlight);
  color: var(--text-base);
}

.header-btn svg {
  width: 18px;
  height: 18px;
  pointer-events: none;
}

/* ===== Period Tabs (inside hero card) ===== */
.period-tabs {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 4px;
  margin-top: 16px;
  gap: 2px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.period-tabs::-webkit-scrollbar {
  display: none;
}

.period-tab {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.period-tab:hover {
  color: rgba(0, 0, 0, 0.8);
  background: rgba(0, 0, 0, 0.1);
}

.period-tab.active {
  background: rgba(0, 0, 0, 0.2);
  color: #000;
}

/* ===== Overview Cards Row ===== */
.overview-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-bottom: 32px;
}

.overview-card-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  overflow: visible;
}

.overview-card {
  background: var(--background-tinted-base);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.overview-card.hero {
  background: linear-gradient(135deg, var(--spice-text) 0%, #1db954 100%);
  color: #000;
}

.overview-card.hero .overview-value {
  font-size: 3rem;
}

.overview-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
}

.overview-card.hero .overview-value {
  font-size: 2.5rem;
}

.overview-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.overview-label-tooltip {
  font-size: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.overview-card.hero .overview-label {
  opacity: 0.85;
}

.overview-secondary {
  display: flex;
  gap: 24px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  overflow: visible;
}

.overview-stat {
  display: flex;
  flex-direction: column;
}

.overview-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.overview-stat-label {
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.6;
}

/* Colored stats */
.overview-card .stat-colored {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  margin-bottom: auto;
}

.stat-text .overview-value {
  font-size: 1.5rem;
}

.stat-text .overview-value.green {
  color: #1db954;
}
.stat-text .overview-value.orange {
  color: #f39c12;
}
.stat-text .overview-value.purple {
  color: #9b59b6;
}
.stat-text .overview-value.red {
  color: #e74c3c;
}

/* ===== Top Lists Section ===== */
.top-lists-section {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 32px;
}

.top-list {
  background: var(--background-tinted-base);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  flex: 1 1 300px;
  min-width: 280px;
  overflow: visible;
}

.top-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.top-list-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-list-title svg {
  width: 20px;
  height: 20px;
  color: var(--text-subdued);
}

/* ===== Item List ===== */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin: 0 -12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  overflow: visible;
}

.item-row:hover {
  background: rgba(255, 255, 255, 0.07);
}

.item-rank {
  width: 24px;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  flex-shrink: 0;
  color: var(--text-subdued);
}

.item-rank.gold {
  color: #f1c40f;
  text-shadow: 0 0 10px rgba(241, 196, 15, 0.3);
}
.item-rank.silver {
  color: #bdc3c7;
}
.item-rank.bronze {
  color: #cd6133;
}

.item-art {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--background-elevated-base);
  flex-shrink: 0;
}

.item-art.round {
  border-radius: 50%;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.item-meta {
  font-size: 12px;
  color: var(--text-subdued);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.item-plays {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-base);
}

.item-time {
  font-size: 11px;
  color: var(--text-subdued);
}

/* Heart button */
.heart-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--text-subdued);
  display: flex;
  align-items: center;
  border-radius: 50%;
  transition: all 0.15s ease;
  flex-shrink: 0;
  min-width: 30px;
  min-height: 30px;
}

.heart-btn.disabled {
  opacity: 0.25;
  cursor: default;
}

.heart-btn:hover {
  color: var(--text-base);
  background: rgba(255, 255, 255, 0.1);
}

.heart-btn.disabled:hover {
  color: var(--text-subdued);
  background: none;
}

.heart-btn.liked {
  color: var(--ls-accent);
}

.heart-btn svg {
  width: 18px;
  height: 18px;
}

/* ===== Activity Chart Section ===== */
.activity-section {
  background: var(--background-tinted-base);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.activity-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.activity-peak {
  font-size: 13px;
  color: var(--text-subdued);
}

.activity-peak strong {
  color: var(--ls-accent);
}

.activity-chart {
  height: 80px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
}

.activity-bar {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px 3px 0 0;
  min-height: 4px;
  transition: background 0.15s ease;
  cursor: pointer;
  position: relative;
  animation: barGrow 0.5s ease both;
  transform-origin: bottom;
}

@keyframes barGrow {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

.activity-bar.peak {
  background: var(--ls-accent);
}

.activity-bar:hover {
  background: var(--ls-accent);
}


.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-subdued);
  margin-top: 10px;
  padding: 0 2px;
}

/* ===== Recently Played ===== */
.recent-section {
  background: var(--background-tinted-base);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
}

.recent-header {
  margin-bottom: 20px;
}

.recent-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.recent-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin: 0 -24px;
  padding: 0 24px;
  scrollbar-width: thin;
  scrollbar-color: var(--background-tinted-highlight) transparent;
}

.recent-scroll::-webkit-scrollbar {
  height: 6px;
}

.recent-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.recent-scroll::-webkit-scrollbar-thumb {
  background: var(--background-tinted-highlight);
  border-radius: 3px;
}

.recent-card {
  flex-shrink: 0;
  width: 140px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.recent-card:hover {
  transform: translateY(-4px);
}

.recent-card:hover .recent-art {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.recent-art {
  width: 140px;
  height: 140px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--background-elevated-base);
  margin-bottom: 10px;
  transition: box-shadow 0.15s ease;
}

.recent-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.recent-meta {
  font-size: 12px;
  color: var(--text-subdued);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-time {
  font-size: 11px;
  color: var(--text-subdued);
  opacity: 0.7;
  margin-top: 2px;
}

/* ===== Last.fm Banner ===== */
.lastfm-banner {
  border-radius: 12px;
  margin-bottom: 24px;
  overflow: hidden;
}

.lastfm-banner.prompt {
  background: var(--background-tinted-base);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.lastfm-banner.form {
  background: var(--background-tinted-base);
  padding: 24px;
}

.lastfm-banner.connected {
  background: rgba(var(--ls-accent-rgb), 0.08);
  border: 1px solid rgba(var(--ls-accent-rgb), 0.15);
}

.lastfm-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  gap: 16px;
}

.lastfm-banner.connected .lastfm-banner-content {
  padding: 14px 20px;
}

.lastfm-banner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.lastfm-banner-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.lastfm-banner-desc {
  font-size: 13px;
  color: var(--text-subdued);
  margin: 0 0 16px 0;
}

.lastfm-prompt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lastfm-prompt-text strong {
  font-size: 14px;
}

.lastfm-prompt-text span {
  font-size: 12px;
  color: var(--text-subdued);
}

.lastfm-prompt-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.lastfm-connected-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lastfm-connected-user {
  font-size: 13px;
}

.lastfm-connected-scrobbles {
  font-size: 12px;
  color: var(--text-subdued);
}

.lastfm-status-icon {
  display: flex;
  align-items: center;
  color: var(--ls-accent);
}

.lastfm-status-icon svg {
  width: 18px;
  height: 18px;
}

.lastfm-close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-subdued);
  display: flex;
  align-items: center;
  border-radius: 50%;
  transition: all 0.15s ease;
}

.lastfm-close-btn:hover {
  color: var(--text-base);
  background: rgba(255, 255, 255, 0.1);
}

.lastfm-close-btn svg {
  width: 16px;
  height: 16px;
}

.lastfm-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lastfm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lastfm-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subdued);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lastfm-input {
  background: var(--background-elevated-base);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-base);
  outline: none;
  transition: border-color 0.15s ease;
}

.lastfm-input:focus {
  border-color: var(--ls-accent);
}

.lastfm-input:disabled {
  opacity: 0.5;
}

.lastfm-input::placeholder {
  color: var(--text-subdued);
  opacity: 0.5;
}

.lastfm-help-link {
  font-size: 11px;
  color: var(--ls-accent);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 500;
}

.lastfm-help-link:hover {
  text-decoration: underline;
}

.lastfm-help-link svg {
  width: 11px;
  height: 11px;
}

.lastfm-help-link.standalone {
  margin-top: 4px;
}

.lastfm-error {
  font-size: 12px;
  color: #e74c3c;
  padding: 8px 12px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 6px;
}

.lastfm-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.lastfm-btn.primary {
  background: var(--ls-accent);
  color: #000;
}

.lastfm-btn.primary:hover {
  background: var(--ls-accent-hover);
}

.lastfm-btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.lastfm-btn.secondary {
  background: transparent;
  color: var(--text-subdued);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.lastfm-btn.secondary:hover {
  color: var(--text-base);
  border-color: rgba(255, 255, 255, 0.3);
}

/* ===== Error State ===== */
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.error-message {
  text-align: center;
  max-width: 400px;
}

.error-message h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.error-message p {
  font-size: 14px;
  color: var(--text-subdued);
  margin: 0 0 20px 0;
}

/* ===== Loading Skeleton ===== */
@keyframes skeleton-pulse {
  0% {
    opacity: 0.06;
  }
  50% {
    opacity: 0.12;
  }
  100% {
    opacity: 0.06;
  }
}

.skeleton-header {
  margin-bottom: 24px;
}

.skeleton-line {
  background: var(--text-base);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-title-line {
  width: 240px;
  height: 36px;
  margin-bottom: 8px;
}

.skeleton-subtitle-line {
  width: 180px;
  height: 16px;
}

.skeleton-card {
  background: var(--text-base);
  border-radius: 12px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  min-height: 100px;
}

.skeleton-hero {
  min-height: 200px;
}

.skeleton-list {
  background: var(--background-tinted-base);
  border-radius: 16px;
  padding: 24px;
  flex: 1 1 300px;
  min-width: 280px;
}

.skeleton-list-title {
  width: 120px;
  height: 20px;
  margin-bottom: 20px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.skeleton-circle {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: var(--text-base);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.skeleton-item-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-item-lines .skeleton-line {
  height: 14px;
  width: 80%;
}

.skeleton-item-lines .skeleton-line.skeleton-short {
  width: 50%;
  height: 12px;
}

/* ===== Settings Overlay ===== */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

/* ===== Settings Panel ===== */
.settings-panel {
  padding: 24px;
  background: var(--background-elevated-base);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.settings-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.settings-close-btn {
  background: none;
  border: none;
  color: var(--text-subdued);
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;
}

.settings-close-btn:hover {
  color: var(--text-base);
  background: rgba(255, 255, 255, 0.1);
}

.settings-close-btn svg {
  width: 20px;
  height: 20px;
}

.settings-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.settings-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.settings-lastfm {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-lastfm-connected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-lastfm-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.settings-lastfm-info svg {
  width: 16px;
  height: 16px;
  color: var(--ls-accent);
}

.settings-lastfm-desc {
  font-size: 12px;
  color: var(--text-subdued);
  margin: 0 0 12px 0;
}

.settings-lastfm-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.api-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 11px;
  color: var(--text-subdued);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.green {
  background: #1db954;
}
.status-dot.red {
  background: #e74c3c;
}

/* ===== Drag and Drop ===== */
.draggable-section {
  position: relative;
  transition: opacity 0.2s ease;
}

.draggable-section.is-dragging {
  opacity: 0.4;
}

.section-drag-handle {
  display: flex;
  align-items: center;
  cursor: grab;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  position: absolute;
  top: 12px;
  left: -32px;
  z-index: 1;
}

.draggable-section:hover .section-drag-handle {
  opacity: 0.5;
}

.section-drag-handle:hover {
  opacity: 1 !important;
  background: var(--background-tinted-highlight);
}

.section-drag-handle:active {
  cursor: grabbing;
}

.drag-grip-icon {
  width: 16px;
  height: 16px;
  color: var(--text-subdued);
}

.drop-indicator {
  height: 3px;
  background: var(--ls-accent, #1db954);
  border-radius: 2px;
  margin: 4px 0;
  pointer-events: none;
  animation: drop-indicator-pulse 1s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(29, 185, 84, 0.5);
}

@keyframes drop-indicator-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

/* Force drag handle visible during tour step 5 */
.section-drag-handle.tour-highlight-handle {
  opacity: 1 !important;
}

.stats-page--compact .section-drag-handle {
  top: 8px;
  left: -28px;
}

/* ===== Footer ===== */
.stats-footer {
  padding-top: 20px;
  border-top: 1px solid var(--background-tinted-highlight);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-toggle {
  background: none;
  border: none;
  color: var(--text-subdued);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.settings-toggle:hover {
  background: var(--background-tinted-base);
  color: var(--text-base);
}

.settings-toggle svg {
  width: 14px;
  height: 14px;
}

.footer-btn {
  padding: 8px 14px;
  background: var(--background-tinted-base);
  border: none;
  border-radius: 6px;
  color: var(--text-subdued);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.footer-btn:hover {
  background: var(--background-tinted-highlight);
  color: var(--text-base);
}

.footer-btn.primary {
  background: var(--ls-accent);
  color: #000;
}

.footer-btn.primary:hover {
  background: var(--ls-accent-hover);
}

.footer-btn.danger:hover {
  background: #e74c3c;
  color: #fff;
}

.version-text {
  font-size: 11px;
  color: var(--text-subdued);
}

/* ===== Loading ===== */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: var(--text-subdued);
  font-size: 15px;
}

/* ===== Update Banner ===== */
.update-banner-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}

.update-banner {
  background: var(--background-elevated-base, #282828);
  padding: 32px;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  color: var(--text-base, #fff);
}

.update-banner-header {
  text-align: center;
  margin-bottom: 20px;
}

.update-banner-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

.update-banner-title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 6px;
  letter-spacing: -0.5px;
}

.update-banner-version {
  font-size: 15px;
  color: var(--text-subdued, #a7a7a7);
  font-weight: 500;
}

.update-banner-changelog {
  background: var(--background-tinted-base, #1a1a1a);
  border-radius: 12px;
  padding: 16px;
  font-size: 13px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 24px;
  line-height: 1.6;
  color: var(--text-subdued, #b3b3b3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.update-banner-changelog::-webkit-scrollbar {
  width: 6px;
}

.update-banner-changelog::-webkit-scrollbar-track {
  background: transparent;
}

.update-banner-changelog::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.update-banner-changelog h4,
.update-banner-changelog h5 {
  color: var(--text-base, #fff);
  margin: 12px 0 6px 0;
  font-size: 14px;
  font-weight: 600;
}

.update-banner-changelog h4:first-child,
.update-banner-changelog h5:first-child {
  margin-top: 0;
}

.update-banner-changelog h5 {
  font-size: 13px;
}

.update-banner-changelog ul {
  margin: 4px 0 8px 0;
  padding-left: 20px;
  list-style: disc;
}

.update-banner-changelog li {
  margin-bottom: 2px;
  line-height: 1.5;
}

.update-banner-changelog code {
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.update-banner-changelog a {
  color: var(--text-bright-accent, #1db954);
  text-decoration: none;
}

.update-banner-changelog a:hover {
  text-decoration: underline;
}

.update-banner-changelog strong {
  color: var(--text-base, #fff);
  font-weight: 600;
}

.update-banner-changelog p {
  margin: 0 0 8px 0;
}

.update-banner-changelog p:last-child {
  margin-bottom: 0;
}

.update-banner-links {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 8px;
}

.update-banner-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 0;
}

.update-banner-btn {
  flex: 1;
  padding: 14px 24px;
  border-radius: 500px;
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.update-banner-btn.primary {
  background: var(--ls-accent);
  color: #000;
}

.update-banner-btn.primary:hover {
  background: var(--ls-accent-hover);
  transform: scale(1.02);
}

.update-banner-btn.primary.copied {
  background: var(--ls-accent);
}

.update-banner-btn.secondary {
  background: transparent;
  color: var(--text-base, #fff);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.update-banner-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
}

.updating-text {
  margin-top: 16px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-base);
  text-align: center;
  font-weight: 500;
}

/* Disabled button state */
.footer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Placeholder Art ===== */
.item-art.placeholder,
.recent-art.placeholder {
  position: relative;
  background: var(--background-elevated-highlight, #333);
}

.item-art.placeholder::after,
.recent-art.placeholder::after {
  content: "";
  position: absolute;
  inset: 30%;
  opacity: 0.25;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E")
    center/contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E")
    center/contain no-repeat;
}

.item-art.artist-placeholder::after {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E");
}

/* ===== Non-clickable items ===== */
.item-row.no-click {
  cursor: default;
}

.item-row.no-click:hover {
  background: transparent;
}

.recent-card.no-click {
  cursor: default;
}

.recent-card.no-click:hover {
  transform: none;
}

/* ===== Responsive ===== */
@media (max-width: 1200px) {
  .overview-row {
    grid-template-columns: 1fr 1fr;
  }

  .overview-card-list {
    grid-column: span 1;
  }
}

@media (max-width: 1000px) {
  .overview-row {
    grid-template-columns: 1fr;
  }

  .overview-card-list {
    grid-template-columns: 1fr 1fr;
    grid-column: span 1;
  }
}

@media (max-width: 700px) {
  .stats-page {
    padding: 24px;
  }

  .top-list {
    min-height: auto;
    flex: 1 1 100%;
  }

  .overview-row {
    grid-template-columns: 1fr;
  }

  .overview-card-list {
    grid-template-columns: 1fr 1fr;
    grid-column: span 1;
  }

  .overview-card.hero .overview-value {
    font-size: 2.5rem;
  }

  .overview-secondary {
    flex-wrap: wrap;
  }

  .period-tab {
    padding: 6px 12px;
    font-size: 12px;
  }

  .recent-card {
    width: 120px;
  }

  .recent-art {
    width: 120px;
    height: 120px;
  }

  .lastfm-banner-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .lastfm-prompt-actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 500px) {
  .overview-card-list {
    grid-template-columns: 1fr;
  }
}

/* ===== Setup Screen ===== */
.setup-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  min-height: 60vh;
}

.setup-header {
  text-align: center;
  margin-bottom: 40px;
}

.setup-title {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-base);
  margin: 0 0 8px;
}

.setup-subtitle {
  font-size: 16px;
  color: var(--text-subdued);
  margin: 0;
}

.setup-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 900px;
  width: 100%;
}

.setup-card {
  background: var(--background-elevated-base);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 1px solid transparent;
  transition:
    border-color 0.2s,
    transform 0.2s;
}

.setup-card:hover {
  border-color: var(--text-subdued);
  transform: translateY(-2px);
}

.setup-card.primary {
  border-color: rgba(var(--ls-accent-rgb), 0.3);
  margin-bottom: 16px;
}

.setup-card.primary:hover {
  border-color: rgba(var(--ls-accent-rgb), 0.6);
}

.setup-card-icon {
  width: 48px;
  height: 48px;
  color: var(--spice-button);
  margin-bottom: 16px;
}

.setup-card-icon svg {
  width: 100%;
  height: 100%;
}

.setup-card h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-base);
  margin: 0 0 8px;
}

.setup-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-bright-accent, #1ed760);
  background: rgba(30, 215, 96, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
  vertical-align: middle;
}

.setup-card-desc {
  font-size: 13px;
  color: var(--text-subdued);
  margin: 0 0 12px;
  line-height: 1.4;
}

.setup-card-pros {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  width: 100%;
  text-align: left;
}

.setup-card-pros li {
  font-size: 12px;
  color: var(--text-positive);
  padding: 2px 0;
}

.setup-card-pros li::before {
  content: "+  ";
  font-weight: 600;
}

.setup-card-con {
  font-size: 12px;
  color: var(--text-subdued);
  margin: 0 0 16px;
  opacity: 0.7;
}

.setup-card-con::before {
  content: "-  ";
  font-weight: 600;
}

.setup-main {
  max-width: 460px;
  width: 100%;
}

.setup-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  color: var(--text-subdued);
  font-size: 13px;
}

.setup-divider::before,
.setup-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.setup-alt-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--background-elevated-base);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  color: var(--text-base);
  transition:
    border-color 0.2s,
    background 0.2s;
}

.setup-alt-option:hover {
  border-color: var(--text-subdued);
  background: var(--background-elevated-highlight);
}

.setup-alt-option svg {
  width: 24px;
  height: 24px;
  color: var(--text-subdued);
  flex-shrink: 0;
}

.setup-alt-option strong {
  display: block;
  font-size: 14px;
  margin-bottom: 2px;
}

.setup-alt-option span {
  font-size: 12px;
  color: var(--text-subdued);
}

.setup-links {
  display: flex;
  gap: 16px;
  margin-top: 4px;
}

.setup-lastfm-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-bottom: 12px;
}

.setup-lastfm-form.compact {
  margin-top: 8px;
}

/* ===== Provider Badge ===== */
.provider-badge {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-subdued);
  opacity: 0.7;
}

/* ===== Provider Settings ===== */
.settings-provider {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--background-elevated-highlight);
}

.settings-provider-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: var(--text-base);
}

.settings-provider-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.provider-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  background: var(--background-elevated-highlight);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: var(--text-base);
  transition: border-color 0.2s;
}

.provider-option:hover {
  border-color: var(--text-subdued);
}

.provider-option.active {
  border-color: var(--spice-button);
}

.provider-option strong {
  font-size: 14px;
}

.provider-option span {
  font-size: 12px;
  color: var(--text-subdued);
}

.provider-option.lastfm-setup {
  cursor: default;
}

@media (max-width: 768px) {
  .setup-cards {
    grid-template-columns: 1fr;
    max-width: 400px;
  }

  .setup-screen {
    padding: 24px 16px;
  }
}

/* --- Section title (shared) --- */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-base);
  margin: 0 0 16px;
}

/* --- Export buttons in settings --- */
.settings-export {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-export .settings-section-title {
  margin-bottom: 8px;
}

.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.share-modal {
  background: var(--background-elevated-base, #282828);
  border-radius: 16px;
  padding: 24px;
  max-width: 720px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.share-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.share-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-base);
}

.share-format-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.share-format-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--background-tinted-highlight, #333);
  border-radius: 8px;
  background: transparent;
  color: var(--text-subdued);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.share-format-btn.active {
  border-color: var(--ls-accent);
  color: var(--ls-accent);
  background: rgba(var(--ls-accent-rgb), 0.1);
}

.share-preview {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.share-preview-img {
  width: 100%;
  height: auto;
  display: block;
}

.share-generating {
  color: var(--text-subdued);
  font-size: 14px;
  padding: 40px;
}

.share-actions {
  display: flex;
  gap: 8px;
}

.share-actions .footer-btn {
  flex: 1;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.item-row {
  animation: fadeInUp 0.3s ease both;
}
.item-row:nth-child(1) {
  animation-delay: 0.03s;
}
.item-row:nth-child(2) {
  animation-delay: 0.06s;
}
.item-row:nth-child(3) {
  animation-delay: 0.09s;
}
.item-row:nth-child(4) {
  animation-delay: 0.12s;
}
.item-row:nth-child(5) {
  animation-delay: 0.15s;
}
.item-row:nth-child(6) {
  animation-delay: 0.18s;
}
.item-row:nth-child(7) {
  animation-delay: 0.21s;
}
.item-row:nth-child(8) {
  animation-delay: 0.24s;
}
.item-row:nth-child(9) {
  animation-delay: 0.27s;
}
.item-row:nth-child(10) {
  animation-delay: 0.3s;
}

.recent-card {
  animation: fadeInUp 0.3s ease both;
}
.recent-card:nth-child(1) {
  animation-delay: 0.02s;
}
.recent-card:nth-child(2) {
  animation-delay: 0.04s;
}
.recent-card:nth-child(3) {
  animation-delay: 0.06s;
}
.recent-card:nth-child(4) {
  animation-delay: 0.08s;
}
.recent-card:nth-child(5) {
  animation-delay: 0.1s;
}
.recent-card:nth-child(6) {
  animation-delay: 0.12s;
}

/* ===== Settings Toggle ===== */
.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.settings-toggle-info {
  flex: 1;
}

.settings-toggle-desc {
  font-size: 12px;
  color: var(--text-subdued);
  margin: 4px 0 0;
  line-height: 1.4;
}

.settings-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.2s;
}

.settings-toggle.active {
  background: var(--ls-accent, #1db954);
}

.settings-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}

.settings-toggle.active .settings-toggle-knob {
  transform: translateX(20px);
}

/* ===== Items Per Section Picker ===== */
.settings-item-count-picker {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.settings-count-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: var(--text-subdued);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.settings-count-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-base);
}

.settings-count-btn.active {
  background: var(--ls-accent, #1db954);
  color: #fff;
  border-color: transparent;
}

/* ===== Section Visibility ===== */
.settings-section-vis {
  margin-bottom: 16px;
}

.settings-section-vis .settings-toggle-desc {
  margin-bottom: 12px;
}

.settings-toggle-row.compact {
  margin-bottom: 8px;
  gap: 12px;
}

.settings-vis-label {
  font-size: 13px;
  color: var(--text-base);
}

/* ===== Genre Chips ===== */
/* ===== Genre Bars ===== */
.genre-bars-section {
  background: var(--background-tinted-base);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
}

.genre-bars-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}

.genre-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.genre-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: fadeInUp 0.3s ease both;
}

.genre-bar-row:nth-child(1) { animation-delay: 0.03s; }
.genre-bar-row:nth-child(2) { animation-delay: 0.06s; }
.genre-bar-row:nth-child(3) { animation-delay: 0.09s; }
.genre-bar-row:nth-child(4) { animation-delay: 0.12s; }
.genre-bar-row:nth-child(5) { animation-delay: 0.15s; }
.genre-bar-row:nth-child(6) { animation-delay: 0.18s; }
.genre-bar-row:nth-child(7) { animation-delay: 0.21s; }
.genre-bar-row:nth-child(8) { animation-delay: 0.24s; }
.genre-bar-row:nth-child(9) { animation-delay: 0.27s; }
.genre-bar-row:nth-child(10) { animation-delay: 0.3s; }

.genre-bar-rank {
  width: 18px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subdued);
  flex-shrink: 0;
}

.genre-bar-track {
  flex: 1;
  position: relative;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.genre-bar-fill {
  position: absolute;
  inset: 0;
  right: auto;
  border-radius: 6px;
  background: var(--ls-accent, var(--spice-button));
  opacity: 0.25;
  animation: barFillGrow 0.6s ease both;
  transform-origin: left;
}

@keyframes barFillGrow {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.genre-bar-name {
  position: relative;
  z-index: 1;
  line-height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-base);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.genre-bar-count {
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-subdued);
}

/* ===== Settings Danger Zone ===== */
.settings-danger-zone {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 80, 80, 0.15);
}

.settings-danger-desc {
  font-size: 12px;
  color: var(--text-subdued);
  margin: 0 0 12px 0;
  line-height: 1.4;
}

/* ===== stats.fm Promo Popup ===== */
.sfm-promo-popup {
  background: var(--background-elevated-base);
  border-radius: 16px;
  padding: 28px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  animation: fadeInUp 0.25s ease;
}

.sfm-promo-popup h3 {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 10px 0;
}

.sfm-promo-popup p {
  font-size: 13px;
  color: var(--text-subdued);
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.sfm-promo-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

/* ===== Hover Tooltips for Stat Cards (DISP-03) ===== */
.stat-tooltip-portal {
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 400;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
}

/* ===== Collapsible Settings Categories (SETT-01) ===== */
.settings-category {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-category:last-child {
  border-bottom: none;
}

.settings-category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 14px 0;
  background: none;
  border: none;
  color: var(--text-base);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.settings-category-header:hover {
  color: var(--text-bright-accent, #fff);
}

.settings-chevron {
  margin-left: auto;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--text-subdued);
  transition: transform 0.2s ease;
}

.settings-chevron.open {
  transform: rotate(180deg);
}

.settings-category-body {
  padding-bottom: 16px;
}

/* ===== Tour Overlay ===== */
.tour-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9997;
  cursor: default;
}

.tour-spotlight {
  position: fixed;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  z-index: 9998;
  pointer-events: none;
  transition:
    top 0.3s ease,
    left 0.3s ease,
    width 0.3s ease,
    height 0.3s ease;
}

.tour-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--spice-card, #282828);
  border-radius: 12px;
  padding: 20px;
  width: 320px;
  max-width: calc(100vw - 32px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: tour-fade-in 0.2s ease;
}

.tour-tooltip-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--spice-text, #fff);
  margin: 0 0 8px 0;
}

.tour-tooltip-content {
  font-size: 14px;
  color: var(--spice-subtext, #b3b3b3);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.tour-tooltip-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tour-tooltip-counter {
  font-size: 12px;
  color: var(--spice-subtext, #b3b3b3);
}

.tour-tooltip-actions {
  display: flex;
  gap: 8px;
}

.tour-btn {
  background: none;
  border: 1px solid var(--spice-button-disabled, #555);
  color: var(--spice-text, #fff);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.tour-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tour-btn--primary {
  background: var(--ls-accent, #1db954);
  border-color: var(--ls-accent, #1db954);
  color: #fff;
}

.tour-btn--primary:hover {
  background: var(--ls-accent-hover, #1ed760);
}

@keyframes tour-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== Setup Wizard ===== */
.setup-wizard {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px;
}

.wizard-progress {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
}

.wizard-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--spice-button-disabled, #555);
  transition: background 0.2s;
}

.wizard-dot--active {
  background: var(--ls-accent, #1db954);
}

.wizard-dot--completed {
  background: var(--ls-accent, #1db954);
  opacity: 0.6;
}

@keyframes wizard-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.wizard-step {
  animation: wizard-fade-in 0.2s ease;
}

.wizard-step-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-base);
}

.wizard-step-desc {
  font-size: 14px;
  color: var(--text-subdued);
  margin: 0 0 24px 0;
}

.wizard-card {
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 12px;
}

.wizard-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.wizard-card.recommended {
  border: 1px solid var(--ls-accent, #1db954);
}

.wizard-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.wizard-card-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  color: var(--text-subdued);
}

.wizard-card-icon svg {
  width: 100%;
  height: 100%;
}

.wizard-card-header strong {
  font-size: 16px;
  color: var(--text-base);
}

.wizard-card-desc {
  font-size: 13px;
  color: var(--text-subdued);
  margin: 0;
  line-height: 1.4;
}

.wizard-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.wizard-helper {
  font-size: 13px;
  color: var(--spice-subtext, #aaa);
  margin-top: 8px;
  line-height: 1.5;
}

.wizard-helper a {
  color: var(--ls-accent, #1db954);
  text-decoration: underline;
}

.wizard-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  gap: 12px;
}

.wizard-validating {
  text-align: center;
  padding: 32px;
}

.wizard-validating p {
  font-size: 14px;
  color: var(--text-subdued);
  margin: 16px 0 0 0;
}

@keyframes wizard-spin {
  to {
    transform: rotate(360deg);
  }
}

.wizard-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--ls-accent, #1db954);
  border-radius: 50%;
  margin: 0 auto;
  animation: wizard-spin 0.8s linear infinite;
}

.wizard-success {
  text-align: center;
  padding: 32px;
}

.wizard-success-icon {
  width: 56px;
  height: 56px;
  color: var(--ls-accent, #1db954);
  margin: 0 auto 16px;
}

.wizard-success-icon svg {
  width: 100%;
  height: 100%;
}

.wizard-error {
  color: var(--spice-notification, #e74c3c);
  margin-top: 8px;
  font-size: 13px;
  padding: 10px 14px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 8px;
}

/* ===== Settings Actions Row ===== */
.settings-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ===== Provider Setup Guide Links ===== */
.provider-setup-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-subdued, #b3b3b3);
  font-size: 12px;
  text-decoration: none;
  margin-top: 6px;
  transition: color 0.15s;
}

.provider-setup-link:hover {
  color: var(--text-bright-accent, #1db954);
}

.provider-setup-link svg {
  width: 12px;
  height: 12px;
}

.provider-guides-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  padding-bottom: 4px;
}
`;

  // src/app/styles.ts
  function injectStyles() {
    const existing = document.getElementById("listening-stats-styles");
    if (existing) existing.remove();
    const styleEl = document.createElement("style");
    styleEl.id = "listening-stats-styles";
    styleEl.textContent = styles_default;
    document.head.appendChild(styleEl);
  }

  // src/app/index.tsx
  var { useRef: useRef8, useState: useState12, useCallback: useCallback5, useEffect: useEffect9 } = Spicetify.React;
  var SFM_PROMO_KEY = "listening-stats:sfm-promo-dismissed";
  var VERSION = getCurrentVersion();
  var TOUR_SEEN_KEY = "listening-stats:tour-seen";
  function buildTourSteps(providerType) {
    const steps = [
      {
        target: ".overview-row",
        title: "Overview",
        content: "Your key stats at a glance. Total listening time, track count, and more. Use the period tabs above to switch time ranges.",
        placement: "bottom"
      },
      {
        target: ".top-lists-section",
        title: "Top Lists",
        content: "Your most played tracks, artists, albums, and genres ranked by play count.",
        placement: "bottom"
      }
    ];
    if (providerType === "statsfm") {
      steps.push({
        target: ".genre-bars-section",
        title: "Top Genres",
        content: "Your most listened genres ranked by play count. Powered by stats.fm genre data.",
        placement: "bottom"
      });
    }
    steps.push(
      {
        target: ".activity-section",
        title: "Activity",
        content: "Your listening patterns by hour of day. Find when you listen the most.",
        placement: "top"
      },
      {
        target: ".recent-section",
        title: "Recently Played",
        content: "Your most recent tracks. Click any card to open it in Spotify.",
        placement: "top"
      },
      {
        target: ".section-drag-handle",
        title: "Reorder Sections",
        content: "Drag these handles to rearrange your dashboard layout to your liking.",
        placement: "right"
      },
      {
        target: ".header-actions",
        title: "Share & Settings",
        content: "Share your stats as an image or open settings to customize your experience.",
        placement: "bottom"
      }
    );
    return steps;
  }
  function shouldShowTour() {
    try {
      const seen = localStorage.getItem(TOUR_SEEN_KEY);
      if (!seen) return "full";
      return "none";
    } catch {
      return "none";
    }
  }
  function markTourComplete() {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
    }
  }
  var SECTION_REGISTRY = {
    overview: (p) => /* @__PURE__ */ Spicetify.React.createElement(
      OverviewCards,
      {
        stats: p.stats,
        period: p.period,
        periods: p.periods,
        periodLabels: p.periodLabels,
        onPeriodChange: p.onPeriodChange
      }
    ),
    toplists: (p) => /* @__PURE__ */ Spicetify.React.createElement(
      TopLists,
      {
        stats: p.stats,
        likedTracks: p.likedTracks,
        onLikeToggle: p.onLikeToggle,
        showLikeButtons: p.showLikeButtons,
        period: p.period
      }
    ),
    genres: (p) => /* @__PURE__ */ Spicetify.React.createElement(GenreChips, { topGenres: p.stats.topGenres }),
    activity: (p) => /* @__PURE__ */ Spicetify.React.createElement(
      ActivityChart,
      {
        hourlyDistribution: p.stats.hourlyDistribution,
        peakHour: p.stats.peakHour,
        hourlyUnit: p.stats.hourlyUnit
      }
    ),
    recent: (p) => /* @__PURE__ */ Spicetify.React.createElement(RecentlyPlayed, { recentTracks: p.stats.recentTracks })
  };
  function DashboardSections(props) {
    const { order, reorder } = useSectionOrder();
    const { startTour } = useTour();
    useEffect9(() => {
      const timer = setTimeout(() => {
        const tourType = shouldShowTour();
        if (tourType === "full") {
          startTour(buildTourSteps(props.providerType));
          markTourComplete();
        }
      }, 500);
      return () => clearTimeout(timer);
    }, []);
    useEffect9(() => {
      const handler = () => {
        startTour(buildTourSteps(props.providerType));
      };
      window.addEventListener("listening-stats:start-tour", handler);
      return () => window.removeEventListener("listening-stats:start-tour", handler);
    }, [startTour]);
    const containerRef = useRef8(null);
    const dragItemRef = useRef8(null);
    const dragOverRef = useRef8(null);
    const insertBeforeRef = useRef8(true);
    const scrollRafRef = useRef8(0);
    const [dropTarget, setDropTarget] = useState12(null);
    const [draggingId, setDraggingId] = useState12(null);
    const handleDragStart = useCallback5((id) => {
      dragItemRef.current = id;
      setDraggingId(id);
    }, []);
    const computeDropTarget = useCallback5((clientY) => {
      if (!containerRef.current || !dragItemRef.current) return;
      const sections = containerRef.current.querySelectorAll(".draggable-section");
      let bestId = null;
      let bestBefore = true;
      let bestDist = Infinity;
      sections.forEach((el) => {
        const id = el.dataset.sectionId;
        if (!id || id === dragItemRef.current) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const distTop = Math.abs(clientY - rect.top);
        const distBot = Math.abs(clientY - rect.bottom);
        const dist = Math.min(distTop, distBot);
        const before = clientY < mid;
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
          bestBefore = before;
        }
      });
      if (bestId) {
        dragOverRef.current = bestId;
        insertBeforeRef.current = bestBefore;
        setDropTarget({
          id: bestId,
          position: bestBefore ? "before" : "after"
        });
      }
    }, []);
    const autoScroll = useCallback5((clientY) => {
      cancelAnimationFrame(scrollRafRef.current);
      const EDGE = 80;
      const MAX_SPEED = 18;
      const scrollContainer = document.querySelector(
        ".main-view-container__scroll-node"
      );
      const target = scrollContainer || document.documentElement;
      let speed = 0;
      if (clientY < EDGE) {
        speed = -MAX_SPEED * (1 - clientY / EDGE);
      } else if (clientY > window.innerHeight - EDGE) {
        speed = MAX_SPEED * (1 - (window.innerHeight - clientY) / EDGE);
      }
      if (speed !== 0) {
        const tick = () => {
          target.scrollTop += speed;
          scrollRafRef.current = requestAnimationFrame(tick);
        };
        scrollRafRef.current = requestAnimationFrame(tick);
      }
    }, []);
    const handleContainerDragOver = useCallback5(
      (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        computeDropTarget(e.clientY);
        autoScroll(e.clientY);
      },
      [computeDropTarget, autoScroll]
    );
    const executeDrop = useCallback5(() => {
      cancelAnimationFrame(scrollRafRef.current);
      const draggedId = dragItemRef.current;
      const overId = dragOverRef.current;
      const before = insertBeforeRef.current;
      if (draggedId && overId && draggedId !== overId) {
        const newOrder = order.filter((id) => id !== draggedId);
        const targetIdx = newOrder.indexOf(overId);
        if (targetIdx !== -1) {
          const insertIdx = before ? targetIdx : targetIdx + 1;
          newOrder.splice(insertIdx, 0, draggedId);
          reorder(newOrder);
        }
      }
      dragItemRef.current = null;
      dragOverRef.current = null;
      insertBeforeRef.current = true;
      setDropTarget(null);
      setDraggingId(null);
    }, [order, reorder]);
    const handleContainerDrop = useCallback5(
      (e) => {
        e.preventDefault();
        executeDrop();
      },
      [executeDrop]
    );
    const handleDragEnd = useCallback5(() => {
      cancelAnimationFrame(scrollRafRef.current);
      dragItemRef.current = null;
      dragOverRef.current = null;
      insertBeforeRef.current = true;
      setDropTarget(null);
      setDraggingId(null);
    }, []);
    const noop = useCallback5(
      (_e, _id) => {
      },
      []
    );
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        ref: containerRef,
        className: "dashboard-sections",
        onDragOver: handleContainerDragOver,
        onDrop: handleContainerDrop
      },
      order.map((sectionId) => {
        const renderFn = SECTION_REGISTRY[sectionId];
        if (!renderFn) return null;
        const hidden = getPreferences().hiddenSections;
        if (hidden.includes(sectionId)) return null;
        const sectionDropPosition = dropTarget && dropTarget.id === sectionId ? dropTarget.position : null;
        return /* @__PURE__ */ Spicetify.React.createElement(
          DraggableSection,
          {
            key: sectionId,
            id: sectionId,
            onDragStart: handleDragStart,
            onDragOver: noop,
            onDrop: noop,
            onDragEnd: handleDragEnd,
            isDragging: draggingId === sectionId,
            dropPosition: sectionDropPosition
          },
          renderFn(props)
        );
      })
    );
  }
  var StatsPage = class extends Spicetify.React.Component {
    constructor(props) {
      super(props);
      this.pollInterval = null;
      this.unsubStatsUpdate = null;
      this.unsubPrefs = null;
      this.checkForUpdateOnLoad = async () => {
        const info = await checkForUpdates();
        if (info.available) {
          this.setState({ updateInfo: info, showUpdateBanner: true });
        }
      };
      this.checkUpdatesManual = async () => {
        const info = await checkForUpdates();
        this.setState({ updateInfo: info, commandCopied: false });
        if (info.available) {
          this.setState({ showUpdateBanner: true });
        } else {
          Spicetify.showNotification("You are on the latest version!");
        }
      };
      this.copyUpdateCommand = async () => {
        const copied = await copyInstallCommand();
        if (copied) {
          this.setState({ commandCopied: true });
          Spicetify.showNotification("Command copied! Paste in your terminal.");
        } else {
          Spicetify.showNotification(
            "Failed to copy. Check console for command.",
            true
          );
          console.log("[ListeningStats] Install command:", getInstallCommand());
        }
      };
      this.dismissUpdateBanner = () => {
        this.setState({ showUpdateBanner: false });
      };
      this.loadStats = async () => {
        this.setState({ loading: true, error: null, errorType: null });
        try {
          const data = await calculateStats(this.state.period);
          this.setState({ stats: data, loading: false, errorType: null });
          if (data.topTracks.length > 0 && data.topTracks[0].trackUri) {
            const uris = data.topTracks.map((t) => t.trackUri).filter(Boolean);
            if (uris.length > 0) {
              const liked = await checkLikedTracks(uris);
              this.setState({ likedTracks: liked });
            }
          }
          const provider = getActiveProvider();
          if (provider?.prefetchPeriod) {
            const idx = provider.periods.indexOf(this.state.period);
            const adjacent = [
              provider.periods[idx - 1],
              provider.periods[idx + 1]
            ].filter(Boolean);
            for (const p of adjacent) {
              provider.prefetchPeriod(p);
            }
          }
        } catch (e) {
          console.error("[ListeningStats] Load failed:", e);
          const isApiError = e instanceof ApiError || e?.name === "ApiError";
          this.setState({
            loading: false,
            error: e.message || "Failed to load stats",
            errorType: isApiError ? "api" : "generic"
          });
        }
      };
      this.handleLikeToggle = async (uri, e) => {
        e.stopPropagation();
        const current = this.state.likedTracks.get(uri) || false;
        const newVal = await toggleLike(uri, current);
        const m = new Map(this.state.likedTracks);
        m.set(uri, newVal);
        this.setState({ likedTracks: m });
      };
      this.handlePeriodChange = (period) => {
        this.setState({ period });
      };
      this.handleShare = () => {
        this.setState({ showShareModal: true });
      };
      this.dismissSfmPromo = () => {
        this.setState({ showSfmPromo: false });
        try {
          localStorage.setItem(SFM_PROMO_KEY, "1");
        } catch {
        }
      };
      this.handleSfmSwitch = async (username) => {
        try {
          const info = await validateUser2(username.trim());
          saveConfig2({ username: info.customId, isPlus: info.isPlus });
          this.dismissSfmPromo();
          activateProvider("statsfm");
          this.handleProviderChanged();
        } catch (err) {
          throw err;
        }
      };
      this.handleReset = () => {
        this.setState({
          needsSetup: true,
          providerType: null,
          stats: null,
          loading: false,
          error: null,
          showSettings: false,
          showSfmPromo: false,
          likedTracks: /* @__PURE__ */ new Map()
        });
      };
      this.handleProviderSelected = () => {
        const provider = getActiveProvider();
        if (provider) {
          let showSfmPromo = false;
          if (provider.type !== "statsfm") {
            try {
              if (!localStorage.getItem(SFM_PROMO_KEY)) {
                showSfmPromo = true;
              }
            } catch {
            }
          }
          this.setState(
            {
              needsSetup: false,
              providerType: provider.type,
              period: provider.defaultPeriod,
              loading: true,
              showSfmPromo
            },
            () => {
              this.loadStats();
              this.checkForUpdateOnLoad();
            }
          );
        }
      };
      this.handleProviderChanged = () => {
        clearStatsCache();
        const provider = getActiveProvider();
        if (provider) {
          const isStatsfm = provider.type === "statsfm";
          if (isStatsfm) {
            try {
              localStorage.setItem(SFM_PROMO_KEY, "1");
            } catch {
            }
          }
          this.setState(
            {
              providerType: provider.type,
              period: provider.defaultPeriod,
              stats: null,
              loading: true,
              showSettings: false,
              showSfmPromo: isStatsfm ? false : this.state.showSfmPromo
            },
            () => {
              this.loadStats();
            }
          );
        }
      };
      let providerType = getSelectedProviderType();
      let needsSetup = false;
      if (!providerType) {
        needsSetup = true;
      }
      if (providerType && !getActiveProvider()) {
        activateProvider(providerType, true);
      }
      const provider = getActiveProvider();
      this.state = {
        period: provider?.defaultPeriod || "recent",
        stats: null,
        loading: !needsSetup,
        error: null,
        errorType: null,
        likedTracks: /* @__PURE__ */ new Map(),
        updateInfo: null,
        showUpdateBanner: false,
        commandCopied: false,
        showSettings: false,
        lastUpdateTimestamp: 0,
        needsSetup,
        providerType,
        showShareModal: false,
        showSfmPromo: false
      };
    }
    componentDidMount() {
      injectStyles();
      if (!this.state.needsSetup) {
        this.loadStats();
        this.checkForUpdateOnLoad();
        if (this.state.providerType && this.state.providerType !== "statsfm") {
          try {
            if (!localStorage.getItem(SFM_PROMO_KEY)) {
              this.setState({ showSfmPromo: true });
            }
          } catch {
          }
        }
      }
      this.unsubStatsUpdate = onStatsUpdated(() => {
        if (!this.state.needsSetup && !this.state.loading) {
          clearStatsCache();
          this.loadStats();
        }
      });
      this.unsubPrefs = onPreferencesChanged(() => {
        this.forceUpdate();
      });
    }
    componentWillUnmount() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.unsubStatsUpdate?.();
      this.unsubPrefs?.();
    }
    componentDidUpdate(_, prev) {
      if (prev.period !== this.state.period && !this.state.needsSetup) {
        this.loadStats();
      }
    }
    render() {
      const {
        period,
        stats,
        loading,
        error,
        likedTracks,
        updateInfo,
        showUpdateBanner,
        commandCopied,
        showSettings,
        needsSetup,
        providerType,
        showShareModal,
        showSfmPromo
      } = this.state;
      if (needsSetup) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(SetupScreen, { onProviderSelected: this.handleProviderSelected }));
      }
      const provider = getActiveProvider();
      const periods = provider?.periods || ["recent"];
      const periodLabels = provider?.periodLabels || { recent: "Recent" };
      const showLikeButtons = providerType !== "lastfm";
      const sfmPromoPortal = showSfmPromo && providerType !== "statsfm" ? Spicetify.ReactDOM.createPortal(
        /* @__PURE__ */ Spicetify.React.createElement(
          SfmPromoPopup,
          {
            onDismiss: this.dismissSfmPromo,
            onSwitch: this.handleSfmSwitch
          }
        ),
        document.body
      ) : null;
      if (showUpdateBanner && updateInfo) {
        return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(
          UpdateBanner,
          {
            updateInfo,
            commandCopied,
            onDismiss: this.dismissUpdateBanner,
            onCopyCommand: this.copyUpdateCommand
          }
        ), sfmPromoPortal);
      }
      if (loading) {
        return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement(LoadingSkeleton, null), sfmPromoPortal);
      }
      const settingsModal = showSettings ? Spicetify.ReactDOM.createPortal(
        /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            className: "settings-overlay",
            onClick: (e) => {
              if (e.target.classList.contains("settings-overlay")) {
                this.setState({ showSettings: false });
              }
            }
          },
          /* @__PURE__ */ Spicetify.React.createElement(
            SettingsPanel,
            {
              onRefresh: this.loadStats,
              onCheckUpdates: this.checkUpdatesManual,
              onProviderChanged: this.handleProviderChanged,
              onClose: () => this.setState({ showSettings: false }),
              onReset: this.handleReset,
              stats,
              period
            }
          )
        ),
        document.body
      ) : null;
      if (error && !stats) {
        const isApiFailure = this.state.errorType === "api";
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(
          Header,
          {
            onToggleSettings: () => this.setState({ showSettings: !showSettings }),
            providerType
          }
        ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-state" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-message" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, isApiFailure ? "Could not fetch data" : "Something went wrong"), /* @__PURE__ */ Spicetify.React.createElement("p", null, isApiFailure ? "The data source is temporarily unavailable. This is usually caused by rate limiting. Please wait a moment and try again." : error), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: this.loadStats }, "Try Again"))), /* @__PURE__ */ Spicetify.React.createElement(
          Footer,
          {
            version: VERSION,
            updateInfo,
            onShowUpdate: () => this.setState({ showUpdateBanner: true })
          }
        ), settingsModal);
      }
      if (!stats || stats.topTracks.length === 0 && stats.recentTracks.length === 0) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(
          Header,
          {
            onShare: stats ? this.handleShare : void 0,
            onToggleSettings: () => this.setState({ showSettings: !showSettings }),
            providerType
          }
        ), /* @__PURE__ */ Spicetify.React.createElement(
          EmptyState,
          {
            stats,
            period,
            periods,
            periodLabels,
            onPeriodChange: this.handlePeriodChange
          }
        ), /* @__PURE__ */ Spicetify.React.createElement(
          Footer,
          {
            version: VERSION,
            updateInfo,
            onShowUpdate: () => this.setState({ showUpdateBanner: true })
          }
        ), settingsModal);
      }
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(TourProvider, null, /* @__PURE__ */ Spicetify.React.createElement(
        Header,
        {
          onShare: this.handleShare,
          onToggleSettings: () => this.setState({ showSettings: !showSettings }),
          providerType
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(
        DashboardSections,
        {
          stats,
          period,
          periods,
          periodLabels,
          onPeriodChange: this.handlePeriodChange,
          likedTracks,
          onLikeToggle: this.handleLikeToggle,
          showLikeButtons,
          providerType
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(
        Footer,
        {
          version: VERSION,
          updateInfo,
          onShowUpdate: () => this.setState({ showUpdateBanner: true, commandCopied: false })
        }
      ), settingsModal, showShareModal && stats && Spicetify.ReactDOM.createPortal(
        /* @__PURE__ */ Spicetify.React.createElement(
          ShareCardModal,
          {
            stats,
            period,
            providerType,
            onClose: () => this.setState({ showShareModal: false })
          }
        ),
        document.body
      ), sfmPromoPortal));
    }
  };
  function SfmPromoPopup({
    onDismiss,
    onSwitch
  }) {
    const [username, setUsername] = Spicetify.React.useState("");
    const [loading, setLoading] = Spicetify.React.useState(false);
    const [error, setError] = Spicetify.React.useState("");
    const handleSwitch = async () => {
      if (!username.trim()) {
        setError("Username is required");
        return;
      }
      setLoading(true);
      setError("");
      try {
        await onSwitch(username);
      } catch (err) {
        setError(err.message || "Connection failed");
        setLoading(false);
      }
    };
    return /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        className: "settings-overlay",
        onClick: (e) => {
          if (e.target.classList.contains("settings-overlay")) {
            onDismiss();
          }
        }
      },
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "sfm-promo-popup" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Switch to stats.fm?"), /* @__PURE__ */ Spicetify.React.createElement("p", null, "We now support ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, "stats.fm"), " as a data source. It provides accurate play counts, listening duration, and only needs your username to set up.", /* @__PURE__ */ Spicetify.React.createElement("br", null), "This is highly recommended for a better experience!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form" }, /* @__PURE__ */ Spicetify.React.createElement(
        "input",
        {
          className: "lastfm-input",
          type: "text",
          placeholder: "stats.fm username",
          value: username,
          onChange: (e) => setUsername(e.target.value),
          disabled: loading
        }
      ), error && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "lastfm-error" }, error)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "sfm-promo-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn primary",
          onClick: handleSwitch,
          disabled: loading
        },
        loading ? "Connecting..." : "Switch to stats.fm"
      ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onDismiss }, "No thanks")))
    );
  }
  var index_default = StatsPage;
  return __toCommonJS(index_exports);
})();
var render=()=>Spicetify.React.createElement(ListeningStatsApp.default);var routes=[];
