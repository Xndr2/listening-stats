import { StatsfmConfig } from "../types/listeningstats";

const API_BASE = "https://api.stats.fm/api/v1";
const STORAGE_KEY = "listening-stats:statsfm";
const CACHE_TTL_MS = 120000;

let configCache: StatsfmConfig | null | undefined = undefined;

export function getConfig(): StatsfmConfig | null {
  if (configCache !== undefined) return configCache;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      configCache = JSON.parse(stored);
      return configCache!;
    }
  } catch {
    /* ignore */
  }
  configCache = null;
  return null;
}

export function saveConfig(config: StatsfmConfig): void {
  configCache = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  configCache = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isConnected(): boolean {
  const config = getConfig();
  return !!config?.username;
}

const cache = new Map<string, { data: any; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearStatsfmCache(): void {
  cache.clear();
}

async function statsfmFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const cached = getCached<T>(url);
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
  setCache(url, data);
  return data as T;
}

export interface StatsfmUserInfo {
  id: string;
  customId: string;
  displayName: string;
  image?: string;
  isPlus: boolean;
}

export async function validateUser(username: string): Promise<StatsfmUserInfo> {
  const data = await statsfmFetch<any>(
    `/users/${encodeURIComponent(username)}`,
  );
  const item = data.item || data;
  if (!item || !item.customId) {
    throw new Error("User not found");
  }
  return {
    id: item.id,
    customId: item.customId,
    displayName: item.displayName || item.customId,
    image: item.image || undefined,
    isPlus: !!item.isPlus,
  };
}

export type StatsfmRange = "today" | "days" | "weeks" | "months" | "lifetime";

export interface StatsfmTopTrack {
  position: number;
  streams: number;
  playedMs?: number;
  track: {
    id: number;
    name: string;
    durationMs: number;
    externalIds: { spotify?: string[] };
    albums: Array<{ id: number; name: string; image: string }>;
    artists: Array<{ id: number; name: string }>;
  };
}

export interface StatsfmTopArtist {
  position: number;
  streams: number;
  playedMs?: number;
  artist: {
    id: number;
    name: string;
    image?: string;
    externalIds: { spotify?: string[] };
    genres: string[];
  };
}

export interface StatsfmTopAlbum {
  position: number;
  streams: number;
  playedMs?: number;
  album: {
    id: number;
    name: string;
    image: string;
    externalIds: { spotify?: string[] };
    artists: Array<{ id: number; name: string }>;
  };
}

export interface StatsfmTopGenre {
  genre: { tag: string };
  position: number;
  streams: number;
}

export interface StatsfmRecentStream {
  endTime: string;
  durationMs: number;
  track: {
    id: number;
    name: string;
    durationMs: number;
    externalIds: { spotify?: string[] };
    albums: Array<{ id: number; name: string; image: string }>;
    artists: Array<{
      id: number;
      name: string;
      externalIds?: { spotify?: string[] };
    }>;
  };
}

export interface StatsfmStreamStats {
  durationMs: number;
  count: number;
  cardinality: {
    tracks: number;
    artists: number;
    albums: number;
  };
}

function getUsername(): string {
  const config = getConfig();
  if (!config?.username) throw new Error("stats.fm not configured");
  return encodeURIComponent(config.username);
}

export async function getTopTracks(
  range: StatsfmRange,
  limit = 50,
): Promise<StatsfmTopTrack[]> {
  const data = await statsfmFetch<any>(
    `/users/${getUsername()}/top/tracks?range=${range}&limit=${limit}&orderBy=COUNT`,
  );
  return data.items || [];
}

export async function getTopArtists(
  range: StatsfmRange,
  limit = 50,
): Promise<StatsfmTopArtist[]> {
  const data = await statsfmFetch<any>(
    `/users/${getUsername()}/top/artists?range=${range}&limit=${limit}&orderBy=COUNT`,
  );
  return data.items || [];
}

export async function getTopAlbums(
  range: StatsfmRange,
  limit = 50,
): Promise<StatsfmTopAlbum[]> {
  try {
    const data = await statsfmFetch<any>(
      `/users/${getUsername()}/top/albums?range=${range}&limit=${limit}&orderBy=COUNT`,
    );
    return data.items || [];
  } catch {
    // Top albums endpoint returns 400 for non-Plus users
    return [];
  }
}

export async function getTopGenres(
  range: StatsfmRange,
  limit = 20,
): Promise<StatsfmTopGenre[]> {
  const data = await statsfmFetch<any>(
    `/users/${getUsername()}/top/genres?range=${range}&limit=${limit}`,
  );
  return data.items || [];
}

export async function getRecentStreams(
  limit = 50,
): Promise<StatsfmRecentStream[]> {
  const data = await statsfmFetch<any>(
    `/users/${getUsername()}/streams/recent?limit=${limit}`,
  );
  return data.items || [];
}

export async function getStreamStats(): Promise<StatsfmStreamStats> {
  const data = await statsfmFetch<any>(`/users/${getUsername()}/streams/stats`);
  const item = data.items || data;
  return {
    durationMs: item.durationMs || 0,
    count: item.count || 0,
    cardinality: item.cardinality || { tracks: 0, artists: 0, albums: 0 },
  };
}

export function extractSpotifyUri(
  externalIds: { spotify?: string[] } | undefined,
  type: "track" | "artist" | "album",
): string {
  const ids = externalIds?.spotify;
  if (!ids || ids.length === 0) return "";
  const id = ids[0];
  if (id.startsWith("spotify:")) return id;
  return `spotify:${type}:${id}`;
}
