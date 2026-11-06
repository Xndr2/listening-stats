/**
 * Small wrappers around Spotify actions, each feature-detected so a client
 * update that moves an API degrades to "nothing happens" plus a log entry,
 * never a crash.
 */
import { captureError } from "../shared/errors/capture";
import { isPlayableUri } from "../shared/providers/types";

/** spotify:album:abc -> /album/abc */
export function uriToPath(uri: string): string | null {
	const m = uri.match(/^spotify:(track|album|artist|playlist|show|episode):([A-Za-z0-9]+)$/);
	return m ? `/${m[1]}/${m[2]}` : null;
}

export function openUri(uri: string): void {
	const path = uriToPath(uri);
	if (path) Spicetify.Platform?.History?.push(path);
}

/** For sources without Spotify uris (Last.fm): open Spotify search instead. */
export function openSearch(query: string): void {
	Spicetify.Platform?.History?.push(`/search/${encodeURIComponent(query)}`);
}

export async function playUri(uri: string): Promise<void> {
	if (!isPlayableUri(uri)) return;
	try {
		await Spicetify.Player.playUri(uri);
	} catch (err) {
		void captureError(err, "app", "handled", "play");
		Spicetify.showNotification("Spotify couldn't play that.", true);
	}
}

/** Open the item, or search for it when there is no uri. */
export function openItem(uri: string | undefined, fallbackQuery: string): void {
	if (isPlayableUri(uri)) openUri(uri);
	else openSearch(fallbackQuery);
}
