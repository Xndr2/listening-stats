import type { ListeningStats } from "../types/listeningstats";
import { getPeriodDisplayName, formatDuration } from "./stats";

function downloadFile(content: string, filename: string, mimeType: string): void {
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

export function exportStatsAsJSON(stats: ListeningStats, period: string): void {
  const periodName = getPeriodDisplayName(period);
  const data = {
    period: periodName,
    exportedAt: new Date().toISOString(),
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
      playCount: t.playCount || 0,
    })),
    topArtists: stats.topArtists.map((a) => ({
      rank: a.rank,
      artist: a.artistName,
      genres: a.genres,
      playCount: a.playCount || 0,
    })),
    topAlbums: stats.topAlbums.map((a) => ({
      album: a.albumName,
      artist: a.artistName,
      playCount: a.playCount || 0,
    })),
    topGenres: stats.topGenres.map((g) => ({
      genre: g.genre,
      count: g.count,
    })),
  };

  const filename = `listening-stats-${period}-${new Date().toISOString().split("T")[0]}.json`;
  downloadFile(JSON.stringify(data, null, 2), filename, "application/json");
}

export function exportStatsAsCSV(stats: ListeningStats, period: string): void {
  const periodName = getPeriodDisplayName(period);
  const lines: string[] = [];

  lines.push(`Period,${periodName}`);
  lines.push(`Exported,${new Date().toISOString()}`);
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

  const filename = `listening-stats-${period}-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(lines.join("\n"), filename, "text/csv");
}

export async function exportRawEventsAsJSON(): Promise<void> {
  const { getAllPlayEvents } = await import("./storage");
  const events = await getAllPlayEvents();
  const filename = `listening-stats-raw-${new Date().toISOString().split("T")[0]}.json`;
  downloadFile(JSON.stringify(events, null, 2), filename, "application/json");
}

export async function exportRawEventsAsCSV(): Promise<void> {
  const { getAllPlayEvents } = await import("./storage");
  const events = await getAllPlayEvents();
  const lines: string[] = [];
  lines.push("Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At");
  for (const e of events) {
    lines.push([
      `"${e.trackName.replace(/"/g, '""')}"`,
      `"${e.artistName.replace(/"/g, '""')}"`,
      `"${e.albumName.replace(/"/g, '""')}"`,
      e.durationMs,
      e.playedMs,
      new Date(e.startedAt).toISOString(),
      new Date(e.endedAt).toISOString(),
    ].join(","));
  }
  const filename = `listening-stats-raw-${new Date().toISOString().split("T")[0]}.csv`;
  downloadFile(lines.join("\n"), filename, "text/csv");
}
