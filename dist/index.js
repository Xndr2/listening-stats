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

  // src/services/spotify-api.ts
  var STORAGE_PREFIX = "listening-stats:";
  var QUEUE_DELAY_MS = 300;
  var MAX_BATCH = 50;
  var CACHE_TTL_MS = 3e5;
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
    localStorage.setItem(`${STORAGE_PREFIX}rateLimitedUntil`, rateLimitedUntil.toString());
  }
  var cache = /* @__PURE__ */ new Map();
  function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }
  function setCache(key, data) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  function clearApiCaches() {
    cache.clear();
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
    const cached = getCached(url);
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
        const err = new Error(response.error.message || `Spotify API error ${status}`);
        err.status = status;
        if (status === 429) setRateLimit(response);
        throw err;
      }
      setCache(url, response);
      return response;
    });
  }
  async function getTopTracks(timeRange) {
    const response = await apiFetch(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`
    );
    return response?.items || [];
  }
  async function getTopArtists(timeRange) {
    const response = await apiFetch(
      `https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=50`
    );
    return response?.items || [];
  }
  async function getRecentlyPlayed() {
    return apiFetch(
      `https://api.spotify.com/v1/me/player/recently-played?limit=50`
    );
  }
  function prefetchPeriod(period) {
    getTopTracks(period).catch(() => {
    });
    getTopArtists(period).catch(() => {
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
  var STORAGE_KEY = "listening-stats:pollingData";
  var POLL_INTERVAL_MS = 15 * 60 * 1e3;
  var SKIP_THRESHOLD_MS = 3e4;
  var STATS_UPDATED_EVENT = "listening-stats:updated";
  var activeProviderType = null;
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
      const stored = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("[ListeningStats] Failed to save polling data:", error);
    }
  }
  function clearPollingData() {
    localStorage.removeItem(STORAGE_KEY);
  }
  async function seedKnownArtists(data) {
    if (data.seeded) return;
    try {
      const artists = await getTopArtists("long_term");
      if (!artists || !artists.length) return;
      const knownSet = new Set(data.knownArtistUris);
      for (const a of artists) {
        const uri = `spotify:artist:${a.id}`;
        knownSet.add(uri);
      }
      data.knownArtistUris = Array.from(knownSet);
      data.seeded = true;
      savePollingData(data);
    } catch (error) {
      console.warn("[ListeningStats] Failed to seed known artists:", error);
    }
  }
  async function pollRecentlyPlayed() {
    try {
      const response = await getRecentlyPlayed();
      if (!response?.items?.length) return;
      const data = getPollingData();
      const lastPoll = data.lastPollTimestamp;
      const knownSet = new Set(data.knownArtistUris);
      const dateSet = new Set(data.activityDates);
      for (const item of response.items) {
        const playedAt = new Date(item.played_at).getTime();
        if (lastPoll > 0 && playedAt <= lastPoll) continue;
        const track = item.track;
        if (!track) continue;
        const hour = new Date(item.played_at).getHours();
        data.hourlyDistribution[hour] += track.duration_ms;
        const dateKey = new Date(item.played_at).toISOString().split("T")[0];
        dateSet.add(dateKey);
        data.trackPlayCounts[track.uri] = (data.trackPlayCounts[track.uri] || 0) + 1;
        const artistUri = track.artists?.[0]?.uri;
        if (artistUri) {
          data.artistPlayCounts[artistUri] = (data.artistPlayCounts[artistUri] || 0) + 1;
          knownSet.add(artistUri);
        }
      }
      data.activityDates = Array.from(dateSet);
      data.knownArtistUris = Array.from(knownSet);
      const latestTimestamp = Math.max(
        ...response.items.map((item) => new Date(item.played_at).getTime())
      );
      if (latestTimestamp > data.lastPollTimestamp) {
        data.lastPollTimestamp = latestTimestamp;
      }
      savePollingData(data);
      emitStatsUpdated();
    } catch (error) {
      console.warn("[ListeningStats] Poll failed:", error);
    }
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
      if (totalPlayedMs < SKIP_THRESHOLD_MS && currentTrackDuration > SKIP_THRESHOLD_MS) {
        data.skipEvents++;
      }
      savePollingData(data);
      if (activeProviderType === "local") {
        writePlayEvent(totalPlayedMs);
      }
    }
    const playerData = Spicetify.Player.data;
    if (playerData?.item) {
      currentTrackUri = playerData.item.uri;
      currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
      playStartTime = Date.now();
      accumulatedPlayTime = 0;
      isPlaying = !playerData.isPaused;
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
    emitStatsUpdated();
  }
  function handlePlayPause() {
    const wasPlaying = isPlaying;
    isPlaying = !Spicetify.Player.data?.isPaused;
    if (!currentTrackUri || playStartTime === null) return;
    if (wasPlaying && !isPlaying) {
      accumulatedPlayTime += Date.now() - playStartTime;
    } else if (!wasPlaying && isPlaying) {
      playStartTime = Date.now();
    }
  }
  var pollIntervalId = null;
  var activeSongChangeHandler = null;
  function initPoller(providerType) {
    activeProviderType = providerType;
    if (providerType === "local") {
      captureCurrentTrackData();
      activeSongChangeHandler = () => {
        handleSongChange();
        captureCurrentTrackData();
      };
    } else {
      activeSongChangeHandler = handleSongChange;
    }
    Spicetify.Player.addEventListener("songchange", activeSongChangeHandler);
    Spicetify.Player.addEventListener("onplaypause", handlePlayPause);
    const playerData = Spicetify.Player.data;
    if (playerData?.item) {
      currentTrackUri = playerData.item.uri;
      currentTrackDuration = playerData.item.duration?.milliseconds || Spicetify.Player.getDuration() || 0;
      playStartTime = Date.now();
      isPlaying = !playerData.isPaused;
    }
    if (providerType === "spotify") {
      setTimeout(() => {
        const data = getPollingData();
        seedKnownArtists(data).then(() => pollRecentlyPlayed());
      }, 5e3);
      pollIntervalId = window.setInterval(pollRecentlyPlayed, POLL_INTERVAL_MS);
    }
  }
  function destroyPoller() {
    if (activeSongChangeHandler) {
      Spicetify.Player.removeEventListener("songchange", activeSongChangeHandler);
      activeSongChangeHandler = null;
    }
    Spicetify.Player.removeEventListener("onplaypause", handlePlayPause);
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    activeProviderType = null;
    previousTrackData = null;
  }

  // src/services/lastfm.ts
  var LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
  var STORAGE_KEY2 = "listening-stats:lastfm";
  var CACHE_TTL_MS2 = 3e5;
  var configCache = void 0;
  function getConfig() {
    if (configCache !== void 0) return configCache;
    try {
      const stored = localStorage.getItem(STORAGE_KEY2);
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
    localStorage.setItem(STORAGE_KEY2, JSON.stringify(config));
  }
  function clearConfig() {
    configCache = null;
    localStorage.removeItem(STORAGE_KEY2);
  }
  function isConnected() {
    const config = getConfig();
    return !!(config?.username && config?.apiKey);
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
  function clearLastfmCache() {
    cache2.clear();
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
    const cached = getCached2(cacheKey);
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
    setCache2(cacheKey, data);
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
  function mapPeriod(period) {
    switch (period) {
      case "short_term":
        return "1month";
      case "medium_term":
        return "6month";
      case "long_term":
        return "overall";
    }
  }
  async function getTopTracks2(period, limit = 200) {
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
  async function getTopArtists2(period, limit = 100) {
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
  function normalize(s) {
    return s.toLowerCase().trim().replace(/\s*\(feat\.?.*?\)/gi, "").replace(/\s*\[.*?\]/g, "").replace(/['']/g, "'").replace(/[^\w\s']/g, "").replace(/\s+/g, " ");
  }
  function makeTrackKey(artist, track) {
    return `${normalize(artist)}|||${normalize(track)}`;
  }
  function buildTrackPlayCountMap(input) {
    const tracks = Array.isArray(input) ? input : input.tracks;
    const map = /* @__PURE__ */ new Map();
    for (const t of tracks) {
      map.set(makeTrackKey(t.artist, t.name), t.playCount);
    }
    return map;
  }
  function buildArtistPlayCountMap(input) {
    const artists = Array.isArray(input) ? input : input.artists;
    const map = /* @__PURE__ */ new Map();
    for (const a of artists) {
      map.set(normalize(a.name), a.playCount);
    }
    return map;
  }
  function buildAlbumPlayCountMap(input) {
    const albums = Array.isArray(input) ? input : input.albums;
    const map = /* @__PURE__ */ new Map();
    for (const a of albums) {
      map.set(`${normalize(a.artist)}|||${normalize(a.name)}`, a.playCount);
    }
    return map;
  }

  // src/services/providers/spotify.ts
  var PERIODS = ["recent", "short_term", "medium_term", "long_term"];
  var PERIOD_LABELS = {
    recent: "Recent",
    short_term: "4 Weeks",
    medium_term: "6 Months",
    long_term: "All Time"
  };
  function createSpotifyProvider() {
    return {
      type: "spotify",
      periods: [...PERIODS],
      periodLabels: PERIOD_LABELS,
      defaultPeriod: "recent",
      init() {
        initPoller("spotify");
      },
      destroy() {
        destroyPoller();
      },
      async calculateStats(period) {
        if (period === "recent") {
          return calculateRecentStats();
        }
        return calculateRankedStats(period);
      },
      prefetchPeriod(period) {
        if (period !== "recent") {
          prefetchPeriod(period);
        }
      }
    };
  }
  async function calculateRecentStats() {
    const lastfmConnected = isConnected();
    const recentFetch = getRecentlyPlayed();
    const lfmInfoFetch = lastfmConnected ? getUserInfo().catch(() => null) : Promise.resolve(null);
    const [response, lfmUserInfo] = await Promise.all([recentFetch, lfmInfoFetch]);
    const items = response?.items || [];
    const pollingData = getPollingData();
    const recentTracks = items.filter((item) => item.track).map((item) => ({
      trackUri: item.track.uri,
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      artistUri: item.track.artists?.[0]?.uri || "",
      albumName: item.track.album?.name || "Unknown Album",
      albumUri: item.track.album?.uri || "",
      albumArt: item.track.album?.images?.[0]?.url,
      durationMs: item.track.duration_ms,
      playedAt: item.played_at
    }));
    const trackMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      const existing = trackMap.get(t.trackUri);
      if (existing) {
        existing.count++;
      } else {
        trackMap.set(t.trackUri, {
          trackUri: t.trackUri,
          trackName: t.trackName,
          artistName: t.artistName,
          albumArt: t.albumArt,
          count: 1,
          durationMs: t.durationMs
        });
      }
    }
    const topTracks = Array.from(trackMap.values()).sort((a, b) => b.count - a.count).slice(0, 10).map((t, i) => ({
      trackUri: t.trackUri,
      trackName: t.trackName,
      artistName: t.artistName,
      albumArt: t.albumArt,
      rank: i + 1,
      totalTimeMs: t.durationMs,
      playCount: pollingData.trackPlayCounts[t.trackUri] || void 0
    }));
    const artistMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      const key = t.artistUri || t.artistName;
      const existing = artistMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        artistMap.set(key, {
          artistUri: t.artistUri,
          artistName: t.artistName,
          count: 1
        });
      }
    }
    const topArtistAggregated = Array.from(artistMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    const artistIds = topArtistAggregated.map((a) => a.artistUri?.split(":")[2]).filter(Boolean);
    const artistDetails = await getArtistsBatch(artistIds);
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
        playCount: pollingData.artistPlayCounts[a.artistUri] || void 0
      };
    });
    const albumMap = /* @__PURE__ */ new Map();
    for (const t of recentTracks) {
      const existing = albumMap.get(t.albumUri);
      if (existing) {
        existing.trackCount++;
      } else {
        albumMap.set(t.albumUri, {
          albumUri: t.albumUri,
          albumName: t.albumName,
          artistName: t.artistName,
          albumArt: t.albumArt,
          trackCount: 1
        });
      }
    }
    const topAlbums = Array.from(albumMap.values()).sort((a, b) => b.trackCount - a.trackCount).slice(0, 10);
    const hourlyDistribution = new Array(24).fill(0);
    for (const t of recentTracks) {
      const hour = new Date(t.playedAt).getHours();
      hourlyDistribution[hour] += t.durationMs;
    }
    for (let h = 0; h < 24; h++) {
      hourlyDistribution[h] += pollingData.hourlyDistribution[h];
    }
    const { genres, topGenres } = aggregateGenres(topArtists);
    const uniqueTrackUris = new Set(recentTracks.map((t) => t.trackUri));
    const uniqueArtistUris = new Set(recentTracks.map((t) => t.artistUri).filter(Boolean));
    const knownSet = new Set(pollingData.knownArtistUris);
    let newArtistsCount = 0;
    for (const uri of uniqueArtistUris) {
      if (!knownSet.has(uri)) newArtistsCount++;
    }
    return {
      totalTimeMs: recentTracks.reduce((sum, t) => sum + t.durationMs, 0),
      trackCount: recentTracks.length,
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
      streakDays: calculateStreak(pollingData.activityDates),
      newArtistsCount,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: new Set(pollingData.activityDates).size,
      lastfmConnected: isConnected(),
      totalScrobbles: lfmUserInfo?.totalScrobbles
    };
  }
  async function calculateRankedStats(period) {
    const lastfmConnected = isConnected();
    const lastfmPeriod = mapPeriod(period);
    const spotifyFetch = Promise.all([
      getTopTracks(period),
      getTopArtists(period),
      getRecentlyPlayed()
    ]);
    const lastfmFetch2 = lastfmConnected ? Promise.all([
      getTopTracks2(lastfmPeriod, 200).catch(() => ({ tracks: [], total: 0 })),
      getTopArtists2(lastfmPeriod, 100).catch(() => ({ artists: [], total: 0 })),
      getTopAlbums(lastfmPeriod, 100).catch(() => ({ albums: [], total: 0 })),
      getUserInfo().catch(() => null)
    ]) : null;
    const [spotify, lastfm] = await Promise.all([spotifyFetch, lastfmFetch2]);
    const [tracks, artists, recentResponse] = spotify;
    const lfmTracks = lastfm?.[0]?.tracks ?? [];
    const lfmArtists = lastfm?.[1]?.artists ?? [];
    const lfmAlbums = lastfm?.[2]?.albums ?? [];
    const lfmUserInfo = lastfm?.[3] ?? null;
    const trackPlayCountMap = buildTrackPlayCountMap(lfmTracks);
    const artistPlayCountMap = buildArtistPlayCountMap(lfmArtists);
    const albumPlayCountMap = buildAlbumPlayCountMap(lfmAlbums);
    const pollingData = getPollingData();
    const topTracks = (tracks || []).slice(0, 10).map((t, i) => {
      const artistName = t.artists?.[0]?.name || "Unknown Artist";
      let playCount;
      if (lastfmConnected && lfmTracks.length > 0) {
        playCount = trackPlayCountMap.get(makeTrackKey(artistName, t.name));
      }
      if (playCount === void 0) {
        playCount = pollingData.trackPlayCounts[t.uri] || void 0;
      }
      return {
        trackUri: t.uri,
        trackName: t.name,
        artistName,
        albumArt: t.album?.images?.[0]?.url,
        rank: i + 1,
        totalTimeMs: t.duration_ms,
        playCount
      };
    });
    const topArtists = (artists || []).slice(0, 10).map((a, i) => {
      let playCount;
      if (lastfmConnected && lfmArtists.length > 0) {
        playCount = artistPlayCountMap.get(normalize(a.name));
      }
      if (playCount === void 0) {
        const uri = `spotify:artist:${a.id}`;
        playCount = pollingData.artistPlayCounts[uri] || void 0;
      }
      return {
        artistUri: `spotify:artist:${a.id}`,
        artistName: a.name,
        artistImage: a.images?.[0]?.url,
        rank: i + 1,
        genres: a.genres || [],
        playCount
      };
    });
    const albumMap = /* @__PURE__ */ new Map();
    for (const t of tracks || []) {
      const albumUri = t.album?.uri;
      if (!albumUri) continue;
      const existing = albumMap.get(albumUri);
      if (existing) {
        existing.trackCount++;
      } else {
        const artistName = t.album.artists?.[0]?.name || "Unknown Artist";
        let playCount;
        if (lastfmConnected && lfmAlbums.length > 0) {
          const key = `${normalize(artistName)}|||${normalize(t.album.name)}`;
          playCount = albumPlayCountMap.get(key);
        }
        albumMap.set(albumUri, {
          albumUri,
          albumName: t.album.name,
          artistName,
          albumArt: t.album.images?.[0]?.url,
          trackCount: 1,
          playCount
        });
      }
    }
    const topAlbums = Array.from(albumMap.values()).sort((a, b) => b.trackCount - a.trackCount).slice(0, 10);
    const recentItems = recentResponse?.items || [];
    const recentTracks = recentItems.filter((item) => item.track).map((item) => ({
      trackUri: item.track.uri,
      trackName: item.track.name,
      artistName: item.track.artists?.[0]?.name || "Unknown Artist",
      artistUri: item.track.artists?.[0]?.uri || "",
      albumName: item.track.album?.name || "Unknown Album",
      albumUri: item.track.album?.uri || "",
      albumArt: item.track.album?.images?.[0]?.url,
      durationMs: item.track.duration_ms,
      playedAt: item.played_at
    }));
    const hourlyDistribution = [...pollingData.hourlyDistribution];
    const { genres, topGenres } = aggregateGenres(topArtists);
    const uniqueArtistUris = new Set(
      (tracks || []).flatMap((t) => t.artists?.map((a) => a.uri) || [])
    );
    const knownSet = new Set(pollingData.knownArtistUris);
    let newArtistsCount = 0;
    for (const a of artists || []) {
      const uri = `spotify:artist:${a.id}`;
      if (!knownSet.has(uri)) newArtistsCount++;
    }
    return {
      totalTimeMs: (tracks || []).reduce((sum, t) => sum + t.duration_ms, 0),
      trackCount: (tracks || []).length,
      uniqueTrackCount: (tracks || []).length,
      uniqueArtistCount: uniqueArtistUris.size,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
      recentTracks,
      genres,
      topGenres,
      streakDays: calculateStreak(pollingData.activityDates),
      newArtistsCount,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: new Set(pollingData.activityDates).size,
      lastfmConnected,
      totalScrobbles: lfmUserInfo?.totalScrobbles
    };
  }
  function aggregateGenres(topArtists) {
    const genreMap = /* @__PURE__ */ new Map();
    for (const a of topArtists) {
      for (const genre of a.genres) {
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      }
    }
    const genres = {};
    for (const [g, c] of genreMap) genres[g] = c;
    const topGenres = Array.from(genreMap.entries()).map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    return { genres, topGenres };
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

  // src/services/providers/lastfm.ts
  var PERIODS2 = ["recent", "7day", "1month", "3month", "6month", "12month", "overall"];
  var PERIOD_LABELS2 = {
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
      periods: [...PERIODS2],
      periodLabels: PERIOD_LABELS2,
      defaultPeriod: "recent",
      init() {
        initPoller("lastfm");
      },
      destroy() {
        destroyPoller();
      },
      async calculateStats(period) {
        if (period === "recent") {
          return calculateRecentStats2();
        }
        return calculateRankedStats2(period);
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
  async function calculateRecentStats2() {
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
    const uniqueTrackNames = new Set(recentTracks.map((t) => `${t.artistName}|||${t.trackName}`));
    const uniqueArtistNames = new Set(recentTracks.map((t) => t.artistName));
    const estimatedTimeMs = recentTracks.length * 210 * 1e3;
    const activityDates = [...new Set(recentTracks.map(
      (t) => new Date(t.playedAt).toISOString().split("T")[0]
    ))];
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
      streakDays: calculateStreak2(activityDates),
      newArtistsCount: 0,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: activityDates.length,
      lastfmConnected: true,
      totalScrobbles: userInfo?.totalScrobbles
    };
  }
  async function calculateRankedStats2(period) {
    const [lfmTracksResult, lfmArtistsResult, lfmAlbumsResult, recentLfm, userInfo] = await Promise.all([
      getTopTracks2(period, 50),
      getTopArtists2(period, 50),
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
    const activityDates = [...new Set(recentTracks.map(
      (t) => new Date(t.playedAt).toISOString().split("T")[0]
    ))];
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
      streakDays: calculateStreak2(activityDates),
      newArtistsCount: 0,
      skipRate: pollingData.totalPlays > 0 ? pollingData.skipEvents / pollingData.totalPlays : 0,
      listenedDays: activityDates.length,
      lastfmConnected: true,
      totalScrobbles: userInfo?.totalScrobbles
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

  // src/services/providers/local.ts
  init_storage();
  var PERIODS3 = ["today", "this_week", "this_month", "all_time"];
  var PERIOD_LABELS3 = {
    today: "Today",
    this_week: "This Week",
    this_month: "This Month",
    all_time: "All Time"
  };
  function createLocalProvider() {
    return {
      type: "local",
      periods: [...PERIODS3],
      periodLabels: PERIOD_LABELS3,
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
    const uniqueArtistUris = new Set(events.map((e) => e.artistUri).filter(Boolean));
    const dateSet = new Set(events.map(
      (e) => new Date(e.startedAt).toISOString().split("T")[0]
    ));
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
      streakDays: calculateStreak3(Array.from(dateSet)),
      newArtistsCount: 0,
      skipRate: events.length > 0 ? skipEvents / events.length : 0,
      listenedDays: dateSet.size,
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
  var STORAGE_KEY3 = "listening-stats:provider";
  var activeProvider = null;
  function getSelectedProviderType() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY3);
      if (stored === "local" || stored === "spotify" || stored === "lastfm") {
        return stored;
      }
    } catch {
    }
    return null;
  }
  function setSelectedProviderType(type) {
    localStorage.setItem(STORAGE_KEY3, type);
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
      case "spotify":
        activeProvider = createSpotifyProvider();
        break;
      case "lastfm":
        activeProvider = createLastfmProvider();
        break;
      case "local":
        activeProvider = createLocalProvider();
        break;
    }
    if (!skipInit) {
      activeProvider.init();
    }
  }

  // src/services/stats.ts
  var statsCache = /* @__PURE__ */ new Map();
  var STATS_CACHE_TTL = 3e5;
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
  var STORAGE_KEY4 = "listening-stats:lastUpdateCheck";
  var INSTALL_CMD_LINUX = `curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash`;
  var INSTALL_CMD_WINDOWS = `iwr -useb 'https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1' | iex`;
  function getCurrentVersion() {
    try {
      return "1.2.1";
    } catch {
      return "0.0.0";
    }
  }
  async function checkForUpdates() {
    const currentVersion = getCurrentVersion();
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch release info");
      }
      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const distAsset = release.assets.find(
        (a) => a.name === "listening-stats.zip" || a.name === "dist.zip" || a.name.endsWith(".zip")
      );
      const available = isNewerVersion(latestVersion, currentVersion);
      localStorage.setItem(STORAGE_KEY4, JSON.stringify({
        checkedAt: Date.now(),
        latestVersion,
        available
      }));
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

  // src/app/components/UpdateBanner.tsx
  function UpdateBanner({
    updateInfo,
    commandCopied,
    onDismiss,
    onCopyCommand
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-container" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-icon" }, "\u{1F389}"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-title" }, "Update Available!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-version" }, "v", updateInfo.currentVersion, " \u2192 v", updateInfo.latestVersion)), updateInfo.changelog && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-changelog" }, updateInfo.changelog), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "update-banner-actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "update-banner-btn secondary", onClick: onDismiss }, "I'll do this later"), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: `update-banner-btn primary ${commandCopied ? "copied" : ""}`,
        onClick: onCopyCommand
      },
      commandCopied ? "\u2713 Copied!" : "\u{1F4CB} Copy Command"
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "updating-text" }, "Paste the command in your terminal, then restart Spotify."))));
  }

  // src/app/components/Footer.tsx
  function Footer({
    version,
    updateInfo,
    onShowUpdate
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-footer" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "version-text" }, "v", version, " - made with love by", " ", /* @__PURE__ */ Spicetify.React.createElement("a", { href: "https://github.com/Xndr2/listening-stats" }, "Xndr")), updateInfo?.available && /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: onShowUpdate }, "Update v", updateInfo.latestVersion));
  }

  // src/app/components/SettingsPanel.tsx
  init_storage();

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
      lines.push(`${t.rank},"${t.trackName.replace(/"/g, '""')}","${t.artistName.replace(/"/g, '""')}",${t.playCount || 0}`);
    }
    lines.push("");
    lines.push("Top Artists");
    lines.push("Rank,Artist,Genres,Play Count");
    for (const a of stats.topArtists) {
      lines.push(`${a.rank},"${a.artistName.replace(/"/g, '""')}","${(a.genres || []).join("; ")}",${a.playCount || 0}`);
    }
    lines.push("");
    lines.push("Top Albums");
    lines.push("Album,Artist,Play Count");
    for (const a of stats.topAlbums) {
      lines.push(`"${a.albumName.replace(/"/g, '""')}","${a.artistName.replace(/"/g, '""')}",${a.playCount || 0}`);
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
    lines.push("Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At");
    for (const e of events) {
      lines.push([
        `"${e.trackName.replace(/"/g, '""')}"`,
        `"${e.artistName.replace(/"/g, '""')}"`,
        `"${e.albumName.replace(/"/g, '""')}"`,
        e.durationMs,
        e.playedMs,
        new Date(e.startedAt).toISOString(),
        new Date(e.endedAt).toISOString()
      ].join(","));
    }
    const filename = `listening-stats-raw-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    downloadFile(lines.join("\n"), filename, "text/csv");
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

  // src/app/components/SettingsPanel.tsx
  var { useState } = Spicetify.React;
  var PROVIDER_NAMES = {
    local: "Local Tracking",
    spotify: "Spotify API",
    lastfm: "Last.fm"
  };
  function SettingsPanel({
    onRefresh,
    onCheckUpdates,
    onProviderChanged,
    onClose,
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
        const info = await validateUser(lfmUsername.trim(), lfmApiKey.trim());
        saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
        switchProvider("lastfm");
      } catch (err) {
        setLfmError(err.message || "Connection failed");
      } finally {
        setLfmValidating(false);
      }
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
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Data Source"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-current" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "Currently using: ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, currentProvider ? PROVIDER_NAMES[currentProvider] : "None")), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => setShowProviderPicker(!showProviderPicker)
      },
      "Change"
    )), showProviderPicker && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-provider-picker" }, lfmConnected || currentProvider === "lastfm" ? /* @__PURE__ */ Spicetify.React.createElement(
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
    ))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-row" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: () => {
      clearStatsCache();
      onRefresh();
    } }, "Refresh"), /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn",
        onClick: () => {
          resetRateLimit();
          clearApiCaches();
          clearStatsCache();
          clearLastfmCache();
          Spicetify.showNotification("Cache cleared");
        }
      },
      "Clear Cache"
    ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: onCheckUpdates }, "Check Updates"), currentProvider === "local" && /* @__PURE__ */ Spicetify.React.createElement(
      "button",
      {
        className: "footer-btn danger",
        onClick: () => {
          if (confirm("Delete all local tracking data? This cannot be undone.")) {
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
    )))), currentProvider === "lastfm" && lfmConnected && lfmConfig && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm" }, /* @__PURE__ */ Spicetify.React.createElement("h4", { className: "settings-section-title" }, "Last.fm Account"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-connected" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-lastfm-info" }, /* @__PURE__ */ Spicetify.React.createElement(
      "span",
      {
        className: "lastfm-status-icon",
        dangerouslySetInnerHTML: { __html: Icons.check }
      }
    ), /* @__PURE__ */ Spicetify.React.createElement("span", null, "Connected as ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, lfmConfig.username))), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn danger", onClick: () => {
      handleLfmDisconnect();
      switchProvider("local");
    } }, "Disconnect"))));
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
  function AnimatedNumber({ value, duration = 800, format }) {
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
        setDisplay(format ? format(Math.round(current)) : String(Math.round(current)));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      requestAnimationFrame(animate);
    }, [value, duration]);
    return /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, display);
  }

  // src/app/components/PeriodTabs.tsx
  function PeriodTabs({ period, periods, periodLabels, onPeriodChange }) {
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
  function OverviewCards({ stats, period, periods, periodLabels, onPeriodChange }) {
    const payout = estimateArtistPayout(stats.trackCount);
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card hero" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value" }, formatDurationLong(stats.totalTimeMs)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Time Listened"), /* @__PURE__ */ Spicetify.React.createElement(PeriodTabs, { period, periods, periodLabels, onPeriodChange }), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-secondary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.trackCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueArtistCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, /* @__PURE__ */ Spicetify.React.createElement(AnimatedNumber, { value: stats.uniqueTrackCount })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Unique")), stats.lastfmConnected && stats.totalScrobbles ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, stats.totalScrobbles.toLocaleString()), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Scrobbles")) : null)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value green" }, "$", payout), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Spotify paid artists"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "From you listening to their music!")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value orange" }, stats.streakDays), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Day Streak"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Resets at midnight local time.")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, stats.newArtistsCount > 0 ? /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, stats.newArtistsCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "New Artists"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "You're cool if this is high!")) : /* @__PURE__ */ Spicetify.React.createElement(Spicetify.React.Fragment, null, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, stats.listenedDays), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Days Listened"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Days with at least one play."))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value red" }, Math.floor(stats.skipRate * 100), "%"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Skip Rate"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label-tooltip" }, "Get this as low as possible!"))))));
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
      /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, t.playCount ? /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, t.playCount, " plays") : null, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(t.totalTimeMs))),
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
    const handleLastfmSelect = async () => {
      if (!lfmUsername.trim() || !lfmApiKey.trim()) {
        setLfmError("Both username and API key are required");
        return;
      }
      setLfmValidating(true);
      setLfmError("");
      try {
        const info = await validateUser(lfmUsername.trim(), lfmApiKey.trim());
        saveConfig({ username: info.username, apiKey: lfmApiKey.trim() });
        activateProvider("lastfm");
        onProviderSelected();
      } catch (err) {
        setLfmError(err.message || "Connection failed");
      } finally {
        setLfmValidating(false);
      }
    };
    const handleLocalSelect = () => {
      activateProvider("local");
      onProviderSelected();
    };
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-screen" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-header" }, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "setup-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "setup-subtitle" }, "Connect your Last.fm account to get started")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-main" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card primary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-card-icon" }, /* @__PURE__ */ Spicetify.React.createElement("svg", { viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ Spicetify.React.createElement("path", { d: "M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.422 0 3.19 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.284 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.932l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" }))), /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Last.fm"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "setup-card-desc" }, "Accurate play counts and listening history across all your devices."), /* @__PURE__ */ Spicetify.React.createElement("ul", { className: "setup-card-pros" }, /* @__PURE__ */ Spicetify.React.createElement("li", null, "Accurate play counts"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Tracks across all devices"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "7 time period options")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "setup-lastfm-form" }, /* @__PURE__ */ Spicetify.React.createElement(
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
  function ActivityChart({ hourlyDistribution, peakHour, hourlyUnit = "ms" }) {
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

  // src/app/components/GenreTimeline.tsx
  var { useState: useState5, useEffect: useEffect3 } = Spicetify.React;
  var GENRE_COLORS = [
    "#1db954",
    "#1e90ff",
    "#9b59b6",
    "#e74c3c",
    "#f39c12",
    "#00bcd4",
    "#e91e63",
    "#8bc34a"
  ];
  function GenreTimeline() {
    const [data, setData] = useState5([]);
    useEffect3(() => {
      loadGenreData();
    }, []);
    async function loadGenreData() {
      const provider = getActiveProvider();
      if (!provider) return;
      const periods = provider.periods;
      let selectedPeriods;
      if (provider.type === "local") {
        selectedPeriods = ["this_week", "this_month", "all_time"].filter((p) => periods.includes(p));
      } else if (provider.type === "spotify") {
        selectedPeriods = ["short_term", "medium_term", "long_term"].filter((p) => periods.includes(p));
      } else {
        selectedPeriods = ["1month", "6month", "overall"].filter((p) => periods.includes(p));
      }
      if (selectedPeriods.length === 0) return;
      try {
        const results = await Promise.all(
          selectedPeriods.map(async (p) => {
            const stats = await calculateStats(p);
            return { period: p, stats };
          })
        );
        const colorMap = /* @__PURE__ */ new Map();
        let colorIdx = 0;
        for (const r of results) {
          for (const g of r.stats.topGenres) {
            if (!colorMap.has(g.genre) && colorIdx < GENRE_COLORS.length) {
              colorMap.set(g.genre, GENRE_COLORS[colorIdx++]);
            }
          }
        }
        const periodData = results.map((r) => {
          const total = r.stats.topGenres.reduce((sum, g) => sum + g.count, 0);
          if (total === 0) return { label: provider.periodLabels[r.period] || r.period, genres: [] };
          const genres = r.stats.topGenres.slice(0, 6).map((g) => ({
            genre: g.genre,
            proportion: g.count / total,
            color: colorMap.get(g.genre) || "#666"
          }));
          const shown = genres.reduce((sum, g) => sum + g.proportion, 0);
          if (shown < 0.98 && r.stats.topGenres.length > 6) {
            genres.push({ genre: "other", proportion: 1 - shown, color: "#444" });
          }
          return { label: provider.periodLabels[r.period] || r.period, genres };
        });
        setData(periodData.filter((p) => p.genres.length > 0));
      } catch {
      }
    }
    if (data.length === 0) return null;
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-timeline-section" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "section-title" }, "Genre Trends"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-timeline" }, data.map((period) => /* @__PURE__ */ Spicetify.React.createElement("div", { key: period.label, className: "genre-timeline-row" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "genre-timeline-label" }, period.label), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-timeline-bar" }, period.genres.map((g) => /* @__PURE__ */ Spicetify.React.createElement(
      "div",
      {
        key: g.genre,
        className: "genre-timeline-segment",
        style: { flex: g.proportion, backgroundColor: g.color },
        title: `${g.genre}: ${Math.round(g.proportion * 100)}%`
      }
    )))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "genre-timeline-legend" }, data[0]?.genres.filter((g) => g.genre !== "other").map((g) => /* @__PURE__ */ Spicetify.React.createElement("span", { key: g.genre, className: "genre-timeline-legend-item" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "genre-timeline-dot", style: { backgroundColor: g.color } }), g.genre))));
  }

  // src/app/components/Header.tsx
  var PROVIDER_NAMES2 = {
    local: "Local Tracking",
    spotify: "Spotify API",
    lastfm: "Last.fm"
  };
  function Header({
    onShare,
    onToggleSettings,
    providerType
  }) {
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", null, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "stats-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-subtitle" }, "Your personal music analytics", providerType && /* @__PURE__ */ Spicetify.React.createElement("span", { className: "provider-badge" }, "via ", PROVIDER_NAMES2[providerType])), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-dev-note" }, "Dev note: This is an early build of the new tracking system. Bugs are expected, please report them on", " ", /* @__PURE__ */ Spicetify.React.createElement("a", { href: "https://github.com/Xndr2/listening-stats/issues/new?template=bug_report.md" }, "github"), ".")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "header-actions" }, onToggleSettings && /* @__PURE__ */ Spicetify.React.createElement(
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

/* ============== Phase 2: Trends, Heatmap, Genre Timeline ============== */

/* --- Section title (shared) --- */
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-base);
  margin: 0 0 16px;
}

/* --- Genre Timeline --- */
.genre-timeline-section {
  padding: 24px 32px;
}

.genre-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.genre-timeline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.genre-timeline-label {
  width: 80px;
  font-size: 12px;
  color: var(--text-subdued);
  text-align: right;
  flex-shrink: 0;
}

.genre-timeline-bar {
  flex: 1;
  display: flex;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
}

.genre-timeline-segment {
  min-width: 2px;
  transition: flex 0.3s ease;
}

.genre-timeline-segment:hover {
  opacity: 0.85;
}

.genre-timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.genre-timeline-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-subdued);
}

.genre-timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* --- Export buttons in settings --- */
.settings-export {
  margin-bottom: 16px;
}

@media (max-width: 700px) {
  .genre-timeline-section {
    padding: 16px;
  }
  .genre-timeline-label {
    width: 60px;
    font-size: 11px;
  }
}

/* ============== Phase 3: Share Card Modal ============== */

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

/* ============== Phase 4: Animations ============== */

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

  // src/services/share-card.ts
  function getProviderLabel(providerType) {
    if (providerType === "lastfm") return "via Last.fm";
    if (providerType === "local") return "via Local Tracking";
    return "";
  }
  var STORY_W = 1080;
  var STORY_H = 1350;
  var LAND_W = 1200;
  var LAND_H = 630;
  var FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  var GREEN = "#1db954";
  var GREEN_LIGHT = "#1ed760";
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
    while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + "...";
  }
  function rankColor(i) {
    return i === 0 ? GOLD : i === 1 ? SILVER : i === 2 ? BRONZE : "#888";
  }
  function drawBackground(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0d0d0d");
    grad.addColorStop(1, "#111118");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6);
    glow.addColorStop(0, "rgba(29, 185, 84, 0.08)");
    glow.addColorStop(1, "rgba(29, 185, 84, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const accentGrad = ctx.createLinearGradient(0, 0, w, 0);
    accentGrad.addColorStop(0, GREEN);
    accentGrad.addColorStop(1, GREEN_LIGHT);
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, w, 4);
  }
  function drawSectionPanel(ctx, x, y, w, h, r) {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    fillRoundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  function drawSectionTitle(ctx, text, x, y, s) {
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.arc(x + 5 * s, y - 5 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${18 * s}px ${FONT}`;
    ctx.fillText(text, x + 16 * s, y);
  }
  function drawStatPill(ctx, x, y, w, h, value, label, s, valueColor = "#fff") {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = valueColor;
    ctx.font = `bold ${18 * s}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(value, x + w / 2, y + h * 0.42);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${10 * s}px ${FONT}`;
    ctx.fillText(label, x + w / 2, y + h * 0.72);
    ctx.textAlign = "left";
  }
  async function drawArt(ctx, url, x, y, size, radius) {
    if (!url) return false;
    const img = await loadImage(url);
    if (!img) return false;
    ctx.save();
    roundRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
    return true;
  }
  function drawPlaceholderArt(ctx, x, y, size, radius) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, x, y, size, size, radius);
  }
  async function generateStoryCard(stats, period, providerType) {
    const w = STORY_W;
    const h = STORY_H;
    const s = 1;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    drawBackground(ctx, w, h);
    const pad = 48;
    const innerW = w - pad * 2;
    const rightEdge = w - pad;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${38}px ${FONT}`;
    ctx.fillText("My Listening Stats", pad, 60);
    ctx.fillStyle = GREEN;
    ctx.font = `600 ${17}px ${FONT}`;
    const storyPeriodText = getPeriodDisplayName(period);
    ctx.fillText(storyPeriodText, pad, 88);
    const providerLabel = getProviderLabel(providerType);
    if (providerLabel) {
      const periodTextW = ctx.measureText(storyPeriodText).width;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${14}px ${FONT}`;
      ctx.fillText("  \u2022  " + providerLabel, pad + periodTextW, 88);
    }
    const pillY = 110;
    const pillH = 54;
    const pillGap = 10;
    const pillW = (innerW - pillGap * 3) / 4;
    drawStatPill(ctx, pad, pillY, pillW, pillH, formatDurationLong(stats.totalTimeMs), "LISTENED", s);
    drawStatPill(ctx, pad + pillW + pillGap, pillY, pillW, pillH, `${stats.trackCount}`, "TRACKS", s);
    drawStatPill(ctx, pad + (pillW + pillGap) * 2, pillY, pillW, pillH, `${stats.uniqueArtistCount}`, "ARTISTS", s);
    if (stats.streakDays > 0) {
      drawStatPill(ctx, pad + (pillW + pillGap) * 3, pillY, pillW, pillH, `${stats.streakDays}d`, "STREAK", s, GREEN);
    } else {
      drawStatPill(ctx, pad + (pillW + pillGap) * 3, pillY, pillW, pillH, `${Math.floor(stats.skipRate * 100)}%`, "SKIP RATE", s);
    }
    let y = 192;
    if (stats.topGenres.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `500 ${13}px ${FONT}`;
      const genreStr = stats.topGenres.slice(0, 5).map((g) => g.genre).join("   \u2022   ");
      ctx.fillText(truncateText(ctx, genreStr, innerW), pad, y);
      y += 28;
    }
    const N = 5;
    const artSize = 44;
    const trackRowH = 56;
    const panelPad = 14;
    const trackCount = Math.min(N, stats.topTracks.length);
    const trackPanelH = 36 + trackRowH * trackCount + panelPad;
    drawSectionPanel(ctx, pad - 16, y, innerW + 32, trackPanelH, 14);
    let sy = y + 10;
    drawSectionTitle(ctx, "Top Tracks", pad, sy + 18, s);
    sy += 32;
    for (let i = 0; i < trackCount; i++) {
      const t = stats.topTracks[i];
      const rowY = sy + i * trackRowH;
      const artY = rowY + (trackRowH - artSize) / 2;
      const drew = await drawArt(ctx, t.albumArt, pad, artY, artSize, 6);
      if (!drew) drawPlaceholderArt(ctx, pad, artY, artSize, 6);
      const textX = pad + artSize + 12;
      const centerY = rowY + trackRowH / 2;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${14}px ${FONT}`;
      const rankStr = `${i + 1}`;
      ctx.fillText(rankStr, textX, centerY - 7);
      const rankW = ctx.measureText(rankStr).width + 7;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${14}px ${FONT}`;
      ctx.fillText(truncateText(ctx, t.trackName, rightEdge - textX - rankW - 80), textX + rankW, centerY - 7);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${12}px ${FONT}`;
      ctx.fillText(truncateText(ctx, t.artistName, rightEdge - textX - rankW - 80), textX + rankW, centerY + 10);
      if (t.playCount) {
        ctx.fillStyle = GREEN;
        ctx.font = `600 ${12}px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${t.playCount} plays`, rightEdge, centerY + 1);
        ctx.textAlign = "left";
      }
    }
    y += trackPanelH + 16;
    const artistImgSize = 38;
    const artistRowH = 50;
    const artistCount = Math.min(N, stats.topArtists.length);
    const artistPanelH = 36 + artistRowH * artistCount + panelPad;
    drawSectionPanel(ctx, pad - 16, y, innerW + 32, artistPanelH, 14);
    sy = y + 10;
    drawSectionTitle(ctx, "Top Artists", pad, sy + 18, s);
    sy += 32;
    for (let i = 0; i < artistCount; i++) {
      const a = stats.topArtists[i];
      const rowY = sy + i * artistRowH;
      const imgY = rowY + (artistRowH - artistImgSize) / 2;
      const drew = await drawArt(ctx, a.artistImage, pad, imgY, artistImgSize, artistImgSize / 2);
      if (!drew) drawPlaceholderArt(ctx, pad, imgY, artistImgSize, artistImgSize / 2);
      const textX = pad + artistImgSize + 12;
      const centerY = rowY + artistRowH / 2;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${14}px ${FONT}`;
      const rankStr = `${i + 1}`;
      ctx.fillText(rankStr, textX, centerY + 2);
      const rankW = ctx.measureText(rankStr).width + 7;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${15}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.artistName, rightEdge - textX - rankW - 80), textX + rankW, centerY + 2);
      if (a.playCount) {
        ctx.fillStyle = GREEN;
        ctx.font = `600 ${12}px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(`${a.playCount} plays`, rightEdge, centerY + 2);
        ctx.textAlign = "left";
      }
    }
    y += artistPanelH + 16;
    if (stats.topAlbums.length > 0) {
      const albumRowH = 56;
      const albumCount = Math.min(N, stats.topAlbums.length);
      const albumPanelH = 36 + albumRowH * albumCount + panelPad;
      drawSectionPanel(ctx, pad - 16, y, innerW + 32, albumPanelH, 14);
      sy = y + 10;
      drawSectionTitle(ctx, "Top Albums", pad, sy + 18, s);
      sy += 32;
      for (let i = 0; i < albumCount; i++) {
        const a = stats.topAlbums[i];
        const rowY = sy + i * albumRowH;
        const artY = rowY + (albumRowH - artSize) / 2;
        const drew = await drawArt(ctx, a.albumArt, pad, artY, artSize, 6);
        if (!drew) drawPlaceholderArt(ctx, pad, artY, artSize, 6);
        const textX = pad + artSize + 12;
        const centerY = rowY + albumRowH / 2;
        ctx.fillStyle = rankColor(i);
        ctx.font = `bold ${14}px ${FONT}`;
        const rankStr = `${i + 1}`;
        ctx.fillText(rankStr, textX, centerY - 7);
        const rankW = ctx.measureText(rankStr).width + 7;
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${14}px ${FONT}`;
        ctx.fillText(truncateText(ctx, a.albumName, rightEdge - textX - rankW - 20), textX + rankW, centerY - 7);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${12}px ${FONT}`;
        ctx.fillText(truncateText(ctx, a.artistName, rightEdge - textX - rankW - 20), textX + rankW, centerY + 10);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = `${13}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Listening Stats for Spicetify", w / 2, h - 28);
    ctx.textAlign = "left";
    return canvas;
  }
  async function generateLandscapeCard(stats, period, providerType) {
    const w = LAND_W;
    const h = LAND_H;
    const s = 1;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    drawBackground(ctx, w, h);
    const pad = 36;
    const N = 5;
    const headerH = 88;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${24}px ${FONT}`;
    ctx.fillText("My Listening Stats", pad, 36);
    ctx.fillStyle = "rgba(29,185,84,0.15)";
    const periodText = getPeriodDisplayName(period);
    ctx.font = `600 ${12}px ${FONT}`;
    const periodW = ctx.measureText(periodText).width + 14;
    fillRoundRect(ctx, pad, 46, periodW, 20, 10);
    ctx.fillStyle = GREEN;
    ctx.fillText(periodText, pad + 7, 59);
    const landProviderLabel = getProviderLabel(providerType);
    if (landProviderLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${11}px ${FONT}`;
      ctx.fillText(landProviderLabel, pad + periodW + 8, 59);
    }
    const spH = 38;
    const spGap = 8;
    const pillCount = stats.streakDays > 0 ? 4 : 3;
    const spW = 110;
    const pillsRight = w - pad;
    const pillsLeft = pillsRight - pillCount * spW - (pillCount - 1) * spGap;
    drawStatPill(ctx, pillsLeft, 24, spW, spH, formatDuration(stats.totalTimeMs), "LISTENED", s);
    drawStatPill(ctx, pillsLeft + spW + spGap, 24, spW, spH, `${stats.trackCount}`, "TRACKS", s);
    drawStatPill(ctx, pillsLeft + (spW + spGap) * 2, 24, spW, spH, `${stats.uniqueArtistCount}`, "ARTISTS", s);
    if (stats.streakDays > 0) {
      drawStatPill(ctx, pillsLeft + (spW + spGap) * 3, 24, spW, spH, `${stats.streakDays}d`, "STREAK", s, GREEN);
    }
    if (stats.topGenres.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = `${11}px ${FONT}`;
      const genreStr = stats.topGenres.slice(0, 4).map((g) => g.genre).join("  \u2022  ");
      ctx.fillText(truncateText(ctx, genreStr, w - pad * 2), pad, 78);
    }
    const colTop = headerH + 4;
    const colGap = 16;
    const totalColW = w - pad * 2 - colGap * 2;
    const colW = Math.floor(totalColW / 3);
    const col1X = pad;
    const col2X = pad + colW + colGap;
    const col3X = pad + (colW + colGap) * 2;
    const colBottom = h - 32;
    const colH = colBottom - colTop;
    drawSectionPanel(ctx, col1X - 8, colTop, colW + 16, colH, 12);
    drawSectionPanel(ctx, col2X - 8, colTop, colW + 16, colH, 12);
    drawSectionPanel(ctx, col3X - 8, colTop, colW + 16, colH, 12);
    const rowH = Math.floor((colH - 40) / N);
    const artSz = Math.min(34, rowH - 8);
    let cy = colTop + 8;
    drawSectionTitle(ctx, "Top Tracks", col1X, cy + 16, s);
    cy += 30;
    for (let i = 0; i < Math.min(N, stats.topTracks.length); i++) {
      const t = stats.topTracks[i];
      const rowY = cy + i * rowH;
      const artY = rowY + (rowH - artSz) / 2;
      const drew = await drawArt(ctx, t.albumArt, col1X, artY, artSz, 4);
      if (!drew) drawPlaceholderArt(ctx, col1X, artY, artSz, 4);
      const textX = col1X + artSz + 8;
      const centerY = rowY + rowH / 2;
      const maxTextW = col1X + colW - textX - 4;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${12}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 5);
      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.fillText(truncateText(ctx, t.trackName, maxTextW - rkW), textX + rkW, centerY - 5);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${10}px ${FONT}`;
      const meta = t.playCount ? `${t.artistName} \u2022 ${t.playCount} plays` : t.artistName;
      ctx.fillText(truncateText(ctx, meta, maxTextW - rkW), textX + rkW, centerY + 9);
    }
    cy = colTop + 8;
    drawSectionTitle(ctx, "Top Artists", col2X, cy + 16, s);
    cy += 30;
    for (let i = 0; i < Math.min(N, stats.topArtists.length); i++) {
      const a = stats.topArtists[i];
      const rowY = cy + i * rowH;
      const imgY = rowY + (rowH - artSz) / 2;
      const drew = await drawArt(ctx, a.artistImage, col2X, imgY, artSz, artSz / 2);
      if (!drew) drawPlaceholderArt(ctx, col2X, imgY, artSz, artSz / 2);
      const textX = col2X + artSz + 8;
      const centerY = rowY + rowH / 2;
      const maxTextW = col2X + colW - textX - 4;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${12}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY + 1);
      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${13}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.artistName, maxTextW - rkW), textX + rkW, centerY + 1);
      if (a.playCount) {
        ctx.fillStyle = GREEN;
        ctx.font = `${10}px ${FONT}`;
        ctx.fillText(truncateText(ctx, `${a.playCount} plays`, maxTextW - rkW), textX + rkW, centerY + 15);
      }
    }
    cy = colTop + 8;
    drawSectionTitle(ctx, "Top Albums", col3X, cy + 16, s);
    cy += 30;
    for (let i = 0; i < Math.min(N, stats.topAlbums.length); i++) {
      const a = stats.topAlbums[i];
      const rowY = cy + i * rowH;
      const artY = rowY + (rowH - artSz) / 2;
      const drew = await drawArt(ctx, a.albumArt, col3X, artY, artSz, 4);
      if (!drew) drawPlaceholderArt(ctx, col3X, artY, artSz, 4);
      const textX = col3X + artSz + 8;
      const centerY = rowY + rowH / 2;
      const maxTextW = col3X + colW - textX - 4;
      ctx.fillStyle = rankColor(i);
      ctx.font = `bold ${12}px ${FONT}`;
      const rk = `${i + 1}`;
      ctx.fillText(rk, textX, centerY - 5);
      const rkW = ctx.measureText(rk).width + 5;
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${12}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.albumName, maxTextW - rkW), textX + rkW, centerY - 5);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${10}px ${FONT}`;
      ctx.fillText(truncateText(ctx, a.artistName, maxTextW - rkW), textX + rkW, centerY + 9);
    }
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
        const file = new File([blob], "listening-stats.png", { type: "image/png" });
        await navigator.share({ files: [file] });
        return "shared";
      } catch {
      }
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
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
  var { useState: useState6, useRef: useRef2, useEffect: useEffect4 } = Spicetify.React;
  function ShareCardModal({ stats, period, providerType, onClose }) {
    const [format, setFormat] = useState6("story");
    const [generating, setGenerating] = useState6(false);
    const [previewUrl, setPreviewUrl] = useState6(null);
    const blobRef = useRef2(null);
    useEffect4(() => {
      generatePreview();
    }, [format]);
    async function generatePreview() {
      setGenerating(true);
      try {
        const blob = await generateShareCard({ stats, period, format, providerType });
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
    return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-modal-overlay", onClick: (e) => {
      if (e.target.classList.contains("share-modal-overlay")) onClose();
    } }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-modal" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-modal-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Share Your Stats"), /* @__PURE__ */ Spicetify.React.createElement(
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
    )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-preview" }, generating ? /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-generating" }, "Generating...") : previewUrl ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: previewUrl, className: "share-preview-img", alt: "Share card preview" }) : null), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "share-actions" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: handleShare, disabled: generating }, "Share / Copy"), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: handleDownload, disabled: generating }, "Download"))));
  }

  // src/app/index.tsx
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
            const adjacent = [provider.periods[idx - 1], provider.periods[idx + 1]].filter(Boolean);
            for (const p of adjacent) {
              provider.prefetchPeriod(p);
            }
          }
        } catch (e) {
          console.error("[ListeningStats] Load failed:", e);
          this.setState({ loading: false, error: e.message || "Failed to load stats" });
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
      this.handleProviderSelected = () => {
        const provider = getActiveProvider();
        if (provider) {
          this.setState({
            needsSetup: false,
            providerType: provider.type,
            period: provider.defaultPeriod,
            loading: true
          }, () => {
            this.loadStats();
            this.checkForUpdateOnLoad();
          });
        }
      };
      this.handleProviderChanged = () => {
        clearStatsCache();
        const provider = getActiveProvider();
        if (provider) {
          this.setState({
            providerType: provider.type,
            period: provider.defaultPeriod,
            stats: null,
            loading: true,
            showSettings: false
          }, () => {
            this.loadStats();
          });
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
        showShareModal: false
      };
    }
    componentDidMount() {
      injectStyles();
      if (!this.state.needsSetup) {
        this.loadStats();
        this.checkForUpdateOnLoad();
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
        showShareModal
      } = this.state;
      if (needsSetup) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(SetupScreen, { onProviderSelected: this.handleProviderSelected }));
      }
      const provider = getActiveProvider();
      const periods = provider?.periods || ["recent"];
      const periodLabels = provider?.periodLabels || { recent: "Recent" };
      const showLikeButtons = providerType !== "lastfm";
      if (showUpdateBanner && updateInfo) {
        return /* @__PURE__ */ Spicetify.React.createElement(
          UpdateBanner,
          {
            updateInfo,
            commandCopied,
            onDismiss: this.dismissUpdateBanner,
            onCopyCommand: this.copyUpdateCommand
          }
        );
      }
      if (loading) {
        return /* @__PURE__ */ Spicetify.React.createElement(LoadingSkeleton, null);
      }
      if (error && !stats) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement(
          Header,
          {
            onToggleSettings: () => this.setState({ showSettings: !showSettings }),
            providerType
          }
        ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-state" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "error-message" }, /* @__PURE__ */ Spicetify.React.createElement("h3", null, "Something went wrong"), /* @__PURE__ */ Spicetify.React.createElement("p", null, error), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn primary", onClick: this.loadStats }, "Try Again"))));
      }
      const settingsModal = showSettings ? Spicetify.ReactDOM.createPortal(
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-overlay", onClick: (e) => {
          if (e.target.classList.contains("settings-overlay")) {
            this.setState({ showSettings: false });
          }
        } }, /* @__PURE__ */ Spicetify.React.createElement(
          SettingsPanel,
          {
            onRefresh: this.loadStats,
            onCheckUpdates: this.checkUpdatesManual,
            onProviderChanged: this.handleProviderChanged,
            onClose: () => this.setState({ showSettings: false }),
            stats,
            period
          }
        )),
        document.body
      ) : null;
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
      ), /* @__PURE__ */ Spicetify.React.createElement(GenreTimeline, null), /* @__PURE__ */ Spicetify.React.createElement(
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
      ));
    }
  };
  var index_default = StatsPage;
  return __toCommonJS(index_exports);
})();
var render=()=>Spicetify.React.createElement(ListeningStatsApp.default);var routes=[];
