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
    getAllPlayEvents: () => getAllPlayEvents,
    getDB: () => getDB,
    getPlayEventsByTimeRange: () => getPlayEventsByTimeRange
  });
  function getDB() {
    if (!dbPromise) {
      dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (db.objectStoreNames.contains(STORE_NAME) && oldVersion < 3) {
            db.deleteObjectStore(STORE_NAME);
          }
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, {
              keyPath: "id",
              autoIncrement: true
            });
            store.createIndex("by-startedAt", "startedAt");
            store.createIndex("by-trackUri", "trackUri");
            store.createIndex("by-artistUri", "artistUri");
          }
        }
      });
    }
    return dbPromise;
  }
  async function addPlayEvent(event) {
    const db = await getDB();
    await db.add(STORE_NAME, event);
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
    console.log("[ListeningStats] IndexedDB data cleared");
  }
  var DB_NAME, DB_VERSION, STORE_NAME, dbPromise;
  var init_storage = __esm({
    "src/services/storage.ts"() {
      init_build();
      DB_NAME = "listening-stats";
      DB_VERSION = 3;
      STORE_NAME = "playEvents";
      dbPromise = null;
    }
  });

  // src/app/index.tsx
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

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
    const cached = getCached(cacheKey);
    if (cached) return cached;
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

  // src/services/spotify-api.ts
  var STORAGE_PREFIX = "listening-stats:";
  var QUEUE_DELAY_MS = 300;
  var MAX_BATCH = 50;
  var CACHE_TTL_MS2 = 3e5;
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
  var cache2 = /* @__PURE__ */ new Map();
  function getCached2(key) {
    const entry = cache2.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      cache2.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache2(key, data) {
    cache2.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS2 });
  }
  function clearApiCaches() {
    cache2.clear();
  }
  var queue = [];
  var draining = false;
  function enqueue(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      if (!draining) drainQueue();
    });
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
        const result = await item.fn();
        item.resolve(result);
      } catch (error) {
        if (error?.message?.includes("429") || error?.status === 429) {
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
    const cached = getCached2(url);
    if (cached) return cached;
    return enqueue(async () => {
      let response;
      try {
        response = await Spicetify.CosmosAsync.get(url);
      } catch (err) {
        if (err?.status === 429 || String(err?.message || "").includes("429")) {
          setRateLimit(err);
        }
        throw err;
      }
      if (!response) {
        throw new Error("Empty API response");
      }
      if (response.error) {
        const status = response.error.status;
        const err = new Error(
          response.error.message || `Spotify API error ${status}`
        );
        err.status = status;
        if (status === 429) setRateLimit(response);
        throw err;
      }
      setCache2(url, response);
      return response;
    });
  }
  var SEARCH_CACHE_KEY = "listening-stats:searchCache";
  var SEARCH_CACHE_MAX = 500;
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
  var persistTimer = null;
  function schedulePersistSearchCache() {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      try {
        const obj = {};
        let count = 0;
        for (const [k, v] of searchCache) {
          if (v.uri || v.imageUrl) {
            obj[k] = v;
            if (++count >= SEARCH_CACHE_MAX) break;
          }
        }
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(obj));
      } catch {
      }
    }, 2e3);
  }
  var SEARCH_CONCURRENCY = 2;
  var SEARCH_DELAY_MS = 150;
  var activeSearchCount = 0;
  var searchWaiters = [];
  async function acquireSearchSlot() {
    if (activeSearchCount < SEARCH_CONCURRENCY) {
      activeSearchCount++;
      return;
    }
    await new Promise((resolve) => searchWaiters.push(resolve));
  }
  function releaseSearchSlot() {
    setTimeout(() => {
      activeSearchCount--;
      if (searchWaiters.length > 0) {
        activeSearchCount++;
        searchWaiters.shift()();
      }
    }, SEARCH_DELAY_MS);
  }
  async function throttledSearch(cacheKey, fetchFn) {
    if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);
    await acquireSearchSlot();
    try {
      if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);
      const result = await fetchFn();
      searchCache.set(cacheKey, result);
      schedulePersistSearchCache();
      return result;
    } catch {
      const empty = {};
      searchCache.set(cacheKey, empty);
      return empty;
    } finally {
      releaseSearchSlot();
    }
  }
  async function searchTrack(trackName, artistName) {
    const cacheKey = `s:t:${artistName}|||${trackName}`;
    return throttledSearch(cacheKey, async () => {
      const q = encodeURIComponent(`track:${trackName} artist:${artistName}`);
      const resp = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`
      );
      const item = resp?.tracks?.items?.[0];
      return { uri: item?.uri, imageUrl: item?.album?.images?.[0]?.url };
    });
  }
  async function searchArtist(artistName) {
    const cacheKey = `s:a:${artistName}`;
    return throttledSearch(cacheKey, async () => {
      const q = encodeURIComponent(`artist:${artistName}`);
      const resp = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`
      );
      const item = resp?.artists?.items?.[0];
      return { uri: item?.uri, imageUrl: item?.images?.[0]?.url };
    });
  }
  async function searchAlbum(albumName, artistName) {
    const cacheKey = `s:al:${artistName}|||${albumName}`;
    return throttledSearch(cacheKey, async () => {
      const q = encodeURIComponent(`album:${albumName} artist:${artistName}`);
      const resp = await Spicetify.CosmosAsync.get(
        `https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`
      );
      const item = resp?.albums?.items?.[0];
      return { uri: item?.uri, imageUrl: item?.images?.[0]?.url };
    });
  }
  async function getArtistsBatch(artistIds) {
    const unique = [...new Set(artistIds)].filter(Boolean);
    if (unique.length === 0) return [];
    const results = [];
    for (let i = 0; i < unique.length; i += MAX_BATCH) {
      const chunk = unique.slice(i, i + MAX_BATCH);
      const ids = chunk.join(",");
      try {
        const response = await apiFetch(
          `https://api.spotify.com/v1/artists?ids=${ids}`
        );
        if (response?.artists) {
          results.push(...response.artists.filter(Boolean));
        }
      } catch (error) {
        console.warn("[ListeningStats] Artist batch fetch failed:", error);
      }
    }
    return results;
  }

  // src/services/tracker.ts
  init_storage();
  var STORAGE_KEY2 = "listening-stats:pollingData";
  var LOGGING_KEY = "listening-stats:logging";
  var SKIP_THRESHOLD_MS = 3e4;
  var STATS_UPDATED_EVENT = "listening-stats:updated";
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
  function handleSongChange() {
    if (currentTrackUri && playStartTime !== null) {
      const totalPlayedMs = accumulatedPlayTime + (isPlaying ? Date.now() - playStartTime : 0);
      const data = getPollingData();
      data.totalPlays++;
      const skipped = totalPlayedMs < SKIP_THRESHOLD_MS && currentTrackDuration > SKIP_THRESHOLD_MS;
      if (skipped) {
        data.skipEvents++;
      }
      savePollingData(data);
      if (previousTrackData) {
        log(
          skipped ? "Skipped:" : "Tracked:",
          `${previousTrackData.artistName} - ${previousTrackData.trackName}`,
          `(${Math.round(totalPlayedMs / 1e3)}s / ${Math.round(currentTrackDuration / 1e3)}s)`
        );
      }
      writePlayEvent(totalPlayedMs);
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
  function writePlayEvent(totalPlayedMs) {
    if (!previousTrackData) return;
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
      endedAt: Date.now()
    };
    addPlayEvent(event).catch((err) => {
      console.warn("[ListeningStats] Failed to write play event:", err);
    });
    if (activeProviderType === "local") {
      emitStatsUpdated();
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
    activeProviderType = providerType;
    captureCurrentTrackData();
    activeSongChangeHandler = () => {
      handleSongChange();
      captureCurrentTrackData();
    };
    Spicetify.Player.addEventListener("songchange", activeSongChangeHandler);
    Spicetify.Player.addEventListener("onplaypause", handlePlayPause);
    win.__lsSongHandler = activeSongChangeHandler;
    win.__lsPauseHandler = handlePlayPause;
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
    const win = window;
    win.__lsSongHandler = null;
    win.__lsPauseHandler = null;
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
  async function enrichArtistImages(artists) {
    const needsImage = artists.filter((a) => !a.artistImage);
    if (needsImage.length === 0) return;
    const results = await Promise.all(
      needsImage.map((a) => searchArtist(a.artistName))
    );
    needsImage.forEach((a, i) => {
      if (results[i].uri && !a.artistUri) a.artistUri = results[i].uri;
      if (results[i].imageUrl) a.artistImage = results[i].imageUrl;
    });
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
    await enrichArtistImages(topArtists);
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
    await enrichArtistImages(topArtists);
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
      peakHour: 0,
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
        initPoller("local");
      },
      destroy() {
        destroyPoller();
      },
      async calculateStats(period) {
        const events = await getEventsForPeriod(period);
        return aggregateEvents(events);
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
  async function aggregateEvents(events) {
    const pollingData = getPollingData();
    const trackMap = /* @__PURE__ */ new Map();
    for (const e of events) {
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
    for (const e of events) {
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
    const artistIds = topArtistAggregated.map((a) => a.artistUri?.split(":")[2]).filter(Boolean);
    let artistDetails = [];
    if (artistIds.length > 0 && isApiAvailable()) {
      try {
        artistDetails = await getArtistsBatch(artistIds);
      } catch {
      }
    }
    const artistDetailMap = new Map(
      artistDetails.map((a) => [`spotify:artist:${a.id}`, a])
    );
    const topArtists = topArtistAggregated.map((a, i) => {
      const detail = artistDetailMap.get(a.artistUri);
      return {
        artistUri: a.artistUri,
        artistName: a.artistName,
        artistImage: detail?.images?.[0]?.url,
        rank: i + 1,
        genres: detail?.genres || [],
        playCount: a.count
      };
    });
    const albumMap = /* @__PURE__ */ new Map();
    for (const e of events) {
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
    const uniqueTrackUris = new Set(events.map((e) => e.trackUri));
    const uniqueArtistUris = new Set(
      events.map((e) => e.artistUri).filter(Boolean)
    );
    const dateSet = new Set(
      events.map((e) => new Date(e.startedAt).toISOString().split("T")[0])
    );
    const totalTimeMs = events.reduce((sum, e) => sum + e.playedMs, 0);
    let skipEvents = 0;
    for (const e of events) {
      if (e.playedMs < 3e4 && e.durationMs > 3e4) {
        skipEvents++;
      }
    }
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
      streakDays: calculateStreak2(Array.from(dateSet)),
      newArtistsCount: 0,
      skipRate: events.length > 0 ? skipEvents / events.length : 0,
      listenedDays: dateSet.size,
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
  var CACHE_TTL_MS3 = 12e4;
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
  var cache3 = /* @__PURE__ */ new Map();
  function getCached3(key) {
    const entry = cache3.get(key);
    if (!entry || Date.now() >= entry.expiresAt) {
      cache3.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache3(key, data) {
    cache3.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS3 });
  }
  function clearStatsfmCache() {
    cache3.clear();
  }
  async function statsfmFetch(path) {
    const url = `${API_BASE}${path}`;
    const cached = getCached3(url);
    if (cached) return cached;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) throw new Error("User not found");
      if (response.status === 403) throw new Error("Profile is private");
      if (response.status === 429)
        throw new Error("Rate limited. Try again later");
      throw new Error(`stats.fm API error: ${response.status}`);
    }
    const data = await response.json();
    setCache3(url, data);
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
  async function getStreamStats() {
    const data = await statsfmFetch(`/users/${getUsername()}/streams/stats`);
    const item = data.items || data;
    return {
      durationMs: item.durationMs || 0,
      count: item.count || 0,
      cardinality: item.cardinality || { tracks: 0, artists: 0, albums: 0 }
    };
  }
  function extractSpotifyUri(externalIds, type) {
    const ids = externalIds?.spotify;
    if (!ids || ids.length === 0) return "";
    const id = ids[0];
    if (id.startsWith("spotify:")) return id;
    return `spotify:${type}:${id}`;
  }

  // src/services/providers/statsfm.ts
  var PERIODS3 = ["weeks", "months", "lifetime"];
  var PERIOD_LABELS3 = {
    weeks: "4 Weeks",
    months: "6 Months",
    lifetime: "Lifetime"
  };
  function createStatsfmProvider() {
    return {
      type: "statsfm",
      periods: [...PERIODS3],
      periodLabels: PERIOD_LABELS3,
      defaultPeriod: "weeks",
      init() {
        initPoller("statsfm");
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
      streamStats
    ] = await Promise.all([
      getTopTracks2(range, 50),
      getTopArtists2(range, 50),
      getTopAlbums2(range, 50),
      getTopGenres(range, 20),
      getRecentStreams(50).catch(() => []),
      getStreamStats().catch(() => ({
        durationMs: 0,
        count: 0,
        cardinality: { tracks: 0, artists: 0, albums: 0 }
      }))
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
    const hourlyDistribution = new Array(24).fill(0);
    for (const t of recentTracks) {
      const hour = new Date(t.playedAt).getHours();
      hourlyDistribution[hour]++;
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
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
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
  var INSTALL_CMD_WINDOWS = `iwr -useb 'https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1' | iex`;
  function getCurrentVersion() {
    try {
      return "1.2.40";
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
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-container" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-icon" }, "\u{1F389}"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-title" }, "Update Available!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-version" }, "v", updateInfo.currentVersion, " \u2192 v", updateInfo.latestVersion)), updateInfo.changelog && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-changelog" }, updateInfo.changelog), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-links" }, /* @__PURE__ */ Spicetify.React.createElement(
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

  // src/app/components/SettingsPanel.tsx
  init_storage();
  var { useState } = Spicetify.React;
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
        saveConfig2({ username: info.customId });
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
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Data Source"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-current" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Currently using:", " ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, currentProvider ? PROVIDER_NAMES[currentProvider] : "None")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => setShowProviderPicker(!showProviderPicker)
      },
      "Change"
    )), showProviderPicker && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-picker" }, sfmConnected || currentProvider === "statsfm" ? /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `provider-option ${currentProvider === "statsfm" ? "active" : ""}`,
        onClick: () => switchProvider("statsfm")
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "stats.fm"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", sfmConfig?.username || "...")
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
    ))), lfmConnected || currentProvider === "lastfm" ? /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `provider-option ${currentProvider === "lastfm" ? "active" : ""}`,
        onClick: () => switchProvider("lastfm")
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Last.fm"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", lfmConfig?.username || "...")
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
    ))), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `provider-option ${currentProvider === "local" ? "active" : ""}`,
        onClick: () => switchProvider("local")
      },
      /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Local Tracking"),
      /* @__PURE__ */ Spicetify.React.createElement("span", null, "Tracks on this device with IndexedDB")
    ))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-row" }, /* @__PURE__ */ Spicetify.React.createElement(
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
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onCheckUpdates }, "Check Updates"), currentProvider === "local" && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
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
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-export" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Export Data"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-row" }, /* @__PURE__ */ Spicetify.React.createElement(
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
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-toggle-info" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Console Logging"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-toggle-desc" }, "Log tracked songs, skips, and playback events to the browser console (F12).")), /* @__PURE__ */ Spicetify.React.createElement(
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
    ))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-danger-zone" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Danger Zone"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "settings-danger-desc" }, "Wipe all data and return to the setup screen. This clears the IndexedDB database, all saved accounts, caches, and preferences."), /* @__PURE__ */ Spicetify.React.createElement(
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
              localStorage.removeItem("listening-stats:sfm-promo-dismissed");
              localStorage.removeItem("listening-stats:lastUpdateCheck");
              localStorage.removeItem("listening-stats:lastUpdate");
              localStorage.removeItem("listening-stats:searchCache");
              localStorage.removeItem("listening-stats:logging");
            } catch {
            }
            onReset?.();
          }
        }
      },
      "Wipe Everything"
    )));
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
  async function lazyNavigate(type, name, artistName) {
    let result;
    if (type === "track") {
      result = await searchTrack(name, artistName || "");
    } else if (type === "artist") {
      result = await searchArtist(name);
    } else {
      result = await searchAlbum(name, artistName || "");
    }
    if (result?.uri) {
      navigateToUri(result.uri);
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
  function formatHour(h) {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
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
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-secondary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.trackCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueArtistCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueTrackCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Unique")), stats.lastfmConnected && stats.totalScrobbles ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, stats.totalScrobbles.toLocaleString()), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Scrobbles")) : null)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value green" }, "$", payout), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Spotify paid artists"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "From you listening to their music!")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value orange" }, stats.streakDays), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Day Streak"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Resets at midnight local time.")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, stats.newArtistsCount > 0 ? /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, stats.newArtistsCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "New Artists"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "You're cool if this is high!")) : /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, stats.listenedDays), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Days Listened"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Days with at least one play."))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value red" }, Math.floor(stats.skipRate * 100), "%"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Skip Rate"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Get this as low as possible!"))))));
  }

  // src/app/components/TopLists.tsx
  function TopLists({
    stats,
    likedTracks,
    onLikeToggle,
    showLikeButtons = true,
    period = ""
  }) {
    const itemCount = 6;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-lists-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.music } }), "Top Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topTracks.slice(0, itemCount).map((t, i) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: t.trackUri || `track-${i}`,
        className: "item-row",
        onClick: () => t.trackUri ? navigateToUri(t.trackUri) : lazyNavigate("track", t.trackName, t.artistName)
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
      t.albumArt ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: t.albumArt, className: "item-art", alt: "" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art placeholder" }),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, t.trackName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, t.artistName)),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, t.playCount ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, t.playCount, " plays") : null, t.totalTimeMs > 0 && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(t.totalTimeMs))),
      showLikeButtons && t.trackUri && /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: `heart-btn ${likedTracks.get(t.trackUri) ? "liked" : ""}`,
          onClick: (e) => onLikeToggle(t.trackUri, e),
          dangerouslySetInnerHTML: {
            __html: likedTracks.get(t.trackUri) ? Icons.heartFilled : Icons.heart
          }
        }
      )
    )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.users } }), "Top Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topArtists.slice(0, itemCount).map((a, i) => {
      return /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          key: a.artistUri || a.artistName,
          className: "item-row",
          onClick: () => a.artistUri ? navigateToUri(a.artistUri) : lazyNavigate("artist", a.artistName)
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
        a.artistImage ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: a.artistImage, className: "item-art round", alt: "" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art round placeholder artist-placeholder" }),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.artistName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.genres?.slice(0, 2).join(", ") || "")),
        a.playCount ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, a.playCount, " plays")) : null
      );
    }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.album } }), "Top Albums")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topAlbums.slice(0, itemCount).map((a, i) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: a.albumUri || `album-${i}`,
        className: "item-row",
        onClick: () => a.albumUri ? navigateToUri(a.albumUri) : lazyNavigate("album", a.albumName, a.artistName)
      },
      /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
      a.albumArt ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: a.albumArt, className: "item-art", alt: "" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-art placeholder" }),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.albumName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.artistName)),
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, a.playCount ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, a.playCount, " plays") : null, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, a.trackCount, " tracks"))
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
        onClick: () => t.trackUri ? navigateToUri(t.trackUri) : lazyNavigate("track", t.trackName, t.artistName)
      },
      t.albumArt ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: t.albumArt, className: "recent-art", alt: "" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-art placeholder" }),
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
  var { useState: useState3, useEffect: useEffect2 } = Spicetify.React;

  // src/app/components/SetupScreen.tsx
  var { useState: useState4 } = Spicetify.React;
  function SetupScreen({ onProviderSelected }) {
    const [lfmUsername, setLfmUsername] = useState4("");
    const [lfmApiKey, setLfmApiKey] = useState4("");
    const [lfmValidating, setLfmValidating] = useState4(false);
    const [lfmError, setLfmError] = useState4("");
    const [sfmUsername, setSfmUsername] = useState4("");
    const [sfmValidating, setSfmValidating] = useState4(false);
    const [sfmError, setSfmError] = useState4("");
    const handleLastfmSelect = async () => {
      if (!lfmUsername.trim() || !lfmApiKey.trim()) {
        setLfmError("Both username and API key are required");
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
        activateProvider("lastfm");
        onProviderSelected();
      } catch (err) {
        setLfmError(err.message || "Connection failed");
      } finally {
        setLfmValidating(false);
      }
    };
    const handleStatsfmSelect = async () => {
      if (!sfmUsername.trim()) {
        setSfmError("Username is required");
        return;
      }
      setSfmValidating(true);
      setSfmError("");
      try {
        const info = await validateUser2(sfmUsername.trim());
        saveConfig2({ username: info.customId });
        activateProvider("statsfm");
        onProviderSelected();
      } catch (err) {
        setSfmError(err.message || "Connection failed");
      } finally {
        setSfmValidating(false);
      }
    };
    const handleLocalSelect = () => {
      activateProvider("local");
      onProviderSelected();
    };
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-screen" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-header" }, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "setup-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "setup-subtitle" }, "Connect your stats.fm or Last.fm account to get started")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-main" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card primary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card-icon" }, /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4l-4 4-4-4H4a2 2 0 0 1-2-2V4zm6 3a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm4-1a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V7a1 1 0 0 0-1-1zm4 2a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1z" }))), /* @__PURE__ */ Spicetify.React.createElement("h3", null, "stats.fm ", /* @__PURE__ */ Spicetify.React.createElement("span", { className: "setup-badge" }, "Recommended")), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "setup-card-desc" }, "Detailed listening statistics with accurate play counts and listening time."), /* @__PURE__ */ Spicetify.React.createElement("ul", { className: "setup-card-pros" }, /* @__PURE__ */ Spicetify.React.createElement("li", null, "Accurate play counts & duration"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "No API key needed"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Easy setup, just your username")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "stats.fm username - From the URL bar, not the display name!",
        value: sfmUsername,
        onChange: (e) => setSfmUsername(e.target.value),
        disabled: sfmValidating
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-links" }, /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://github.com/Xndr2/listening-stats/wiki/stats.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Setup guide",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://stats.fm",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Create an account",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), sfmError && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "lastfm-error" }, sfmError)), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn primary",
        onClick: handleStatsfmSelect,
        disabled: sfmValidating
      },
      sfmValidating ? "Connecting..." : "Connect & Start"
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card primary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card-icon" }, /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.422 0 3.19 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" }))), /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Last.fm"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "setup-card-desc" }, "Accurate play counts and listening history across all your devices."), /* @__PURE__ */ Spicetify.React.createElement("ul", { className: "setup-card-pros" }, /* @__PURE__ */ Spicetify.React.createElement("li", null, "Accurate play counts"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Tracks across all devices"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "7 time period options")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form" }, /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "Last.fm username",
        value: lfmUsername,
        onChange: (e) => setLfmUsername(e.target.value),
        disabled: lfmValidating
      }
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "input",
      {
        className: "lastfm-input",
        type: "text",
        placeholder: "Last.fm API key",
        value: lfmApiKey,
        onChange: (e) => setLfmApiKey(e.target.value),
        disabled: lfmValidating
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-links" }, /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://github.com/Xndr2/listening-stats/wiki/Last.fm-Setup-Guide",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Setup guide",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    ), /* @__PURE__ */ Spicetify.React.createElement(
      "a",
      {
        className: "lastfm-help-link standalone",
        href: "https://www.last.fm/api/account/create",
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "Get an API key",
      /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.external } })
    )), lfmError && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "lastfm-error" }, lfmError)), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn primary",
        onClick: handleLastfmSelect,
        disabled: lfmValidating
      },
      lfmValidating ? "Connecting..." : "Connect & Start"
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-divider" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "or")), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "setup-alt-option", onClick: handleLocalSelect }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.music } }), /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "Use Local Tracking instead"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "Tracks on this device only, no account needed")))));
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
        "div",
        {
          key: hr,
          className: `activity-bar ${hr === peakHour && val > 0 ? "peak" : ""}`,
          style: { height: `${h}%` }
        },
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-bar-tooltip" }, formatHour(hr), ": ", formatValue(val))
      );
    })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "chart-labels" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "12am"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "6am"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "12pm"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "6pm"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "12am")));
  }

  // src/app/components/Header.tsx
  var PROVIDER_NAMES2 = {
    local: "Local Tracking",
    lastfm: "Last.fm",
    statsfm: "stats.fm"
  };
  function Header({
    onShare,
    onToggleSettings,
    providerType
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "stats-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-subtitle" }, "Your personal music analytics", providerType && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "provider-badge" }, "via ", PROVIDER_NAMES2[providerType])), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-dev-note" }, "Dev note: I just added Stats.fm tracking. This works way better then Last.fm so if you can, please change to this for a better experience.", /* @__PURE__ */ Spicetify.React.createElement("br", null), "You can change using the setting icon on the right. Bugs are expected, please report them on", " ", /* @__PURE__ */ Spicetify.React.createElement("a", { href: "https://github.com/Xndr2/listening-stats/issues/new?template=bug_report.md" }, "github"), ".")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "header-actions" }, onToggleSettings && /* @__PURE__ */ Spicetify.React.createElement(
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
    let y = 480;
    y += 16;
    y += 58 + 12 + 58 + 28;
    y += 16;
    const trackCount = Math.min(5, stats.topTracks.length);
    if (trackCount > 0) {
      y += 36 + 64 * trackCount + 16 + 24;
    }
    const artistCount = Math.min(3, stats.topArtists.length);
    if (artistCount > 0) {
      y += 16 + 40 + 80 + 56;
    }
    const albumCount = Math.min(5, stats.topAlbums.length);
    if (albumCount > 0) {
      y += 16 + 36 + 64 * albumCount + 16 + 24;
    }
    if (stats.hourlyDistribution.some((v) => v > 0)) {
      y += 16 + 36 + 120 + 16;
    }
    if (stats.topGenres.length > 0) {
      y += 16 + 28 + 20;
    }
    y += 48;
    return Math.max(y, 800);
  }
  var STORY_W = 1080;
  var LAND_W = 1200;
  var LAND_H = 675;
  async function generateStoryCard(stats, period, providerType) {
    const w = STORY_W;
    const h = calculateStoryHeight(stats);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const pad = 52;
    const innerW = w - pad * 2;
    const rightEdge = w - pad;
    let accent = GREEN;
    let heroImg = null;
    if (stats.topTracks[0]?.albumArt) {
      heroImg = await loadImage(stats.topTracks[0].albumArt);
      if (heroImg) accent = extractDominantColor(heroImg);
    }
    const baseBg = ctx.createLinearGradient(0, 0, 0, h);
    baseBg.addColorStop(0, "#0c0c12");
    baseBg.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = baseBg;
    ctx.fillRect(0, 0, w, h);
    const heroH = 480;
    if (heroImg) {
      drawBlurredBackground(ctx, heroImg, 0, 0, w, heroH, 50);
    }
    const heroOverlay = ctx.createLinearGradient(0, 0, 0, heroH);
    heroOverlay.addColorStop(0, "rgba(0,0,0,0.5)");
    heroOverlay.addColorStop(0.7, "rgba(12,12,18,0.85)");
    heroOverlay.addColorStop(1, "rgba(10,10,15,1)");
    ctx.fillStyle = heroOverlay;
    ctx.fillRect(0, 0, w, heroH);
    const username = getUsername2(providerType);
    const title = username ? `${username}'s Stats` : "My Listening Stats";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${42}px ${FONT}`;
    ctx.fillText(truncateText(ctx, title, innerW), pad, 64);
    const periodText = getPeriodDisplayName(period);
    ctx.font = `600 ${15}px ${FONT}`;
    const periodTextW = ctx.measureText(periodText).width;
    const pillW = periodTextW + 20;
    ctx.fillStyle = rgb(accent, 0.2);
    fillRoundRect(ctx, pad, 78, pillW, 26, 13);
    ctx.fillStyle = rgb(accent);
    ctx.fillText(periodText, pad + 10, 96);
    const providerLabel = getProviderLabel(providerType);
    if (providerLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${13}px ${FONT}`;
      ctx.fillText(providerLabel, pad + pillW + 10, 96);
    }
    const artSize = 190;
    const artX = (w - artSize) / 2;
    const artY = 128;
    if (stats.topTracks[0]) {
      const drew = await drawArt(
        ctx,
        stats.topTracks[0].albumArt,
        artX,
        artY,
        artSize,
        16
      );
      if (!drew) drawPlaceholderArt(ctx, artX, artY, artSize, 16);
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.shadowColor = rgb(accent, 0.4);
      ctx.shadowBlur = 40;
      ctx.fillStyle = "rgba(0,0,0,0)";
      fillRoundRect(ctx, artX, artY, artSize, artSize, 16);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${26}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].trackName, innerW - 40),
        w / 2,
        artY + artSize + 36
      );
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${18}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].artistName, innerW - 40),
        w / 2,
        artY + artSize + 62
      );
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${14}px ${FONT}`;
      ctx.fillText("#1 Most Played", w / 2, artY + artSize + 84);
      ctx.textAlign = "left";
    } else {
      drawPlaceholderArt(ctx, artX, artY, artSize, 16);
    }
    drawAccentDivider(ctx, pad, heroH, innerW, accent);
    let y = heroH + 16;
    const gridGap = 12;
    const cardW = (innerW - gridGap * 2) / 3;
    const cardH = 58;
    drawStatCard(
      ctx,
      pad,
      y,
      cardW,
      cardH,
      formatDurationLong(stats.totalTimeMs),
      "LISTENED",
      accent,
      true
    );
    drawStatCard(
      ctx,
      pad + cardW + gridGap,
      y,
      cardW,
      cardH,
      `${stats.trackCount}`,
      "PLAYS",
      accent
    );
    drawStatCard(
      ctx,
      pad + (cardW + gridGap) * 2,
      y,
      cardW,
      cardH,
      `${stats.uniqueTrackCount}`,
      "UNIQUE TRACKS",
      accent
    );
    const row2Y = y + cardH + gridGap;
    drawStatCard(
      ctx,
      pad,
      row2Y,
      cardW,
      cardH,
      `${stats.uniqueArtistCount}`,
      "ARTISTS",
      accent
    );
    drawStatCard(
      ctx,
      pad + cardW + gridGap,
      row2Y,
      cardW,
      cardH,
      stats.streakDays > 0 ? `${stats.streakDays}d` : "-",
      "STREAK",
      accent,
      stats.streakDays > 0
    );
    drawStatCard(
      ctx,
      pad + (cardW + gridGap) * 2,
      row2Y,
      cardW,
      cardH,
      `${Math.round(stats.skipRate * 100)}%`,
      "SKIP RATE",
      accent
    );
    y = row2Y + cardH + 28;
    const trackCount = Math.min(5, stats.topTracks.length);
    if (trackCount > 0) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 16;
      y = drawSectionHeader(ctx, "Top Tracks", pad, y, accent);
      const trackArtSize = 52;
      const trackRowH = 64;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      fillRoundRect(
        ctx,
        pad - 12,
        y - 8,
        innerW + 24,
        trackRowH * trackCount + 16,
        14
      );
      for (let i = 0; i < trackCount; i++) {
        const t = stats.topTracks[i];
        const rowY = y + i * trackRowH;
        const artY2 = rowY + (trackRowH - trackArtSize) / 2;
        const drew = await drawArt(ctx, t.albumArt, pad, artY2, trackArtSize, 8);
        if (!drew) drawPlaceholderArt(ctx, pad, artY2, trackArtSize, 8);
        const textX = pad + trackArtSize + 14;
        const centerY = rowY + trackRowH / 2;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${14}px ${FONT}`;
        const rk = `${i + 1}`;
        ctx.fillText(rk, textX, centerY - 8);
        const rkW = ctx.measureText(rk).width + 8;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${15}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, t.trackName, rightEdge - textX - rkW - 90),
          textX + rkW,
          centerY - 8
        );
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${12}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, t.artistName, rightEdge - textX - rkW - 90),
          textX + rkW,
          centerY + 10
        );
        if (t.playCount) {
          ctx.fillStyle = rgb(accent);
          ctx.font = `600 ${13}px ${FONT}`;
          ctx.textAlign = "right";
          ctx.fillText(`${t.playCount} plays`, rightEdge, centerY + 1);
          ctx.textAlign = "left";
        }
      }
      y += trackRowH * trackCount + 24;
    }
    const artistCount = Math.min(3, stats.topArtists.length);
    if (artistCount > 0) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 16;
      y = drawSectionHeader(ctx, "Top Artists", pad, y, accent);
      y += 4;
      const artistImgSize = 80;
      const colW = innerW / artistCount;
      for (let i = 0; i < artistCount; i++) {
        const a = stats.topArtists[i];
        const cx = pad + colW * i + colW / 2;
        const imgX = cx - artistImgSize / 2;
        const drew = await drawArt(
          ctx,
          a.artistImage,
          imgX,
          y,
          artistImgSize,
          artistImgSize / 2
        );
        if (!drew)
          drawPlaceholderArt(ctx, imgX, y, artistImgSize, artistImgSize / 2);
        const medalR = 12;
        const medalX = imgX + artistImgSize - medalR + 2;
        const medalY = y + medalR - 2;
        ctx.fillStyle = rankColor(i);
        ctx.beginPath();
        ctx.arc(medalX, medalY, medalR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = `bold ${12}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, medalX, medalY + 4);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${14}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, a.artistName, colW - 16),
          cx,
          y + artistImgSize + 20
        );
        if (a.playCount) {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.font = `${12}px ${FONT}`;
          ctx.fillText(`${a.playCount} plays`, cx, y + artistImgSize + 38);
        }
        ctx.textAlign = "left";
      }
      y += artistImgSize + 56;
    }
    const albumCount = Math.min(5, stats.topAlbums.length);
    if (albumCount > 0) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 16;
      y = drawSectionHeader(ctx, "Top Albums", pad, y, accent);
      const albumArtSize = 52;
      const albumRowH = 64;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      fillRoundRect(
        ctx,
        pad - 12,
        y - 8,
        innerW + 24,
        albumRowH * albumCount + 16,
        14
      );
      for (let i = 0; i < albumCount; i++) {
        const a = stats.topAlbums[i];
        const rowY = y + i * albumRowH;
        const artY2 = rowY + (albumRowH - albumArtSize) / 2;
        const drew = await drawArt(ctx, a.albumArt, pad, artY2, albumArtSize, 8);
        if (!drew) drawPlaceholderArt(ctx, pad, artY2, albumArtSize, 8);
        const textX = pad + albumArtSize + 14;
        const centerY = rowY + albumRowH / 2;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${14}px ${FONT}`;
        const rk = `${i + 1}`;
        ctx.fillText(rk, textX, centerY - 8);
        const rkW = ctx.measureText(rk).width + 8;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${15}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, a.albumName, rightEdge - textX - rkW - 20),
          textX + rkW,
          centerY - 8
        );
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${12}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, a.artistName, rightEdge - textX - rkW - 20),
          textX + rkW,
          centerY + 10
        );
        if (a.playCount) {
          ctx.fillStyle = rgb(accent);
          ctx.font = `600 ${13}px ${FONT}`;
          ctx.textAlign = "right";
          ctx.fillText(`${a.playCount} plays`, rightEdge, centerY + 1);
          ctx.textAlign = "left";
        }
      }
      y += albumRowH * albumCount + 24;
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
      ctx.fillText("When I Listen", pad + 18, y + 18);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${13}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(
        `Peak: ${formatHourLabel(stats.peakHour)}`,
        rightEdge - 8,
        y + 18
      );
      ctx.textAlign = "left";
      y += 36;
      drawHourlyChart(
        ctx,
        stats.hourlyDistribution,
        pad,
        y,
        innerW,
        120,
        accent,
        stats.peakHour
      );
      y += 120 + 16;
    }
    if (stats.topGenres.length > 0) {
      drawAccentDivider(ctx, pad, y, innerW, accent);
      y += 20;
      drawGenrePills(ctx, stats.topGenres, pad, y, innerW, accent);
      y += 44;
    }
    drawNoiseTexture(ctx, 0, 0, w, h, 0.025);
    const topBar = ctx.createLinearGradient(0, 0, w, 0);
    topBar.addColorStop(0, rgb(accent));
    topBar.addColorStop(1, rgb(accent, 0.3));
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, w, 4);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = `${13}px ${FONT}`;
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
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, w, h);
    const leftW = 420;
    if (heroImg) {
      drawBlurredBackground(ctx, heroImg, 0, 0, leftW, h, 40);
    }
    const leftOverlay = ctx.createLinearGradient(0, 0, leftW, 0);
    leftOverlay.addColorStop(0, "rgba(0,0,0,0.45)");
    leftOverlay.addColorStop(0.8, "rgba(10,10,15,0.75)");
    leftOverlay.addColorStop(1, "rgba(10,10,15,0.95)");
    ctx.fillStyle = leftOverlay;
    ctx.fillRect(0, 0, leftW, h);
    ctx.fillStyle = rgb(accent, 0.3);
    ctx.fillRect(leftW - 1, 0, 2, h);
    const username = getUsername2(providerType);
    const leftTitle = username ? `@${username}` : "";
    if (leftTitle) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `500 ${14}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(leftTitle, leftW / 2, 30);
      ctx.textAlign = "left";
    }
    const lArtSize = 170;
    const lArtX = (leftW - lArtSize) / 2;
    const lArtY = leftTitle ? 48 : 40;
    if (stats.topTracks[0]) {
      const drew = await drawArt(
        ctx,
        stats.topTracks[0].albumArt,
        lArtX,
        lArtY,
        lArtSize,
        12
      );
      if (!drew) drawPlaceholderArt(ctx, lArtX, lArtY, lArtSize, 12);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${20}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].trackName, leftW - 48),
        leftW / 2,
        lArtY + lArtSize + 30
      );
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${14}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, stats.topTracks[0].artistName, leftW - 48),
        leftW / 2,
        lArtY + lArtSize + 52
      );
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${11}px ${FONT}`;
      ctx.fillText("#1 Most Played", leftW / 2, lArtY + lArtSize + 70);
      ctx.textAlign = "left";
    } else {
      drawPlaceholderArt(ctx, lArtX, lArtY, lArtSize, 12);
    }
    const lStatY = 370;
    const lStatW = 160;
    const lStatH = 48;
    const lStatGap = 10;
    const lStatX = (leftW - lStatW * 2 - lStatGap) / 2;
    drawStatCard(
      ctx,
      lStatX,
      lStatY,
      lStatW,
      lStatH,
      formatDuration(stats.totalTimeMs),
      "LISTENED",
      accent,
      true
    );
    drawStatCard(
      ctx,
      lStatX + lStatW + lStatGap,
      lStatY,
      lStatW,
      lStatH,
      `${stats.trackCount}`,
      "PLAYS",
      accent
    );
    drawStatCard(
      ctx,
      lStatX,
      lStatY + lStatH + lStatGap,
      lStatW,
      lStatH,
      `${stats.uniqueArtistCount}`,
      "ARTISTS",
      accent
    );
    drawStatCard(
      ctx,
      lStatX + lStatW + lStatGap,
      lStatY + lStatH + lStatGap,
      lStatW,
      lStatH,
      stats.streakDays > 0 ? `${stats.streakDays}d` : `${Math.round(stats.skipRate * 100)}%`,
      stats.streakDays > 0 ? "STREAK" : "SKIP RATE",
      accent,
      stats.streakDays > 0
    );
    if (stats.topGenres.length > 0) {
      drawGenrePills(
        ctx,
        stats.topGenres,
        lStatX,
        lStatY + (lStatH + lStatGap) * 2 + 8,
        leftW - lStatX * 2,
        accent
      );
    }
    const rPad = 32;
    const rX = leftW + rPad;
    const rInnerW = w - rX - rPad;
    const rTitle = username ? `${username}'s Stats` : "My Listening Stats";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${22}px ${FONT}`;
    ctx.fillText(truncateText(ctx, rTitle, rInnerW - 120), rX, 32);
    const periodText = getPeriodDisplayName(period);
    ctx.font = `600 ${12}px ${FONT}`;
    const pTextW = ctx.measureText(periodText).width;
    const pPillW = pTextW + 16;
    ctx.fillStyle = rgb(accent, 0.2);
    fillRoundRect(ctx, rX, 42, pPillW, 22, 11);
    ctx.fillStyle = rgb(accent);
    ctx.fillText(periodText, rX + 8, 56);
    const providerLabel = getProviderLabel(providerType);
    if (providerLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${11}px ${FONT}`;
      ctx.fillText(providerLabel, rX + pPillW + 8, 56);
    }
    const rColW = (rInnerW - 20) / 2;
    const rCol1X = rX;
    const rCol2X = rX + rColW + 20;
    let ry = 78;
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(rCol1X + 4, ry + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14}px ${FONT}`;
    ctx.fillText("Top Tracks", rCol1X + 14, ry + 11);
    ry += 22;
    const rArtSize = 34;
    const rRowH = 44;
    const rTrackCount = Math.min(5, stats.topTracks.length);
    for (let i = 0; i < rTrackCount; i++) {
      const t = stats.topTracks[i];
      const rowY = ry + i * rRowH;
      const artY2 = rowY + (rRowH - rArtSize) / 2;
      const drew = await drawArt(ctx, t.albumArt, rCol1X, artY2, rArtSize, 4);
      if (!drew) drawPlaceholderArt(ctx, rCol1X, artY2, rArtSize, 4);
      const textX = rCol1X + rArtSize + 8;
      const centerY = rowY + rRowH / 2;
      const maxTextW = rCol1X + rColW - textX - 4;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${11}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 5);
      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${11}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, t.trackName, maxTextW - rkW),
        textX + rkW,
        centerY - 5
      );
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${9}px ${FONT}`;
      const meta = t.playCount ? `${t.artistName} \u2022 ${t.playCount}` : t.artistName;
      ctx.fillText(
        truncateText(ctx, meta, maxTextW - rkW),
        textX + rkW,
        centerY + 8
      );
    }
    const rAlbumStart = ry + rRowH * rTrackCount + 12;
    const rAlbumCount = Math.min(5, stats.topAlbums.length);
    if (rAlbumCount > 0) {
      let ay = rAlbumStart;
      ctx.fillStyle = rgb(accent);
      ctx.beginPath();
      ctx.arc(rCol1X + 4, ay + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${14}px ${FONT}`;
      ctx.fillText("Top Albums", rCol1X + 14, ay + 11);
      ay += 22;
      for (let i = 0; i < rAlbumCount; i++) {
        const a = stats.topAlbums[i];
        const rowY = ay + i * rRowH;
        const artY2 = rowY + (rRowH - rArtSize) / 2;
        const drew = await drawArt(ctx, a.albumArt, rCol1X, artY2, rArtSize, 4);
        if (!drew) drawPlaceholderArt(ctx, rCol1X, artY2, rArtSize, 4);
        const textX = rCol1X + rArtSize + 8;
        const centerY = rowY + rRowH / 2;
        const maxTextW = rCol1X + rColW - textX - 4;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${11}px ${FONT}`;
        const rk = `${i + 1}`;
        ctx.fillText(rk, textX, centerY - 5);
        const rkW = ctx.measureText(rk).width + 5;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${11}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, a.albumName, maxTextW - rkW),
          textX + rkW,
          centerY - 5
        );
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = `${9}px ${FONT}`;
        ctx.fillText(
          truncateText(ctx, a.artistName, maxTextW - rkW),
          textX + rkW,
          centerY + 8
        );
      }
    }
    let ry2 = 78;
    ctx.fillStyle = rgb(accent);
    ctx.beginPath();
    ctx.arc(rCol2X + 4, ry2 + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14}px ${FONT}`;
    ctx.fillText("Top Artists", rCol2X + 14, ry2 + 11);
    ry2 += 22;
    const rArtistImgSize = 34;
    const rArtistCount = Math.min(5, stats.topArtists.length);
    for (let i = 0; i < rArtistCount; i++) {
      const a = stats.topArtists[i];
      const rowY = ry2 + i * rRowH;
      const imgY = rowY + (rRowH - rArtistImgSize) / 2;
      const drew = await drawArt(
        ctx,
        a.artistImage,
        rCol2X,
        imgY,
        rArtistImgSize,
        rArtistImgSize / 2
      );
      if (!drew)
        drawPlaceholderArt(ctx, rCol2X, imgY, rArtistImgSize, rArtistImgSize / 2);
      const textX = rCol2X + rArtistImgSize + 8;
      const centerY = rowY + rRowH / 2;
      const maxTextW = rCol2X + rColW - textX - 4;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${11}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 1);
      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, a.artistName, maxTextW - rkW),
        textX + rkW,
        centerY - 1
      );
      if (a.playCount) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `${9}px ${FONT}`;
        ctx.fillText(`${a.playCount} plays`, textX + rkW, centerY + 12);
      }
    }
    ry2 += rRowH * rArtistCount + 16;
    if (stats.hourlyDistribution.some((v) => v > 0)) {
      ctx.fillStyle = rgb(accent);
      ctx.beginPath();
      ctx.arc(rCol2X + 4, ry2 + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${14}px ${FONT}`;
      ctx.fillText("Activity", rCol2X + 14, ry2 + 11);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${11}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(
        `Peak: ${formatHourLabel(stats.peakHour)}`,
        rCol2X + rColW,
        ry2 + 11
      );
      ctx.textAlign = "left";
      ry2 += 22;
      const chartH = Math.min(h - ry2 - 30, 100);
      if (chartH > 30) {
        drawHourlyChart(
          ctx,
          stats.hourlyDistribution,
          rCol2X,
          ry2,
          rColW,
          chartH,
          accent,
          stats.peakHour
        );
      }
    }
    drawNoiseTexture(ctx, 0, 0, w, h, 0.02);
    const topBar = ctx.createLinearGradient(0, 0, w, 0);
    topBar.addColorStop(0, rgb(accent));
    topBar.addColorStop(1, rgb(accent, 0.3));
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = `${11}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Listening Stats for Spicetify", w / 2, h - 10);
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
  var { useState: useState5, useRef: useRef2, useEffect: useEffect3 } = Spicetify.React;
  function ShareCardModal({
    stats,
    period,
    providerType,
    onClose
  }) {
    const [format, setFormat] = useState5("story");
    const [generating, setGenerating] = useState5(false);
    const [previewUrl, setPreviewUrl] = useState5(null);
    const blobRef = useRef2(null);
    useEffect3(() => {
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

.stats-dev-note {
  font-size: 12px;
  color: var(--text-subdued);
  margin: 0;
  margin-top: 2px;
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
}

.overview-card {
  background: var(--background-tinted-base);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
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
  min-height: 400px;
  display: flex;
  flex-direction: column;
  flex: 1 1 300px;
  min-width: 280px;
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
}

.heart-btn:hover {
  color: var(--text-base);
  background: rgba(255, 255, 255, 0.1);
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
}

.activity-bar.peak {
  background: var(--ls-accent);
}

.activity-bar:hover {
  background: var(--ls-accent);
}

.activity-bar-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--background-elevated-base);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.activity-bar:hover .activity-bar-tooltip {
  opacity: 1;
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
  min-height: 400px;
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
  white-space: pre-wrap;
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
  margin-bottom: 16px;
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
  max-width: 480px;
  width: 90%;
  max-height: 85vh;
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
  var SFM_PROMO_KEY = "listening-stats:sfm-promo-dismissed";
  var VERSION = getCurrentVersion();
  var StatsPage = class extends Spicetify.React.Component {
    constructor(props) {
      super(props);
      this.pollInterval = null;
      this.unsubStatsUpdate = null;
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
        this.setState({ loading: true, error: null });
        try {
          const data = await calculateStats(this.state.period);
          this.setState({ stats: data, loading: false });
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
          this.setState({
            loading: false,
            error: e.message || "Failed to load stats"
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
          saveConfig2({ username: info.customId });
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
          this.setState(
            {
              providerType: provider.type,
              period: provider.defaultPeriod,
              stats: null,
              loading: true,
              showSettings: false
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
    }
    componentWillUnmount() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.unsubStatsUpdate?.();
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
      const sfmPromoPortal = showSfmPromo ? Spicetify.ReactDOM.createPortal(
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
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(
          Header,
          {
            onToggleSettings: () => this.setState({ showSettings: !showSettings }),
            providerType
          }
        ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-state" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-message" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Something went wrong"), /* @__PURE__ */ Spicetify.React.createElement("p", null, error), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: this.loadStats }, "Try Again"))), /* @__PURE__ */ Spicetify.React.createElement(
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
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(
        Header,
        {
          onShare: this.handleShare,
          onToggleSettings: () => this.setState({ showSettings: !showSettings }),
          providerType
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(
        OverviewCards,
        {
          stats,
          period,
          periods,
          periodLabels,
          onPeriodChange: this.handlePeriodChange
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(
        TopLists,
        {
          stats,
          likedTracks,
          onLikeToggle: this.handleLikeToggle,
          showLikeButtons,
          period
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(
        ActivityChart,
        {
          hourlyDistribution: stats.hourlyDistribution,
          peakHour: stats.peakHour,
          hourlyUnit: stats.hourlyUnit
        }
      ), /* @__PURE__ */ Spicetify.React.createElement(RecentlyPlayed, { recentTracks: stats.recentTracks }), /* @__PURE__ */ Spicetify.React.createElement(
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
      ), sfmPromoPortal);
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
