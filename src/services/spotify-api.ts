import type * as Spotify from "../types/spotify";
import {
  CircuitBreaker,
  createBatchCoalescer,
  ApiError,
} from "./api-resilience";

const STORAGE_PREFIX = "listening-stats:";
const QUEUE_DELAY_MS = 300;
const MAX_BATCH = 50;
const CACHE_TTL_MS = 300000;
const DEFAULT_BACKOFF_MS = 60000;
const MAX_BACKOFF_MS = 600000;

let rateLimitedUntil = 0;

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
  /* ignore */
}

export function isApiAvailable(): boolean {
  return Date.now() >= rateLimitedUntil;
}

export function getRateLimitRemaining(): number {
  if (rateLimitedUntil <= 0) return 0;
  return Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
}

export function resetRateLimit(): void {
  rateLimitedUntil = 0;
  localStorage.removeItem(`${STORAGE_PREFIX}rateLimitedUntil`);
  circuitBreaker.reset();
}

function setRateLimit(error: any): void {
  let backoffMs = DEFAULT_BACKOFF_MS;

  const retryAfterRaw =
    error?.headers?.["retry-after"] ??
    error?.body?.["Retry-After"] ??
    error?.headers?.["Retry-After"];

  if (retryAfterRaw != null) {
    const parsed = parseInt(String(retryAfterRaw), 10);
    if (!isNaN(parsed) && parsed > 0) {
      backoffMs = Math.min(parsed * 1000, MAX_BACKOFF_MS);
    }
  }

  rateLimitedUntil = Date.now() + backoffMs;
  localStorage.setItem(
    `${STORAGE_PREFIX}rateLimitedUntil`,
    rateLimitedUntil.toString(),
  );
}

const cache = new Map<string, { data: any; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearApiCaches(): void {
  cache.clear();
}

type Priority = "high" | "normal" | "low";
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

type QueueItem = {
  key: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  priority: Priority;
};

const queue: QueueItem[] = [];
let draining = false;
const inflight = new Map<string, Promise<any>>();
const circuitBreaker = new CircuitBreaker(5, 60000);

function enqueueWithPriority<T>(
  key: string,
  fn: () => Promise<T>,
  priority: Priority = "normal",
): Promise<T> {
  // Dedup: return existing in-flight promise for same key
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = new Promise<T>((resolve, reject) => {
    queue.push({ key, fn, resolve, reject, priority });
    queue.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    if (!draining) drainQueue();
  });

  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}

async function drainQueue(): Promise<void> {
  draining = true;

  while (queue.length > 0) {
    if (!isApiAvailable()) {
      const waitMs = rateLimitedUntil - Date.now();
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const item = queue.shift()!;
    try {
      const result = await circuitBreaker.execute(() => item.fn());
      item.resolve(result);
    } catch (error: any) {
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

async function apiFetch<T>(url: string): Promise<T> {
  const cached = getCached<T>(url);
  if (cached) return cached;

  return enqueueWithPriority(url, async () => {
    let response: any;
    try {
      response = await Spicetify.CosmosAsync.get(url);
    } catch (err: any) {
      if (err?.status === 429 || String(err?.message || "").includes("429")) {
        setRateLimit(err);
        throw new ApiError(
          err?.message || "Rate limited",
          429,
          true,
        );
      }
      const status = err?.status as number | undefined;
      throw new ApiError(
        err?.message || "API request failed",
        status,
        status !== undefined && (status === 429 || status >= 500),
      );
    }

    if (!response) {
      throw new ApiError("Empty API response", undefined, false);
    }
    if (response.error) {
      const status: number = response.error.status;
      const message =
        response.error.message || `Spotify API error ${status}`;
      if (status === 429) setRateLimit(response);
      throw new ApiError(message, status, status === 429 || status >= 500);
    }

    setCache(url, response);
    return response as T;
  });
}

export async function getTopTracks(
  timeRange: "short_term" | "medium_term" | "long_term",
): Promise<Spotify.Track[]> {
  const response = await apiFetch<Spotify.TopTracksResponse>(
    `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`,
  );
  return response?.items || [];
}

export async function getTopArtists(
  timeRange: "short_term" | "medium_term" | "long_term",
): Promise<Spotify.Artist[]> {
  const response = await apiFetch<Spotify.TopArtistsResponse>(
    `https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=50`,
  );
  return response?.items || [];
}

export async function getRecentlyPlayed(): Promise<Spotify.RecentlyPlayedResponse> {
  return apiFetch<Spotify.RecentlyPlayedResponse>(
    `https://api.spotify.com/v1/me/player/recently-played?limit=50`,
  );
}

export function prefetchPeriod(
  period: "short_term" | "medium_term" | "long_term",
): void {
  getTopTracks(period).catch(() => {});
  getTopArtists(period).catch(() => {});
}

export interface SpotifySearchResult {
  uri?: string;
  imageUrl?: string;
}

const SEARCH_CACHE_KEY = "listening-stats:searchCache";
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map<string, SpotifySearchResult>();

try {
  const stored = localStorage.getItem(SEARCH_CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    for (const [k, v] of Object.entries(parsed)) {
      searchCache.set(k, v as SpotifySearchResult);
    }
  }
} catch {
  /* ignore */
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersistSearchCache(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const obj: Record<string, SpotifySearchResult> = {};
      let count = 0;
      for (const [k, v] of searchCache) {
        if (v.uri || v.imageUrl) {
          obj[k] = v;
          if (++count >= SEARCH_CACHE_MAX) break;
        }
      }
      localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(obj));
    } catch {
      /* storage full */
    }
  }, 2000);
}

const SEARCH_CONCURRENCY = 2;
const SEARCH_DELAY_MS = 150;
let activeSearchCount = 0;
const searchWaiters: (() => void)[] = [];

async function acquireSearchSlot(): Promise<void> {
  if (activeSearchCount < SEARCH_CONCURRENCY) {
    activeSearchCount++;
    return;
  }
  await new Promise<void>((resolve) => searchWaiters.push(resolve));
}

function releaseSearchSlot(): void {
  setTimeout(() => {
    activeSearchCount--;
    if (searchWaiters.length > 0) {
      activeSearchCount++;
      searchWaiters.shift()!();
    }
  }, SEARCH_DELAY_MS);
}

async function throttledSearch(
  cacheKey: string,
  fetchFn: () => Promise<SpotifySearchResult>,
): Promise<SpotifySearchResult> {
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey)!;

  await acquireSearchSlot();
  try {
    if (searchCache.has(cacheKey)) return searchCache.get(cacheKey)!;

    const result = await fetchFn();
    searchCache.set(cacheKey, result);
    schedulePersistSearchCache();
    return result;
  } catch {
    const empty: SpotifySearchResult = {};
    searchCache.set(cacheKey, empty);
    return empty;
  } finally {
    releaseSearchSlot();
  }
}

export async function searchTrack(
  trackName: string,
  artistName: string,
): Promise<SpotifySearchResult> {
  const cacheKey = `s:t:${artistName}|||${trackName}`;
  return throttledSearch(cacheKey, async () => {
    const q = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const resp = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
    );
    const item = resp?.tracks?.items?.[0];
    return { uri: item?.uri, imageUrl: item?.album?.images?.[0]?.url };
  });
}

export async function searchArtist(
  artistName: string,
): Promise<SpotifySearchResult> {
  const cacheKey = `s:a:${artistName}`;
  return throttledSearch(cacheKey, async () => {
    const q = encodeURIComponent(`artist:${artistName}`);
    const resp = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`,
    );
    const item = resp?.artists?.items?.[0];
    return { uri: item?.uri, imageUrl: item?.images?.[0]?.url };
  });
}

export async function searchAlbum(
  albumName: string,
  artistName: string,
): Promise<SpotifySearchResult> {
  const cacheKey = `s:al:${artistName}|||${albumName}`;
  return throttledSearch(cacheKey, async () => {
    const q = encodeURIComponent(`album:${albumName} artist:${artistName}`);
    const resp = await Spicetify.CosmosAsync.get(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=1`,
    );
    const item = resp?.albums?.items?.[0];
    return { uri: item?.uri, imageUrl: item?.images?.[0]?.url };
  });
}

export async function searchTrackImage(
  trackName: string,
  artistName: string,
): Promise<string | undefined> {
  return (await searchTrack(trackName, artistName)).imageUrl;
}

export async function searchArtistImage(
  artistName: string,
): Promise<string | undefined> {
  return (await searchArtist(artistName)).imageUrl;
}

export async function getArtistsBatch(
  artistIds: string[],
): Promise<Spotify.Artist[]> {
  const unique = [...new Set(artistIds)].filter(Boolean);
  if (unique.length === 0) return [];

  const results: Spotify.Artist[] = [];

  for (let i = 0; i < unique.length; i += MAX_BATCH) {
    const chunk = unique.slice(i, i + MAX_BATCH);
    const ids = chunk.join(",");

    try {
      const response = await apiFetch<Spotify.SeveralArtistsResponse>(
        `https://api.spotify.com/v1/artists?ids=${ids}`,
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

const artistCoalescer = createBatchCoalescer<string, Spotify.Artist>(
  async (ids: string[]) => {
    const results = new Map<string, Spotify.Artist>();
    for (let i = 0; i < ids.length; i += MAX_BATCH) {
      const chunk = ids.slice(i, i + MAX_BATCH);
      try {
        const response = await apiFetch<Spotify.SeveralArtistsResponse>(
          `https://api.spotify.com/v1/artists?ids=${chunk.join(",")}`,
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
  MAX_BATCH,
);

export function getArtist(
  artistId: string,
): Promise<Spotify.Artist | undefined> {
  return artistCoalescer(artistId);
}
