/**
 * Refreshes due auto playlists: shortly after Spotify starts, then whenever
 * the local day changes while Spotify stays open (a one-minute day check
 * survives sleep and clock jumps better than a timer aimed at midnight).
 */
import { captureError } from "../shared/errors/capture";
import { dayStamp } from "../shared/playlists/marker";
import { spotifyPlaylistApi } from "../shared/playlists/spotify-api";
import { runDue } from "../shared/playlists/sync";

async function tick(): Promise<void> {
	const api = spotifyPlaylistApi();
	if (!api) return;
	try {
		const results = await runDue(api);
		for (const r of Object.values(results)) {
			if (r.status === "error") void captureError(new Error(r.message), "extension", "handled", "playlists");
		}
	} catch (err) {
		void captureError(err, "extension", "handled", "playlists");
	}
}

export function startPlaylistScheduler(): void {
	let day = dayStamp();
	// Adopting also finds playlists made on other devices, so run even with none configured.
	setTimeout(() => void tick(), 20_000);
	setInterval(() => {
		const now = dayStamp();
		if (now === day) return;
		day = now;
		void tick();
	}, 60_000);
}
