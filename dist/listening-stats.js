(() => {
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
  var STORAGE_KEY = "listening-stats:pollingData";
  var POLL_INTERVAL_MS = 15 * 60 * 1e3;
  var SKIP_THRESHOLD_MS = 3e4;
  var STATS_UPDATED_EVENT = "listening-stats:updated";
  var activeProviderType = null;
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

  // src/app.tsx
  async function main() {
    let providerType = getSelectedProviderType();
    if (!providerType && hasExistingData()) {
      providerType = "spotify";
      setSelectedProviderType("spotify");
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
