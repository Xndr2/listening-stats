(() => {
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
  function clearConfig() {
    configCache = null;
    localStorage.removeItem(STORAGE_KEY);
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

  // node_modules/idb/build/index.js
  var instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
  var idbProxyableTypes;
  var cursorAdvanceMethods;
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
  var transactionDoneMap = /* @__PURE__ */ new WeakMap();
  var transformCache = /* @__PURE__ */ new WeakMap();
  var reverseTransformCache = /* @__PURE__ */ new WeakMap();
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
  var idbProxyTraps = {
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
  var unwrap = (value) => reverseTransformCache.get(value);
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
  var readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
  var writeMethods = ["put", "add", "delete", "clear"];
  var cachedMethods = /* @__PURE__ */ new Map();
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
  replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
  }));
  var advanceMethodProps = ["continue", "continuePrimaryKey", "advance"];
  var methodMap = {};
  var advanceResults = /* @__PURE__ */ new WeakMap();
  var ittrProxiedCursorToOriginalProxy = /* @__PURE__ */ new WeakMap();
  var cursorIteratorTraps = {
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

  // src/services/storage.ts
  var DB_NAME = "listening-stats";
  var DB_VERSION = 3;
  var STORE_NAME = "playEvents";
  var dbPromise = null;
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

  // src/services/tracker.ts
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
  function log(...args) {
    if (isLoggingEnabled()) console.log("[ListeningStats]", ...args);
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
  function hasExistingData() {
    return localStorage.getItem("listening-stats:pollingData") !== null;
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

  // src/app.tsx
  window.ListeningStats = {
    resetLastfmKey: () => {
      clearConfig();
      console.log(
        "[Listening Stats] Last.fm API key cleared. Reload the app to reconfigure."
      );
    }
  };
  async function main() {
    let providerType = getSelectedProviderType();
    if (!providerType && hasExistingData()) {
      providerType = "local";
      setSelectedProviderType("local");
    }
    if (providerType) {
      activateProvider(providerType);
    }
  }
  (function init() {
    if (!Spicetify.Player || !Spicetify.Platform || !Spicetify.CosmosAsync) {
      setTimeout(init, 100);
      return;
    }
    main();
  })();
})();
