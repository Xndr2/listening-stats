import { maybeUpdateDailyPlaylist } from "../shared/playlist/builder";
import { toLocalDateKey } from "../shared/util/date-key";

const DAY_CHECK_INTERVAL_MS = 60_000;

/**
 * Runs the daily playlist refresh: once at Spotify startup, and again when the
 * local calendar day changes while the client stays open. A one-minute
 * day-key poll (instead of a timeout aimed at midnight) also survives
 * sleep/resume clock jumps.
 */
export function initPlaylistScheduler(): void {
	let lastSeenDay = toLocalDateKey(Date.now());

	void maybeUpdateDailyPlaylist().catch((err) => {
		console.error("[listening-stats] playlist scheduler run failed:", err);
	});

	setInterval(() => {
		const day = toLocalDateKey(Date.now());
		if (day === lastSeenDay) return;
		lastSeenDay = day;
		void maybeUpdateDailyPlaylist().catch((err) => {
			console.error("[listening-stats] playlist scheduler run failed:", err);
		});
	}, DAY_CHECK_INTERVAL_MS);
}
