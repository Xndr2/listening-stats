var ListeningStatsApp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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

  // src/app/index.tsx
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/services/spotify-api.ts
  var STORAGE_PREFIX = "listening-stats:";
  var MIN_API_INTERVAL_MS = 1e4;
  var BATCH_SIZE = 3;
  var DEFAULT_BACKOFF_MS = 3e5;
  var MAX_BACKOFF_MS = 36e5;
  var CACHE_PERSIST_INTERVAL_MS = 6e4;
  var audioFeaturesCache = /* @__PURE__ */ new Map();
  var artistGenresCache = /* @__PURE__ */ new Map();
  var rateLimitedUntil = 0;
  var lastApiCallTime = 0;
  var cachesPersistTimeout = null;
  function initFromStorage() {
    try {
      const storedRateLimit = localStorage.getItem(`${STORAGE_PREFIX}rateLimitedUntil`);
      if (storedRateLimit) {
        rateLimitedUntil = parseInt(storedRateLimit, 10);
        if (Date.now() >= rateLimitedUntil) {
          rateLimitedUntil = 0;
          localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
        }
      }
      const storedAudioFeatures = localStorage.getItem(`${STORAGE_PREFIX}audioFeaturesCache`);
      if (storedAudioFeatures) {
        const parsed = JSON.parse(storedAudioFeatures);
        audioFeaturesCache = new Map(Object.entries(parsed));
        console.log(`[ListeningStats] Loaded ${audioFeaturesCache.size} cached audio features`);
      }
      const storedGenres = localStorage.getItem(`${STORAGE_PREFIX}artistGenresCache`);
      if (storedGenres) {
        const parsed = JSON.parse(storedGenres);
        artistGenresCache = new Map(Object.entries(parsed));
        console.log(`[ListeningStats] Loaded ${artistGenresCache.size} cached artist genres`);
      }
    } catch (error) {
      console.warn("[ListeningStats] Failed to load cached API data:", error);
    }
  }
  function scheduleCachePersist() {
    if (cachesPersistTimeout) return;
    cachesPersistTimeout = window.setTimeout(() => {
      persistCaches();
      cachesPersistTimeout = null;
    }, CACHE_PERSIST_INTERVAL_MS);
  }
  function persistCaches() {
    try {
      const audioFeaturesObj = {};
      const audioEntries = Array.from(audioFeaturesCache.entries()).slice(-500);
      audioEntries.forEach(([k, v]) => {
        audioFeaturesObj[k] = v;
      });
      localStorage.setItem(`${STORAGE_PREFIX}audioFeaturesCache`, JSON.stringify(audioFeaturesObj));
      const genresObj = {};
      const genreEntries = Array.from(artistGenresCache.entries()).slice(-500);
      genreEntries.forEach(([k, v]) => {
        genresObj[k] = v;
      });
      localStorage.setItem(`${STORAGE_PREFIX}artistGenresCache`, JSON.stringify(genresObj));
    } catch (error) {
      console.warn("[ListeningStats] Failed to persist caches:", error);
    }
  }
  function handleRateLimit(error) {
    let backoffMs = DEFAULT_BACKOFF_MS;
    if (error?.headers?.["retry-after"]) {
      const retryAfter = parseInt(error.headers["retry-after"], 10);
      if (!isNaN(retryAfter)) {
        backoffMs = Math.min(retryAfter * 1e3, MAX_BACKOFF_MS);
      }
    } else if (error?.body?.["Retry-After"]) {
      const retryAfter = parseInt(error.body["Retry-After"], 10);
      if (!isNaN(retryAfter)) {
        backoffMs = Math.min(retryAfter * 1e3, MAX_BACKOFF_MS);
      }
    }
    rateLimitedUntil = Date.now() + backoffMs;
    localStorage.setItem(`${STORAGE_PREFIX}rateLimitedUntil`, rateLimitedUntil.toString());
    console.log(`[ListeningStats] Rate limited, backing off for ${Math.ceil(backoffMs / 6e4)} minutes`);
  }
  function clearRateLimit() {
    if (rateLimitedUntil > 0) {
      rateLimitedUntil = 0;
      localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
    }
  }
  function isApiAvailable() {
    return Date.now() >= rateLimitedUntil;
  }
  function getRateLimitRemaining() {
    if (rateLimitedUntil <= 0) return 0;
    return Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1e3));
  }
  async function waitForApiSlot() {
    if (!isApiAvailable()) {
      const waitTime = rateLimitedUntil - Date.now();
      console.log(`[ListeningStats] Rate limited, skipping (${Math.ceil(waitTime / 1e3)}s remaining)`);
      return false;
    }
    const timeSinceLastCall = Date.now() - lastApiCallTime;
    if (timeSinceLastCall < MIN_API_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_API_INTERVAL_MS - timeSinceLastCall));
    }
    lastApiCallTime = Date.now();
    return true;
  }
  initFromStorage();
  function extractTrackId(uri) {
    const match = uri.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  function extractArtistId(uri) {
    const match = uri.match(/spotify:artist:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }
  async function getAudioAnalysis(trackUri) {
    try {
      const data = await Spicetify.getAudioData(trackUri);
      if (data?.track?.tempo) {
        return { tempo: data.track.tempo };
      }
    } catch (error) {
    }
    return null;
  }
  function isPlaceholderAudioFeatures(af) {
    return af.valence === 0.5 && af.energy === 0.5 && af.danceability === 0.5;
  }
  async function fetchAudioFeaturesBatch(trackUris) {
    const result = /* @__PURE__ */ new Map();
    const uncachedUris = trackUris.filter((uri) => {
      if (audioFeaturesCache.has(uri)) {
        const cached = audioFeaturesCache.get(uri);
        if (!isPlaceholderAudioFeatures(cached)) {
          result.set(uri, cached);
          return false;
        }
      }
      return extractTrackId(uri) !== null;
    });
    if (uncachedUris.length === 0) {
      return result;
    }
    const tempoFromAnalysis = /* @__PURE__ */ new Map();
    for (const uri of uncachedUris) {
      const analysis = await getAudioAnalysis(uri);
      if (analysis) {
        tempoFromAnalysis.set(uri, analysis.tempo);
      }
    }
    const stillNeeded = uncachedUris;
    if (stillNeeded.length > 0 && await waitForApiSlot()) {
      const smallBatch = stillNeeded.slice(0, BATCH_SIZE);
      try {
        const ids = smallBatch.map((uri) => extractTrackId(uri)).join(",");
        const response = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/audio-features?ids=${ids}`
        );
        if (response?.audio_features) {
          clearRateLimit();
          response.audio_features.forEach((features, index) => {
            if (features) {
              const uri = smallBatch[index];
              const tempo = tempoFromAnalysis.get(uri) || features.tempo;
              const audioFeatures = {
                energy: features.energy,
                valence: features.valence,
                danceability: features.danceability,
                tempo,
                acousticness: features.acousticness,
                instrumentalness: features.instrumentalness,
                speechiness: features.speechiness,
                liveness: features.liveness
              };
              audioFeaturesCache.set(uri, audioFeatures);
              result.set(uri, audioFeatures);
            }
          });
          scheduleCachePersist();
          console.log(`[ListeningStats] Got ${response.audio_features.filter(Boolean).length} audio features from Web API`);
        }
      } catch (error) {
        if (error?.message?.includes("429") || error?.status === 429) {
          handleRateLimit(error);
        } else {
          console.warn("[ListeningStats] Web API audio features failed:", error);
        }
      }
    }
    return result;
  }
  async function fetchArtistGenresBatch(artistUris) {
    const result = /* @__PURE__ */ new Map();
    const uncachedUris = artistUris.filter((uri) => {
      if (artistGenresCache.has(uri)) {
        result.set(uri, artistGenresCache.get(uri));
        return false;
      }
      return extractArtistId(uri) !== null;
    });
    if (uncachedUris.length === 0) {
      return result;
    }
    if (await waitForApiSlot()) {
      const smallBatch = uncachedUris.slice(0, BATCH_SIZE);
      try {
        const ids = smallBatch.map((uri) => extractArtistId(uri)).join(",");
        const response = await Spicetify.CosmosAsync.get(
          `https://api.spotify.com/v1/artists?ids=${ids}`
        );
        if (response?.artists) {
          clearRateLimit();
          response.artists.forEach((artist, index) => {
            if (artist) {
              const genres = artist.genres || [];
              const uri = smallBatch[index];
              artistGenresCache.set(uri, genres);
              result.set(uri, genres);
            }
          });
          scheduleCachePersist();
          console.log(`[ListeningStats] Got genres for ${response.artists.filter(Boolean).length} artists`);
        }
      } catch (error) {
        if (error?.message?.includes("429") || error?.status === 429) {
          handleRateLimit(error);
        } else {
          console.warn("[ListeningStats] Artist genres fetch failed:", error);
        }
      }
    }
    return result;
  }
  function clearApiCaches() {
    audioFeaturesCache.clear();
    artistGenresCache.clear();
    localStorage.removeItem(`${STORAGE_PREFIX}audioFeaturesCache`);
    localStorage.removeItem(`${STORAGE_PREFIX}artistGenresCache`);
  }
  function resetRateLimit() {
    rateLimitedUntil = 0;
    localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
    console.log("[ListeningStats] Rate limit state reset");
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
  var DB_VERSION = 2;
  var STORE_NAME = "playEvents";
  var dbInstance = null;
  async function getDB() {
    if (dbInstance) return dbInstance;
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true
          });
          store.createIndex("by-startedAt", "startedAt");
          store.createIndex("by-trackUri", "trackUri");
          store.createIndex("by-artistUri", "artistUri");
        }
        if (oldVersion < 2) {
          console.log("[ListeningStats] DB upgraded to v2 - audio features support");
        }
      }
    });
    return dbInstance;
  }
  async function getPlayEventsByTimeRange(startTime, endTime = Date.now()) {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.store.index("by-startedAt");
    const range = IDBKeyRange.bound(startTime, endTime);
    return index.getAll(range);
  }
  function getPeriodStartTime(period) {
    const now = /* @__PURE__ */ new Date();
    switch (period) {
      case "today":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      case "week":
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek.getTime();
      case "month":
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      case "allTime":
        return 0;
    }
  }
  async function getPlayEventsForPeriod(period) {
    const startTime = getPeriodStartTime(period);
    return getPlayEventsByTimeRange(startTime);
  }
  async function clearAllData() {
    const db = await getDB();
    await db.clear(STORE_NAME);
  }
  async function updatePlayEvent(id, updates) {
    const db = await getDB();
    const event = await db.get(STORE_NAME, id);
    if (event) {
      const updated = { ...event, ...updates };
      await db.put(STORE_NAME, updated);
    }
  }
  function isPlaceholderAudioFeatures2(af) {
    return af.valence === 0.5 && af.energy === 0.5 && af.danceability === 0.5;
  }
  async function getEventsNeedingEnrichment(limit = 50) {
    const db = await getDB();
    const allEvents = await db.getAll(STORE_NAME);
    return allEvents.filter((event) => {
      const needsFeatures = !event.audioFeatures || isPlaceholderAudioFeatures2(event.audioFeatures);
      return needsFeatures && event.trackUri.startsWith("spotify:track:");
    }).slice(0, limit);
  }

  // src/services/stats.ts
  function getMoodCategory(valence, energy) {
    if (valence === null || energy === null) return "mixed";
    if (valence >= 0.6 && energy >= 0.6) return "happy";
    if (valence < 0.4 && energy >= 0.6) return "energetic";
    if (valence >= 0.5 && energy < 0.5) return "chill";
    if (valence < 0.4 && energy < 0.5) return "melancholic";
    return "mixed";
  }
  async function calculateStats(period) {
    const events = await getPlayEventsForPeriod(period);
    const allTimeEvents = period !== "allTime" ? await getPlayEventsForPeriod("allTime") : events;
    const totalTimeMs = events.reduce((sum, event) => sum + event.playedMs, 0);
    const trackMap = /* @__PURE__ */ new Map();
    const artistMap = /* @__PURE__ */ new Map();
    const albumMap = /* @__PURE__ */ new Map();
    const genreMap = /* @__PURE__ */ new Map();
    const hourlyDistribution = new Array(24).fill(0);
    const daysWithActivity = /* @__PURE__ */ new Set();
    const audioFeaturesSum = {
      danceability: 0,
      energy: 0,
      speechiness: 0,
      acousticness: 0,
      instrumentalness: 0,
      liveness: 0,
      valence: 0,
      tempo: 0
    };
    let eventsWithFeatures = 0;
    let explicitCount = 0;
    const releaseYears = {};
    let skippedCount = 0;
    const SKIP_THRESHOLD_MS = 3e4;
    const allTimeTrackUris = new Set(allTimeEvents.map((e) => e.trackUri));
    const allTimeArtistKeys = new Set(allTimeEvents.map((e) => e.artistUri || e.artistName));
    const periodStartTime = events.length > 0 ? Math.min(...events.map((e) => e.startedAt)) : Date.now();
    const newTracksInPeriod = /* @__PURE__ */ new Set();
    const newArtistsInPeriod = /* @__PURE__ */ new Set();
    for (const event of events) {
      const dayKey = new Date(event.startedAt).toDateString();
      daysWithActivity.add(dayKey);
      if (event.playedMs < SKIP_THRESHOLD_MS && event.durationMs > SKIP_THRESHOLD_MS) {
        skippedCount++;
      }
      const existingTrack = trackMap.get(event.trackUri);
      if (existingTrack) {
        existingTrack.playCount++;
        existingTrack.totalTimeMs += event.playedMs;
      } else {
        trackMap.set(event.trackUri, {
          trackUri: event.trackUri,
          trackName: event.trackName,
          artistName: event.artistName,
          albumArt: event.albumArt,
          playCount: 1,
          totalTimeMs: event.playedMs
        });
      }
      const artistKey = event.artistUri || event.artistName;
      const existingArtist = artistMap.get(artistKey);
      if (existingArtist) {
        existingArtist.playCount++;
        existingArtist.totalTimeMs += event.playedMs;
        if (!existingArtist.artistImage && event.albumArt) {
          existingArtist.artistImage = event.albumArt;
        }
      } else {
        artistMap.set(artistKey, {
          artistUri: event.artistUri,
          artistName: event.artistName,
          artistImage: event.albumArt,
          // Use album art as placeholder
          playCount: 1,
          totalTimeMs: event.playedMs
        });
      }
      if (event.albumUri) {
        const existingAlbum = albumMap.get(event.albumUri);
        if (existingAlbum) {
          existingAlbum.playCount++;
          existingAlbum.totalTimeMs += event.playedMs;
        } else {
          albumMap.set(event.albumUri, {
            albumUri: event.albumUri,
            albumName: event.albumName,
            artistName: event.artistName,
            albumArt: event.albumArt,
            playCount: 1,
            totalTimeMs: event.playedMs
          });
        }
      }
      if (event.genres) {
        for (const genre of event.genres) {
          const existing = genreMap.get(genre);
          if (existing) {
            existing.playCount++;
            existing.totalTimeMs += event.playedMs;
          } else {
            genreMap.set(genre, { playCount: 1, totalTimeMs: event.playedMs });
          }
        }
      }
      if (event.audioFeatures) {
        const af = event.audioFeatures;
        const isDefaultData = af.valence === 0.5 && af.energy === 0.5 && af.danceability === 0.5;
        if (!isDefaultData && (af.danceability > 0 || af.energy > 0 || af.valence > 0)) {
          audioFeaturesSum.danceability += af.danceability || 0;
          audioFeaturesSum.energy += af.energy || 0;
          audioFeaturesSum.speechiness += af.speechiness || 0;
          audioFeaturesSum.acousticness += af.acousticness || 0;
          audioFeaturesSum.instrumentalness += af.instrumentalness || 0;
          audioFeaturesSum.liveness += af.liveness || 0;
          audioFeaturesSum.valence += af.valence || 0;
          audioFeaturesSum.tempo += af.tempo || 0;
          eventsWithFeatures++;
        }
      }
      if (event.isExplicit) {
        explicitCount++;
      }
      if (event.albumReleaseDate) {
        const year = new Date(event.albumReleaseDate).getFullYear().toString();
        releaseYears[year] = (releaseYears[year] || 0) + 1;
      }
      const hour = new Date(event.startedAt).getHours();
      hourlyDistribution[hour] += event.playedMs;
      if (period !== "allTime") {
        const firstPlayOfTrack = allTimeEvents.filter((e) => e.trackUri === event.trackUri).sort((a, b) => a.startedAt - b.startedAt)[0];
        if (firstPlayOfTrack && firstPlayOfTrack.startedAt >= periodStartTime) {
          newTracksInPeriod.add(event.trackUri);
        }
        const firstPlayOfArtist = allTimeEvents.filter((e) => (e.artistUri || e.artistName) === artistKey).sort((a, b) => a.startedAt - b.startedAt)[0];
        if (firstPlayOfArtist && firstPlayOfArtist.startedAt >= periodStartTime) {
          newArtistsInPeriod.add(artistKey);
        }
      }
    }
    let streakDays = 0;
    const today = /* @__PURE__ */ new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayKey = checkDate.toDateString();
      if (daysWithActivity.has(dayKey)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }
    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    const topTracks = Array.from(trackMap.values()).sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10);
    const topArtists = Array.from(artistMap.values()).sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10);
    const topAlbums = Array.from(albumMap.values()).sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10);
    const topGenres = Array.from(genreMap.entries()).map(([genre, data]) => ({ genre, ...data })).sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10);
    const recentTracks = events.sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
    const analysis = {
      danceability: eventsWithFeatures > 0 ? audioFeaturesSum.danceability / eventsWithFeatures : 0,
      energy: eventsWithFeatures > 0 ? audioFeaturesSum.energy / eventsWithFeatures : 0,
      speechiness: eventsWithFeatures > 0 ? audioFeaturesSum.speechiness / eventsWithFeatures : 0,
      acousticness: eventsWithFeatures > 0 ? audioFeaturesSum.acousticness / eventsWithFeatures : 0,
      instrumentalness: eventsWithFeatures > 0 ? audioFeaturesSum.instrumentalness / eventsWithFeatures : 0,
      liveness: eventsWithFeatures > 0 ? audioFeaturesSum.liveness / eventsWithFeatures : 0,
      valence: eventsWithFeatures > 0 ? audioFeaturesSum.valence / eventsWithFeatures : 0,
      tempo: eventsWithFeatures > 0 ? audioFeaturesSum.tempo / eventsWithFeatures : 0,
      explicit: events.length > 0 ? explicitCount / events.length : 0
    };
    const genres = {};
    for (const [genre, data] of genreMap.entries()) {
      genres[genre] = data.playCount;
    }
    const averageMood = eventsWithFeatures > 0 ? analysis.valence : null;
    const averageEnergy = eventsWithFeatures > 0 ? analysis.energy : null;
    const danceability = eventsWithFeatures > 0 ? analysis.danceability : null;
    const moodCategory = getMoodCategory(averageMood, averageEnergy);
    const listenedDays = daysWithActivity.size;
    const avgSessionLength = listenedDays > 0 ? totalTimeMs / listenedDays : 0;
    const skipRate = events.length > 0 ? skippedCount / events.length : 0;
    return {
      totalTimeMs,
      trackCount: events.length,
      uniqueTrackCount: trackMap.size,
      uniqueArtistCount: artistMap.size,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      peakHour,
      recentTracks,
      genres,
      topGenres,
      analysis,
      releaseYears,
      averageMood,
      averageEnergy,
      moodCategory,
      danceability,
      streakDays,
      newArtistsCount: newArtistsInPeriod.size,
      newTracksCount: newTracksInPeriod.size,
      avgSessionLength,
      skipRate,
      listenedDays
    };
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
    switch (period) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "allTime":
        return "All Time";
    }
  }

  // src/services/tracker.ts
  var enrichmentInProgress = false;
  var enrichmentCycle = "audioFeatures";
  async function runBackgroundEnrichment(force = false) {
    if (enrichmentInProgress) return;
    if (!isApiAvailable()) {
      console.log("[ListeningStats] Skipping enrichment - API rate limited");
      return;
    }
    if (!force && !Spicetify.Player.isPlaying()) {
      console.log("[ListeningStats] Skipping enrichment - not playing");
      return;
    }
    enrichmentInProgress = true;
    try {
      const events = await getEventsNeedingEnrichment(20);
      if (events.length === 0) {
        return;
      }
      console.log(`[ListeningStats] Enriching ${events.length} events (${enrichmentCycle} cycle)...`);
      let updatedCount = 0;
      if (enrichmentCycle === "audioFeatures") {
        const trackUris = [...new Set(
          events.filter((e) => !e.audioFeatures && e.trackUri.startsWith("spotify:track:")).map((e) => e.trackUri)
        )];
        if (trackUris.length > 0) {
          try {
            const audioFeaturesMap = await fetchAudioFeaturesBatch(trackUris);
            console.log(`[ListeningStats] Fetched audio features for ${audioFeaturesMap.size}/${trackUris.length} tracks`);
            for (const event of events) {
              if (!event.id || event.audioFeatures) continue;
              if (audioFeaturesMap.has(event.trackUri)) {
                await updatePlayEvent(event.id, { audioFeatures: audioFeaturesMap.get(event.trackUri) });
                updatedCount++;
              }
            }
          } catch (error) {
            console.warn("[ListeningStats] Audio features batch failed:", error);
          }
        }
        enrichmentCycle = "genres";
      } else {
        const artistUris = [...new Set(
          events.filter((e) => !e.genres && e.artistUri).map((e) => e.artistUri)
        )];
        if (artistUris.length > 0) {
          try {
            const genresMap = await fetchArtistGenresBatch(artistUris);
            console.log(`[ListeningStats] Fetched genres for ${genresMap.size}/${artistUris.length} artists`);
            for (const event of events) {
              if (!event.id || event.genres) continue;
              if (genresMap.has(event.artistUri)) {
                await updatePlayEvent(event.id, { genres: genresMap.get(event.artistUri) });
                updatedCount++;
              }
            }
          } catch (error) {
            console.warn("[ListeningStats] Artist genres batch failed:", error);
          }
        }
        enrichmentCycle = "audioFeatures";
      }
      if (updatedCount > 0) {
        console.log(`[ListeningStats] Enrichment complete: updated ${updatedCount} events`);
      }
    } catch (error) {
      console.error("[ListeningStats] Background enrichment failed:", error);
    } finally {
      enrichmentInProgress = false;
    }
  }
  var ENRICHMENT_INTERVAL_MS = 15 * 60 * 1e3;

  // src/services/updater.ts
  var GITHUB_REPO = "Xndr2/listening-stats";
  var STORAGE_KEY = "listening-stats:lastUpdateCheck";
  var DISMISSED_KEY = "listening-stats:dismissedVersion";
  var JUST_UPDATED_KEY = "listening-stats:justUpdated";
  var INSTALL_CMD_LINUX = `curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash`;
  var INSTALL_CMD_WINDOWS = `iwr -useb 'https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1' | iex`;
  function getCurrentVersion() {
    try {
      return "1.0.43";
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        checkedAt: Date.now(),
        latestVersion,
        available
      }));
      console.log(`[ListeningStats] Version check: current=${currentVersion}, latest=${latestVersion}, update=${available}`);
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
  function shouldCheckForUpdate() {
    return true;
  }
  function wasVersionDismissed(version) {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      return dismissed === version;
    } catch {
      return false;
    }
  }
  function dismissVersion(version) {
    localStorage.setItem(DISMISSED_KEY, version);
  }
  function clearDismissedVersion() {
    localStorage.removeItem(DISMISSED_KEY);
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
        console.error("[ListeningStats] Failed to copy to clipboard");
        return false;
      }
    }
  }
  function checkJustUpdated() {
    const justUpdated = localStorage.getItem(JUST_UPDATED_KEY) === "true";
    if (justUpdated) {
      localStorage.removeItem(JUST_UPDATED_KEY);
    }
    return justUpdated;
  }

  // src/app/icons.ts
  var Icons = {
    heart: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1.69 2A4.582 4.582 0 018 2.023 4.583 4.583 0 0114.31 2a4.583 4.583 0 010 6.496L8 14.153l-6.31-5.657A4.583 4.583 0 011.69 2m6.31 10.06l5.715-5.12a3.087 3.087 0 00-4.366-4.371L8 3.839l-1.35-1.27a3.087 3.087 0 00-4.366 4.37z"/></svg>',
    heartFilled: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M15.724 4.22A4.313 4.313 0 0012.192.814a4.269 4.269 0 00-3.622 1.13.837.837 0 01-1.14 0 4.272 4.272 0 00-6.21 5.855l5.916 7.05a1.128 1.128 0 001.727 0l5.916-7.05a4.228 4.228 0 00.945-3.577z"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.866 0-7-3.358-7-7.5 0-2.09.705-3.905 1.949-5.267A7.834 7.834 0 009 8.5c0-2.485 1.136-4.5 3-6 0 3 2.5 5.5 5 7 .667-1 1-2 1-3 2 2.5 3 5.5 3 8.5 0 4.142-3.134 7.5-7 7.5h-2z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a9 9 0 00-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 00-9-9z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    album: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>'
  };

  // src/app/styles.css
  var styles_default = '/* Listening Stats - Main Styles */\n\n/* ===== Sidebar Icon ===== */\n[href="/listening-stats"] svg {\n  fill: currentColor !important;\n  color: var(--text-subdued) !important;\n}\n[href="/listening-stats"]:hover svg,\n[href="/listening-stats"][aria-current="page"] svg {\n  color: var(--text-base) !important;\n}\n\n/* ===== Page Layout ===== */\n.stats-page {\n  padding: 32px 48px;\n  max-width: 1400px;\n  margin: 0 auto;\n}\n\n/* ===== Header ===== */\n.stats-header {\n  margin-bottom: 24px;\n}\n\n.stats-title {\n  font-size: 2.5rem;\n  font-weight: 700;\n  margin: 0 0 4px 0;\n  letter-spacing: -0.5px;\n}\n\n.stats-subtitle {\n  font-size: 14px;\n  color: var(--text-subdued);\n  margin: 0;\n}\n\n/* ===== Period Tabs (inside hero card) ===== */\n.period-tabs {\n  display: inline-flex;\n  background: rgba(0, 0, 0, 0.15);\n  border-radius: 8px;\n  padding: 4px;\n  margin-top: 16px;\n  gap: 2px;\n}\n\n.period-tab {\n  padding: 8px 16px;\n  border: none;\n  background: transparent;\n  color: rgba(0, 0, 0, 0.6);\n  font-size: 13px;\n  font-weight: 600;\n  border-radius: 6px;\n  cursor: pointer;\n  transition: all 0.2s ease;\n}\n\n.period-tab:hover {\n  color: rgba(0, 0, 0, 0.8);\n  background: rgba(0, 0, 0, 0.1);\n}\n\n.period-tab.active {\n  background: rgba(0, 0, 0, 0.2);\n  color: #000;\n}\n\n/* ===== Overview Cards Row ===== */\n.overview-row {\n  display: grid;\n  grid-template-columns: 2fr 1fr;\n  gap: 16px;\n  margin-bottom: 32px;\n}\n\n.overview-card-list {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 16px;\n}\n\n.overview-card {\n  background: var(--background-tinted-base);\n  border-radius: 12px;\n  padding: 20px;\n  display: flex;\n  flex-direction: column;\n}\n\n.overview-card.hero {\n  background: linear-gradient(135deg, var(--spice-button) 0%, #1a9f4a 100%);\n  color: #000;\n}\n\n.overview-card.hero .overview-value {\n  font-size: 3rem;\n}\n\n.overview-value {\n  font-size: 2rem;\n  font-weight: 800;\n  line-height: 1;\n  margin-bottom: 4px;\n}\n\n.overview-card.hero .overview-value {\n  font-size: 2.5rem;\n}\n\n.overview-label {\n  font-size: 11px;\n  font-weight: 600;\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  opacity: 0.7;\n}\n\n.overview-card.hero .overview-label {\n  opacity: 0.85;\n}\n\n.overview-secondary {\n  display: flex;\n  gap: 24px;\n  margin-top: auto;\n  padding-top: 16px;\n  border-top: 1px solid rgba(0, 0, 0, 0.1);\n}\n\n.overview-stat {\n  display: flex;\n  flex-direction: column;\n}\n\n.overview-stat-value {\n  font-size: 1.25rem;\n  font-weight: 700;\n}\n\n.overview-stat-label {\n  font-size: 10px;\n  text-transform: uppercase;\n  opacity: 0.6;\n}\n\n/* Colored stats */\n.overview-card .stat-colored {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}\n\n.stat-icon {\n  width: 40px;\n  height: 40px;\n  border-radius: 10px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-shrink: 0;\n}\n\n.stat-icon svg {\n  width: 20px;\n  height: 20px;\n}\n\n.stat-icon.green {\n  background: rgba(29, 185, 84, 0.15);\n  color: #1db954;\n}\n.stat-icon.orange {\n  background: rgba(243, 156, 18, 0.15);\n  color: #f39c12;\n}\n.stat-icon.purple {\n  background: rgba(155, 89, 182, 0.15);\n  color: #9b59b6;\n}\n.stat-icon.red {\n  background: rgba(231, 76, 60, 0.15);\n  color: #e74c3c;\n}\n\n.stat-text .overview-value {\n  font-size: 1.5rem;\n}\n\n.stat-text .overview-value.green {\n  color: #1db954;\n}\n.stat-text .overview-value.orange {\n  color: #f39c12;\n}\n.stat-text .overview-value.purple {\n  color: #9b59b6;\n}\n.stat-text .overview-value.red {\n  color: #e74c3c;\n}\n\n/* ===== Top Lists Section ===== */\n.top-lists-section {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 24px;\n  margin-bottom: 32px;\n}\n\n.top-list {\n  background: var(--background-tinted-base);\n  border-radius: 16px;\n  padding: 24px;\n  min-height: 400px;\n  display: flex;\n  flex-direction: column;\n  flex: 1 1 300px;\n  min-width: 280px;\n}\n\n.top-list-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 20px;\n}\n\n.top-list-title {\n  font-size: 18px;\n  font-weight: 700;\n  margin: 0;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.top-list-title svg {\n  width: 20px;\n  height: 20px;\n  color: var(--text-subdued);\n}\n\n/* ===== Item List ===== */\n.item-list {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  flex: 1;\n}\n\n.item-row {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 10px 12px;\n  margin: 0 -12px;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: background 0.15s ease;\n}\n\n.item-row:hover {\n  background: rgba(255, 255, 255, 0.07);\n}\n\n.item-rank {\n  width: 24px;\n  font-size: 14px;\n  font-weight: 700;\n  text-align: center;\n  flex-shrink: 0;\n  color: var(--text-subdued);\n}\n\n.item-rank.gold {\n  color: #f1c40f;\n  text-shadow: 0 0 10px rgba(241, 196, 15, 0.3);\n}\n.item-rank.silver {\n  color: #bdc3c7;\n}\n.item-rank.bronze {\n  color: #cd6133;\n}\n\n.item-art {\n  width: 48px;\n  height: 48px;\n  border-radius: 6px;\n  object-fit: cover;\n  background: var(--background-elevated-base);\n  flex-shrink: 0;\n}\n\n.item-art.round {\n  border-radius: 50%;\n}\n\n.item-info {\n  flex: 1;\n  min-width: 0;\n}\n\n.item-name {\n  font-size: 14px;\n  font-weight: 500;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  margin-bottom: 2px;\n}\n\n.item-meta {\n  font-size: 12px;\n  color: var(--text-subdued);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.item-stats {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-end;\n  gap: 2px;\n  flex-shrink: 0;\n}\n\n.item-plays {\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--text-base);\n}\n\n.item-time {\n  font-size: 11px;\n  color: var(--text-subdued);\n}\n\n/* Heart button */\n.heart-btn {\n  background: none;\n  border: none;\n  padding: 6px;\n  cursor: pointer;\n  color: var(--text-subdued);\n  display: flex;\n  align-items: center;\n  border-radius: 50%;\n  transition: all 0.15s ease;\n  flex-shrink: 0;\n}\n\n.heart-btn:hover {\n  color: var(--text-base);\n  background: rgba(255, 255, 255, 0.1);\n}\n\n.heart-btn.liked {\n  color: #1db954;\n}\n\n.heart-btn svg {\n  width: 18px;\n  height: 18px;\n}\n\n/* ===== Activity Chart Section ===== */\n.activity-section {\n  background: var(--background-tinted-base);\n  border-radius: 16px;\n  padding: 24px;\n  margin-bottom: 32px;\n}\n\n.activity-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin-bottom: 20px;\n}\n\n.activity-title {\n  font-size: 18px;\n  font-weight: 700;\n  margin: 0;\n}\n\n.activity-peak {\n  font-size: 13px;\n  color: var(--text-subdued);\n}\n\n.activity-peak strong {\n  color: #1db954;\n}\n\n.activity-chart {\n  height: 80px;\n  display: flex;\n  align-items: flex-end;\n  gap: 3px;\n}\n\n.activity-bar {\n  flex: 1;\n  background: rgba(255, 255, 255, 0.08);\n  border-radius: 3px 3px 0 0;\n  min-height: 4px;\n  transition: background 0.15s ease;\n  cursor: pointer;\n  position: relative;\n}\n\n.activity-bar.peak {\n  background: #1db954;\n}\n\n.activity-bar:hover {\n  background: #1db954;\n}\n\n.activity-bar-tooltip {\n  position: absolute;\n  bottom: calc(100% + 8px);\n  left: 50%;\n  transform: translateX(-50%);\n  background: var(--background-elevated-base);\n  padding: 6px 10px;\n  border-radius: 6px;\n  font-size: 11px;\n  white-space: nowrap;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.15s ease;\n  z-index: 10;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);\n}\n\n.activity-bar:hover .activity-bar-tooltip {\n  opacity: 1;\n}\n\n.chart-labels {\n  display: flex;\n  justify-content: space-between;\n  font-size: 10px;\n  color: var(--text-subdued);\n  margin-top: 10px;\n  padding: 0 2px;\n}\n\n/* ===== Recently Played ===== */\n.recent-section {\n  background: var(--background-tinted-base);\n  border-radius: 16px;\n  padding: 24px;\n  margin-bottom: 32px;\n}\n\n.recent-header {\n  margin-bottom: 20px;\n}\n\n.recent-title {\n  font-size: 18px;\n  font-weight: 700;\n  margin: 0;\n}\n\n.recent-scroll {\n  display: flex;\n  gap: 16px;\n  overflow-x: auto;\n  padding-bottom: 8px;\n  margin: 0 -24px;\n  padding: 0 24px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--background-tinted-highlight) transparent;\n}\n\n.recent-scroll::-webkit-scrollbar {\n  height: 6px;\n}\n\n.recent-scroll::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.recent-scroll::-webkit-scrollbar-thumb {\n  background: var(--background-tinted-highlight);\n  border-radius: 3px;\n}\n\n.recent-card {\n  flex-shrink: 0;\n  width: 140px;\n  cursor: pointer;\n  transition: transform 0.15s ease;\n}\n\n.recent-card:hover {\n  transform: translateY(-4px);\n}\n\n.recent-card:hover .recent-art {\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);\n}\n\n.recent-art {\n  width: 140px;\n  height: 140px;\n  border-radius: 8px;\n  object-fit: cover;\n  background: var(--background-elevated-base);\n  margin-bottom: 10px;\n  transition: box-shadow 0.15s ease;\n}\n\n.recent-name {\n  font-size: 13px;\n  font-weight: 500;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  margin-bottom: 2px;\n}\n\n.recent-meta {\n  font-size: 12px;\n  color: var(--text-subdued);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* ===== Footer ===== */\n.stats-footer {\n  padding-top: 20px;\n  border-top: 1px solid var(--background-tinted-highlight);\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 12px;\n}\n\n.footer-left {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.settings-toggle {\n  background: none;\n  border: none;\n  color: var(--text-subdued);\n  font-size: 12px;\n  cursor: pointer;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 8px 12px;\n  border-radius: 6px;\n  transition: all 0.15s ease;\n}\n\n.settings-toggle:hover {\n  background: var(--background-tinted-base);\n  color: var(--text-base);\n}\n\n.settings-toggle svg {\n  width: 14px;\n  height: 14px;\n}\n\n.footer-btn {\n  padding: 8px 14px;\n  background: var(--background-tinted-base);\n  border: none;\n  border-radius: 6px;\n  color: var(--text-subdued);\n  font-size: 12px;\n  font-weight: 500;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.footer-btn:hover {\n  background: var(--background-tinted-highlight);\n  color: var(--text-base);\n}\n\n.footer-btn.primary {\n  background: #1db954;\n  color: #000;\n}\n\n.footer-btn.primary:hover {\n  background: #1ed760;\n}\n\n.footer-btn.danger:hover {\n  background: #e74c3c;\n  color: #fff;\n}\n\n.version-text {\n  font-size: 11px;\n  color: var(--text-subdued);\n}\n\n/* ===== Settings Panel ===== */\n.settings-panel {\n  margin-top: 16px;\n  padding: 20px;\n  background: var(--background-tinted-base);\n  border-radius: 12px;\n}\n\n.settings-row {\n  display: flex;\n  gap: 10px;\n  flex-wrap: wrap;\n}\n\n.api-status {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  margin-top: 14px;\n  font-size: 11px;\n  color: var(--text-subdued);\n}\n\n.status-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n}\n\n.status-dot.green {\n  background: #1db954;\n}\n.status-dot.red {\n  background: #e74c3c;\n}\n\n/* ===== Empty State ===== */\n.empty-state {\n  text-align: center;\n  padding: 100px 20px;\n}\n\n.empty-icon {\n  width: 80px;\n  height: 80px;\n  margin: 0 auto 20px;\n  color: var(--text-subdued);\n  opacity: 0.5;\n}\n\n.empty-icon svg {\n  width: 100%;\n  height: 100%;\n}\n\n.empty-title {\n  font-size: 24px;\n  font-weight: 600;\n  margin-bottom: 10px;\n}\n\n.empty-text {\n  color: var(--text-subdued);\n  font-size: 15px;\n}\n\n/* ===== Loading ===== */\n.loading {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 400px;\n  color: var(--text-subdued);\n  font-size: 15px;\n}\n\n/* ===== Modal ===== */\n.modal-overlay {\n  position: fixed;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: rgba(0, 0, 0, 0.75);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  z-index: 1000;\n  backdrop-filter: blur(4px);\n}\n\n/* Floating update popup - non-blocking */\n.modal-overlay.floating {\n  background: transparent;\n  backdrop-filter: none;\n  pointer-events: none;\n  align-items: flex-start;\n  justify-content: flex-end;\n  padding: 20px;\n}\n\n.modal-overlay.floating .modal-content {\n  pointer-events: auto;\n  margin-top: 60px;\n  animation: slideIn 0.3s ease-out;\n}\n\n@keyframes slideIn {\n  from {\n    opacity: 0;\n    transform: translateX(20px);\n  }\n  to {\n    opacity: 1;\n    transform: translateX(0);\n  }\n}\n\n.modal-content {\n  background: var(--background-base);\n  border-radius: 16px;\n  padding: 28px;\n  max-width: 420px;\n  width: 90%;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.modal-title {\n  font-size: 20px;\n  font-weight: 700;\n  margin: 0 0 4px;\n}\n\n.modal-subtitle {\n  font-size: 13px;\n  color: var(--text-subdued);\n  margin: 0 0 20px;\n}\n\n.modal-changelog {\n  background: var(--background-tinted-base);\n  border-radius: 8px;\n  padding: 14px;\n  font-size: 13px;\n  max-height: 160px;\n  overflow-y: auto;\n  margin-bottom: 20px;\n  white-space: pre-wrap;\n  line-height: 1.5;\n}\n\n.modal-actions {\n  display: flex;\n  gap: 10px;\n  justify-content: flex-end;\n}\n\n.modal-btn {\n  padding: 10px 20px;\n  border-radius: 20px;\n  border: none;\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: all 0.15s ease;\n}\n\n.modal-btn.primary {\n  background: #1db954;\n  color: #000;\n}\n\n.modal-btn.primary:hover {\n  background: #1ed760;\n}\n\n.modal-btn.secondary {\n  background: var(--background-tinted-highlight);\n  color: var(--text-base);\n}\n\n.modal-btn.secondary:hover {\n  background: var(--background-elevated-highlight);\n}\n\n/* Update Modal Specific */\n.update-modal {\n  max-width: 480px;\n}\n\n.modal-header {\n  text-align: center;\n  margin-bottom: 16px;\n}\n\n.modal-icon {\n  font-size: 48px;\n  margin-bottom: 8px;\n}\n\n.update-modal .modal-title {\n  font-size: 24px;\n  margin-bottom: 4px;\n}\n\n.update-modal .modal-subtitle {\n  font-size: 14px;\n  color: var(--text-subdued);\n  margin: 0;\n}\n\n.modal-instructions {\n  background: var(--background-tinted-base);\n  border-radius: 8px;\n  padding: 14px;\n  margin-bottom: 20px;\n}\n\n.instruction-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: var(--text-subdued);\n  margin-bottom: 8px;\n  text-transform: uppercase;\n}\n\n.instruction-text {\n  font-size: 13px;\n  line-height: 1.6;\n  white-space: pre-line;\n  font-family: monospace;\n}\n\n.update-modal .modal-actions {\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.update-modal .modal-btn {\n  flex: 1;\n  min-width: 100px;\n}\n\n/* Update Success Modal */\n.update-success-modal {\n  max-width: 360px;\n}\n\n.update-success-modal .modal-icon.success {\n  width: 64px;\n  height: 64px;\n  background: #1db954;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  margin: 0 auto 16px;\n  font-size: 32px;\n  color: #000;\n  font-weight: bold;\n}\n\n.update-success-modal .modal-title {\n  font-size: 22px;\n}\n\n.modal-body {\n  text-align: center;\n  margin-bottom: 20px;\n  color: var(--text-subdued);\n  font-size: 14px;\n}\n\n.modal-body p {\n  margin: 0;\n}\n\n.modal-body .manual-steps,\n.modal-body .update-steps {\n  text-align: left;\n  margin: 12px 0 0;\n  padding-left: 20px;\n  color: var(--text-base);\n}\n\n.modal-body .manual-steps li,\n.modal-body .update-steps li {\n  margin-bottom: 6px;\n  line-height: 1.5;\n}\n\n.modal-body .manual-steps code {\n  background: var(--background-tinted-base);\n  padding: 2px 6px;\n  border-radius: 4px;\n  font-size: 12px;\n}\n\n/* Updating Overlay */\n.updating-overlay {\n  z-index: 10001;\n}\n\n.updating-content {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 16px;\n}\n\n.updating-spinner {\n  width: 48px;\n  height: 48px;\n  border: 4px solid var(--background-elevated-highlight);\n  border-top-color: #1db954;\n  border-radius: 50%;\n  animation: spin 1s linear infinite;\n}\n\n@keyframes spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.updating-text {\n  font-size: 16px;\n  font-weight: 600;\n  color: var(--text-base);\n}\n\n/* Disabled button state */\n.footer-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n/* ===== Responsive ===== */\n@media (max-width: 1200px) {\n  .overview-row {\n    grid-template-columns: 1fr 1fr;\n  }\n\n  .overview-card-list {\n    grid-column: span 1;\n  }\n}\n\n@media (max-width: 1000px) {\n  .overview-row {\n    grid-template-columns: 1fr;\n  }\n\n  .overview-card-list {\n    grid-column: span 1;\n  }\n}\n\n@media (max-width: 700px) {\n  .stats-page {\n    padding: 24px;\n  }\n\n  .top-list {\n    min-height: auto;\n    flex: 1 1 100%;\n  }\n\n  .overview-row {\n    grid-template-columns: 1fr;\n  }\n\n  .overview-card-list {\n    grid-column: span 1;\n  }\n\n  .overview-card.hero .overview-value {\n    font-size: 2.5rem;\n  }\n\n  .overview-secondary {\n    flex-wrap: wrap;\n  }\n\n  .period-tabs {\n    flex-wrap: wrap;\n  }\n\n  .period-tab {\n    padding: 6px 12px;\n    font-size: 12px;\n  }\n\n  .recent-card {\n    width: 120px;\n  }\n\n  .recent-art {\n    width: 120px;\n    height: 120px;\n  }\n}\n';

  // src/app/styles.ts
  function injectStyles() {
    const existing = document.getElementById("listening-stats-styles");
    if (existing) existing.remove();
    const styleEl = document.createElement("style");
    styleEl.id = "listening-stats-styles";
    styleEl.textContent = styles_default;
    document.head.appendChild(styleEl);
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
  async function fetchArtistImages(artistUris) {
    const result = /* @__PURE__ */ new Map();
    const validUris = artistUris.filter((uri) => uri?.startsWith("spotify:artist:"));
    if (validUris.length === 0) return result;
    try {
      const ids = validUris.map((uri) => uri.split(":")[2]).join(",");
      const response = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists?ids=${ids}`);
      if (response?.artists) {
        response.artists.forEach((artist, i) => {
          if (artist?.images?.[0]?.url) {
            result.set(validUris[i], artist.images[0].url);
          }
        });
      }
    } catch (error) {
      console.warn("[ListeningStats] Failed to fetch artist images:", error);
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

  // src/app/index.tsx
  var VERSION = getCurrentVersion();
  var TOP_ITEMS_COUNT = 6;
  var StatsPage = class extends Spicetify.React.Component {
    constructor(props) {
      super(props);
      this.pollInterval = null;
      // Auto-check for updates on startup
      this.checkAndAutoUpdate = async () => {
        if (!shouldCheckForUpdate()) return;
        const info = await checkForUpdates();
        if (!info.available) return;
        this.setState({ updateInfo: info });
        if (!wasVersionDismissed(info.latestVersion)) {
          this.setState({ showUpdateModal: true });
        }
      };
      // Manual check for updates (from settings button)
      this.checkUpdatesManual = async () => {
        clearDismissedVersion();
        const info = await checkForUpdates();
        this.setState({ updateInfo: info });
        if (info.available) {
          this.setState({ showUpdateConfirmModal: true });
        } else {
          Spicetify.showNotification("You are on the latest version!");
        }
      };
      // Perform update - copy command to clipboard
      this.performUpdate = async () => {
        this.setState({ showUpdateConfirmModal: false, showUpdateModal: false });
        const copied = await copyInstallCommand();
        if (copied) {
          Spicetify.showNotification(
            "Install command copied! Paste in terminal to update.",
            false,
            5e3
          );
        } else {
          Spicetify.showNotification(
            "Failed to copy command. Check console for install command.",
            true
          );
          console.log("[ListeningStats] Install command:", getInstallCommand());
        }
      };
      this.loadStats = async () => {
        this.setState({ loading: true });
        try {
          const data = await calculateStats(this.state.period);
          this.setState({ stats: data, loading: false });
          if (data.topTracks.length > 0) {
            const uris = data.topTracks.map((t) => t.trackUri);
            const liked = await checkLikedTracks(uris);
            this.setState({ likedTracks: liked });
          }
          if (data.topArtists.length > 0) {
            const uris = data.topArtists.map((a) => a.artistUri).filter(Boolean);
            const images = await fetchArtistImages(uris);
            this.setState({ artistImages: images });
          }
        } catch (e) {
          console.error("[ListeningStats] Load failed:", e);
          this.setState({ loading: false });
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
      this.state = {
        period: "today",
        stats: null,
        loading: true,
        likedTracks: /* @__PURE__ */ new Map(),
        artistImages: /* @__PURE__ */ new Map(),
        updateInfo: null,
        showUpdateModal: false,
        showUpdateSuccessModal: false,
        showUpdateConfirmModal: false,
        showSettings: false,
        apiAvailable: true,
        lastUpdateTimestamp: 0
      };
    }
    componentDidMount() {
      injectStyles();
      this.loadStats();
      if (checkJustUpdated()) {
        this.setState({ showUpdateSuccessModal: true });
      }
      this.pollInterval = window.setInterval(() => {
        const ts = localStorage.getItem("listening-stats:lastUpdate");
        if (ts) {
          const t = parseInt(ts, 10);
          if (t > this.state.lastUpdateTimestamp) {
            this.setState({ lastUpdateTimestamp: t });
            this.loadStats();
          }
        }
        this.setState({ apiAvailable: isApiAvailable() });
      }, 2e3);
      this.checkAndAutoUpdate();
    }
    componentWillUnmount() {
      if (this.pollInterval) clearInterval(this.pollInterval);
    }
    componentDidUpdate(_, prev) {
      if (prev.period !== this.state.period) this.loadStats();
    }
    render() {
      const {
        period,
        stats,
        loading,
        likedTracks,
        artistImages,
        updateInfo,
        showUpdateModal,
        showUpdateSuccessModal,
        showUpdateConfirmModal,
        showSettings,
        apiAvailable
      } = this.state;
      const React = Spicetify.React;
      if (loading) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "loading" }, "Loading..."));
      }
      const periodTabs = /* @__PURE__ */ Spicetify.React.createElement("div", { className: "period-tabs" }, ["today", "week", "month", "allTime"].map((p) => /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          key: p,
          className: `period-tab ${period === p ? "active" : ""}`,
          onClick: () => this.setState({ period: p })
        },
        p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "All Time"
      )));
      if (!stats || stats.trackCount === 0) {
        return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header" }, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "stats-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-subtitle" }, "Your personal music analytics")), periodTabs, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            className: "empty-icon",
            dangerouslySetInnerHTML: { __html: Icons.headphones }
          }
        ), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "empty-title" }, "No data for ", getPeriodDisplayName(period)), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "empty-text" }, "Start listening to see your stats!")));
      }
      const payout = estimateArtistPayout(stats.trackCount);
      return /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-page" }, showUpdateSuccessModal && /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "modal-overlay",
          onClick: () => this.setState({ showUpdateSuccessModal: false })
        },
        /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            className: "modal-content update-success-modal",
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-icon success" }, "\u2713"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-title" }, "ListeningStats Updated!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-subtitle" }, "v", VERSION)),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, "The extension has been updated successfully.")),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              className: "modal-btn primary",
              onClick: () => this.setState({ showUpdateSuccessModal: false })
            },
            "Got it!"
          ))
        )
      ), showUpdateConfirmModal && updateInfo && /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "modal-overlay",
          onClick: () => this.setState({ showUpdateConfirmModal: false })
        },
        /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            className: "modal-content update-modal",
            onClick: (e) => e.stopPropagation()
          },
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-icon" }, "\u{1F389}"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-title" }, "Update Available!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-subtitle" }, "v", updateInfo.currentVersion, " \u2192 v", updateInfo.latestVersion)),
          updateInfo.changelog && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-changelog" }, updateInfo.changelog),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, "This will copy an install command to your clipboard. Paste it in your terminal to update.")),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              className: "modal-btn secondary",
              onClick: () => this.setState({ showUpdateConfirmModal: false })
            },
            "Cancel"
          ), /* @__PURE__ */ Spicetify.React.createElement(
            "button",
            {
              className: "modal-btn primary",
              onClick: this.performUpdate
            },
            "\u{1F4CB} Copy Install Command"
          ))
        )
      ), showUpdateModal && updateInfo && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-overlay floating" }, /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          className: "modal-content update-modal",
          onClick: (e) => e.stopPropagation()
        },
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-header" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-icon" }, "\u{1F389}"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-title" }, "Update Available!"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-subtitle" }, "v", updateInfo.currentVersion, " \u2192 v", updateInfo.latestVersion)),
        updateInfo.changelog && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-changelog" }, updateInfo.changelog),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-body" }, /* @__PURE__ */ Spicetify.React.createElement("p", null, /* @__PURE__ */ Spicetify.React.createElement("strong", null, "How to update:")), /* @__PURE__ */ Spicetify.React.createElement("ol", { className: "update-steps" }, /* @__PURE__ */ Spicetify.React.createElement("li", null, 'Click "Copy Install Command" below'), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Open a terminal"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Paste and run the command"), /* @__PURE__ */ Spicetify.React.createElement("li", null, "Restart Spotify"))),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "modal-actions" }, /* @__PURE__ */ Spicetify.React.createElement(
          "button",
          {
            className: "modal-btn secondary",
            onClick: () => {
              dismissVersion(updateInfo.latestVersion);
              this.setState({ showUpdateModal: false });
            }
          },
          "Dismiss"
        ), /* @__PURE__ */ Spicetify.React.createElement(
          "button",
          {
            className: "modal-btn primary",
            onClick: this.performUpdate
          },
          "\u{1F4CB} Copy Install Command"
        ))
      )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-header" }, /* @__PURE__ */ Spicetify.React.createElement("h1", { className: "stats-title" }, "Listening Stats"), /* @__PURE__ */ Spicetify.React.createElement("p", { className: "stats-subtitle" }, "Your personal music analytics")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-row" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card hero" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value" }, formatDurationLong(stats.totalTimeMs)), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Time Listened"), periodTabs, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-secondary" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, stats.trackCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, stats.uniqueArtistCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-value" }, stats.uniqueTrackCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-stat-label" }, "Unique")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value green" }, "$", payout), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Paid to Artists")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value orange" }, stats.streakDays), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Day Streak")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value purple" }, stats.newArtistsCount), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "New Artists")))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-card" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-colored" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stat-text" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-value red" }, Math.floor(stats.skipRate * 100), "%"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "overview-label" }, "Skip Rate")))))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-lists-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.music } }), "Top Tracks")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topTracks.slice(0, TOP_ITEMS_COUNT).map((t, i) => /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          key: t.trackUri,
          className: "item-row",
          onClick: () => navigateToUri(t.trackUri)
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
        t.albumArt && /* @__PURE__ */ Spicetify.React.createElement("img", { src: t.albumArt, className: "item-art", alt: "" }),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, t.trackName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, t.artistName)),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, t.playCount, " plays"), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(t.totalTimeMs))),
        /* @__PURE__ */ Spicetify.React.createElement(
          "button",
          {
            className: `heart-btn ${likedTracks.get(t.trackUri) ? "liked" : ""}`,
            onClick: (e) => this.handleLikeToggle(t.trackUri, e),
            dangerouslySetInnerHTML: {
              __html: likedTracks.get(t.trackUri) ? Icons.heartFilled : Icons.heart
            }
          }
        )
      )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.users } }), "Top Artists")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topArtists.slice(0, TOP_ITEMS_COUNT).map((a, i) => {
        const img = artistImages.get(a.artistUri) || a.artistImage;
        return /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            key: a.artistUri || a.artistName,
            className: "item-row",
            onClick: () => a.artistUri && navigateToUri(a.artistUri)
          },
          /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
          img && /* @__PURE__ */ Spicetify.React.createElement("img", { src: img, className: "item-art round", alt: "" }),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.artistName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.playCount, " plays")),
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(a.totalTimeMs)))
        );
      }))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "top-list-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "top-list-title" }, /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.album } }), "Top Albums")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-list" }, stats.topAlbums.slice(0, TOP_ITEMS_COUNT).map((a, i) => /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          key: a.albumUri,
          className: "item-row",
          onClick: () => navigateToUri(a.albumUri)
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { className: `item-rank ${getRankClass(i)}` }, i + 1),
        a.albumArt && /* @__PURE__ */ Spicetify.React.createElement("img", { src: a.albumArt, className: "item-art", alt: "" }),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-info" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-name" }, a.albumName), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-meta" }, a.artistName)),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "item-stats" }, /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-plays" }, a.playCount, " plays"), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "item-time" }, formatDuration(a.totalTimeMs)))
      ))))), stats.hourlyDistribution.some((h) => h > 0) && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "activity-title" }, "Activity by Hour"), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-peak" }, "Peak: ", /* @__PURE__ */ Spicetify.React.createElement("strong", null, formatHour(stats.peakHour)))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-chart" }, stats.hourlyDistribution.map((val, hr) => {
        const max = Math.max(...stats.hourlyDistribution, 1);
        const h = val > 0 ? Math.max(val / max * 100, 5) : 0;
        return /* @__PURE__ */ Spicetify.React.createElement(
          "div",
          {
            key: hr,
            className: `activity-bar ${hr === stats.peakHour && val > 0 ? "peak" : ""}`,
            style: { height: `${h}%` }
          },
          /* @__PURE__ */ Spicetify.React.createElement("div", { className: "activity-bar-tooltip" }, formatHour(hr), ": ", formatMinutes(val))
        );
      })), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "chart-labels" }, /* @__PURE__ */ Spicetify.React.createElement("span", null, "12am"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "6am"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "12pm"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "6pm"), /* @__PURE__ */ Spicetify.React.createElement("span", null, "12am"))), stats.recentTracks.length > 0 && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-section" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-header" }, /* @__PURE__ */ Spicetify.React.createElement("h3", { className: "recent-title" }, "Recently Played")), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-scroll" }, stats.recentTracks.slice(0, 12).map((t) => /* @__PURE__ */ Spicetify.React.createElement(
        "div",
        {
          key: `${t.trackUri}-${t.startedAt}`,
          className: "recent-card",
          onClick: () => navigateToUri(t.trackUri)
        },
        t.albumArt ? /* @__PURE__ */ Spicetify.React.createElement("img", { src: t.albumArt, className: "recent-art", alt: "" }) : /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-art" }),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-name" }, t.trackName),
        /* @__PURE__ */ Spicetify.React.createElement("div", { className: "recent-meta" }, t.artistName)
      )))), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "stats-footer" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "footer-left" }, /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "settings-toggle",
          onClick: () => this.setState({ showSettings: !showSettings })
        },
        /* @__PURE__ */ Spicetify.React.createElement("span", { dangerouslySetInnerHTML: { __html: Icons.settings } }),
        "Settings"
      ), updateInfo?.available && /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn primary",
          onClick: () => this.setState({ showUpdateModal: true })
        },
        "Update v",
        updateInfo.latestVersion
      )), /* @__PURE__ */ Spicetify.React.createElement("span", { className: "version-text" }, "v", VERSION, " - \u2764\uFE0F made with love by Xndr")), showSettings && /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-panel" }, /* @__PURE__ */ Spicetify.React.createElement("div", { className: "settings-row" }, /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: () => this.loadStats() }, "Refresh"), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn",
          onClick: async () => {
            await runBackgroundEnrichment(true);
            this.loadStats();
            Spicetify.showNotification("Data enriched");
          }
        },
        "Enrich Data"
      ), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn",
          onClick: () => {
            resetRateLimit();
            clearApiCaches();
            Spicetify.showNotification("Cache cleared");
          }
        },
        "Clear Cache"
      ), /* @__PURE__ */ Spicetify.React.createElement("button", { className: "footer-btn", onClick: this.checkUpdatesManual }, "Check Updates"), /* @__PURE__ */ Spicetify.React.createElement(
        "button",
        {
          className: "footer-btn danger",
          onClick: async () => {
            if (confirm("Delete all listening data?")) {
              await clearAllData();
              this.setState({ stats: null });
            }
          }
        },
        "Reset Data"
      )), /* @__PURE__ */ Spicetify.React.createElement("div", { className: "api-status" }, /* @__PURE__ */ Spicetify.React.createElement(
        "span",
        {
          className: `status-dot ${apiAvailable ? "green" : "red"}`
        }
      ), "API:", " ", apiAvailable ? "Available" : `Limited (${Math.ceil(getRateLimitRemaining() / 60)}m)`)));
    }
  };
  var index_default = StatsPage;
  return __toCommonJS(index_exports);
})();
var render=()=>Spicetify.React.createElement(ListeningStatsApp.default);var routes=[];
