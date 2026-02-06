import { LastfmConfig } from "../types/listeningstats";

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
const STORAGE_KEY = "listening-stats:lastfm";
const CACHE_TTL_MS = 300000;

let configCache: LastfmConfig | null | undefined = undefined;

export function getConfig(): LastfmConfig | null {
  if (configCache !== undefined) return configCache;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      configCache = JSON.parse(stored);
      return configCache!;
    }
  } catch { /* ignore */ }
  configCache = null;
  return null;
}

export function saveConfig(config: LastfmConfig): void {
  configCache = config;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  configCache = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isConnected(): boolean {
  const config = getConfig();
  return !!(config?.username && config?.apiKey);
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

export function clearLastfmCache(): void {
  cache.clear();
}

const LASTFM_PLACEHOLDER_HASHES = [
  "2a96cbd8b46e442fc41c2b86b821562f",
  "c6f59c1e5e7240a4c0d427abd71f3dbb",
];

function isPlaceholderImage(url: string): boolean {
  return LASTFM_PLACEHOLDER_HASHES.some((h) => url.includes(h));
}

async function lastfmFetch<T>(params: Record<string, string>): Promise<T> {
  const config = getConfig();
  if (!config) throw new Error("Last.fm not configured");

  const url = new URL(LASTFM_API_URL);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const cacheKey = url.toString();
  const cached = getCached<T>(cacheKey);
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
  return data as T;
}

export interface LastfmUserInfo {
  valid: boolean;
  username: string;
  totalScrobbles: number;
  registered: string;
  imageUrl?: string;
}

export async function validateUser(
  username: string,
  apiKey: string,
): Promise<LastfmUserInfo> {
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
    imageUrl: user.image?.find((i: any) => i.size === "medium")?.["#text"],
  };
}

export function mapPeriod(
  period: "short_term" | "medium_term" | "long_term",
): string {
  switch (period) {
    case "short_term": return "1month";
    case "medium_term": return "6month";
    case "long_term": return "overall";
  }
}

export interface LastfmTrack {
  name: string;
  artist: string;
  playCount: number;
  mbid?: string;
  url: string;
  imageUrl?: string;
  durationSecs?: number;
}

export interface TopTracksResult {
  tracks: LastfmTrack[];
  total: number;
}

export async function getTopTracks(
  period: string,
  limit = 200,
): Promise<TopTracksResult> {
  const config = getConfig();
  if (!config) return { tracks: [], total: 0 };

  const data = await lastfmFetch<any>({
    method: "user.gettoptracks",
    user: config.username,
    period,
    limit: String(limit),
  });

  const total = parseInt(data.toptracks?.["@attr"]?.total || "0", 10);
  const tracks = (data.toptracks?.track || []).map((t: any) => {
    const img = t.image?.find((i: any) => i.size === "large")?.["#text"]?.trim();
    return {
      name: t.name,
      artist: t.artist?.name || "",
      playCount: parseInt(t.playcount, 10) || 0,
      mbid: t.mbid || undefined,
      url: t.url,
      imageUrl: img && !isPlaceholderImage(img) ? img : undefined,
      durationSecs: parseInt(t.duration, 10) || undefined,
    };
  });
  return { tracks, total };
}

export interface LastfmArtist {
  name: string;
  playCount: number;
  mbid?: string;
  url: string;
  imageUrl?: string;
}

export interface TopArtistsResult {
  artists: LastfmArtist[];
  total: number;
}

export async function getTopArtists(
  period: string,
  limit = 100,
): Promise<TopArtistsResult> {
  const config = getConfig();
  if (!config) return { artists: [], total: 0 };

  const data = await lastfmFetch<any>({
    method: "user.gettopartists",
    user: config.username,
    period,
    limit: String(limit),
  });

  const total = parseInt(data.topartists?.["@attr"]?.total || "0", 10);
  const artists = (data.topartists?.artist || []).map((a: any) => {
    const img = a.image?.find((i: any) => i.size === "large")?.["#text"]?.trim();
    return {
      name: a.name,
      playCount: parseInt(a.playcount, 10) || 0,
      mbid: a.mbid || undefined,
      url: a.url,
      imageUrl: img && !isPlaceholderImage(img) ? img : undefined,
    };
  });
  return { artists, total };
}

export interface LastfmAlbum {
  name: string;
  artist: string;
  playCount: number;
  mbid?: string;
  url: string;
  imageUrl?: string;
}

export interface TopAlbumsResult {
  albums: LastfmAlbum[];
  total: number;
}

export async function getTopAlbums(
  period: string,
  limit = 100,
): Promise<TopAlbumsResult> {
  const config = getConfig();
  if (!config) return { albums: [], total: 0 };

  const data = await lastfmFetch<any>({
    method: "user.gettopalbums",
    user: config.username,
    period,
    limit: String(limit),
  });

  const total = parseInt(data.topalbums?.["@attr"]?.total || "0", 10);
  const albums = (data.topalbums?.album || []).map((a: any) => {
    const img = a.image?.find((i: any) => i.size === "large")?.["#text"]?.trim();
    return {
      name: a.name,
      artist: a.artist?.name || "",
      playCount: parseInt(a.playcount, 10) || 0,
      mbid: a.mbid || undefined,
      url: a.url,
      imageUrl: img && !isPlaceholderImage(img) ? img : undefined,
    };
  });
  return { albums, total };
}

export interface LastfmRecentTrack {
  name: string;
  artist: string;
  album: string;
  albumArt?: string;
  playedAt: string;
  nowPlaying: boolean;
}

export async function getRecentTracks(limit = 50): Promise<LastfmRecentTrack[]> {
  const config = getConfig();
  if (!config) return [];

  const data = await lastfmFetch<any>({
    method: "user.getrecenttracks",
    user: config.username,
    limit: String(limit),
  });

  const tracks = data.recenttracks?.track || [];
  return tracks
    .filter((t: any) => t.date || t["@attr"]?.nowplaying)
    .map((t: any) => {
      const img = t.image?.find((i: any) => i.size === "large")?.["#text"]?.trim();
      return {
        name: t.name,
        artist: t.artist?.["#text"] || t.artist?.name || "",
        album: t.album?.["#text"] || "",
        albumArt: img && !isPlaceholderImage(img) ? img : undefined,
        playedAt: t.date?.uts
          ? new Date(parseInt(t.date.uts, 10) * 1000).toISOString()
          : new Date().toISOString(),
        nowPlaying: t["@attr"]?.nowplaying === "true",
      };
    });
}

export async function getUserInfo(): Promise<LastfmUserInfo | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    return await validateUser(config.username, config.apiKey);
  } catch {
    return null;
  }
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s*\(feat\.?.*?\)/gi, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/['']/g, "'")
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ");
}

export function makeTrackKey(artist: string, track: string): string {
  return `${normalize(artist)}|||${normalize(track)}`;
}

export function buildTrackPlayCountMap(
  input: LastfmTrack[] | TopTracksResult,
): Map<string, number> {
  const tracks = Array.isArray(input) ? input : input.tracks;
  const map = new Map<string, number>();
  for (const t of tracks) {
    map.set(makeTrackKey(t.artist, t.name), t.playCount);
  }
  return map;
}

export function buildArtistPlayCountMap(
  input: LastfmArtist[] | TopArtistsResult,
): Map<string, number> {
  const artists = Array.isArray(input) ? input : input.artists;
  const map = new Map<string, number>();
  for (const a of artists) {
    map.set(normalize(a.name), a.playCount);
  }
  return map;
}

export function buildAlbumPlayCountMap(
  input: LastfmAlbum[] | TopAlbumsResult,
): Map<string, number> {
  const albums = Array.isArray(input) ? input : input.albums;
  const map = new Map<string, number>();
  for (const a of albums) {
    map.set(`${normalize(a.artist)}|||${normalize(a.name)}`, a.playCount);
  }
  return map;
}
