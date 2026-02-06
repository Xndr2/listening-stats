import { ListeningStats, TimePeriod } from "../types/listeningstats";
import { getActiveProvider } from "./providers";

const statsCache = new Map<
  string,
  { data: ListeningStats; expiresAt: number }
>();
const STATS_CACHE_TTL = 120000;

export function clearStatsCache(): void {
  statsCache.clear();
}

export async function calculateStats(
  period: TimePeriod,
): Promise<ListeningStats> {
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

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatDurationLong(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes} min`;
  }
}

export function getPeriodDisplayName(period: TimePeriod): string {
  const provider = getActiveProvider();
  if (provider) {
    return provider.periodLabels[period] || period;
  }
  return period;
}

export function generateShareText(
  stats: ListeningStats,
  period: TimePeriod,
): string {
  const periodName = getPeriodDisplayName(period);
  const lines = [
    `My Spotify Stats (${periodName}):`,
    `${formatDurationLong(stats.totalTimeMs)} listened across ${stats.trackCount} tracks`,
  ];

  if (stats.topTracks[0]) {
    lines.push(
      `Top Track: ${stats.topTracks[0].trackName} - ${stats.topTracks[0].artistName}`,
    );
  }
  if (stats.topArtists[0]) {
    lines.push(`Top Artist: ${stats.topArtists[0].artistName}`);
  }
  if (stats.streakDays > 0) {
    lines.push(`${stats.streakDays}-day streak`);
  }

  lines.push("", "via Listening Stats for Spicetify");
  return lines.join("\n");
}
