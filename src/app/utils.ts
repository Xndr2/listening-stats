import { searchTrack, searchArtist, searchAlbum } from "../services/spotify-api";

export function navigateToUri(uri: string): void {
  if (uri && Spicetify.Platform?.History) {
    const [, type, id] = uri.split(':');
    if (type && id) {
      Spicetify.Platform.History.push(`/${type}/${id}`);
    }
  }
}

export async function lazyNavigate(
  type: "track" | "artist" | "album",
  name: string,
  artistName?: string,
): Promise<void> {
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

export async function toggleLike(trackUri: string, isLiked: boolean): Promise<boolean> {
  try {
    if (isLiked) {
      await Spicetify.Platform.LibraryAPI.remove({ uris: [trackUri] });
    } else {
      await Spicetify.Platform.LibraryAPI.add({ uris: [trackUri] });
    }
    return !isLiked;
  } catch (error) {
    console.error('[ListeningStats] Failed to toggle like:', error);
    return isLiked;
  }
}

export async function checkLikedTracks(trackUris: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (trackUris.length === 0) return result;

  try {
    const contains = await Spicetify.Platform.LibraryAPI.contains(...trackUris);
    trackUris.forEach((uri, i) => result.set(uri, contains[i]));
  } catch (error) {
    console.error('[ListeningStats] Failed to check liked status:', error);
  }
  return result;
}

export function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function formatMinutes(ms: number): string {
  return `${Math.round(ms / 60000)} min`;
}

const PAYOUT_PER_STREAM = 0.004;

export function estimateArtistPayout(streamCount: number): string {
  const payout = streamCount * PAYOUT_PER_STREAM;
  return payout.toFixed(2);
}

export function getRankClass(index: number): string {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return '';
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
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
