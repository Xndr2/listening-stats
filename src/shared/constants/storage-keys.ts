/**
 * Every localStorage key the app owns, in one place.
 *
 * Keys shared with v2 keep v2's exact name AND value encoding, so a user who
 * downgrades still finds their settings. Keys only v3 uses live under
 * "listening-stats:v3:".
 */
const V2 = "listening-stats:";
const V3 = "listening-stats:v3:";

export const V2_KEYS = {
	PLAY_THRESHOLD: `${V2}playThreshold`,
	PLAY_THRESHOLD_MODE: `${V2}playThresholdMode`,
	PLAY_THRESHOLD_PERCENT: `${V2}playThresholdPercent`,
	TRACKING_PAUSED: `${V2}tracking-paused`,
	SKIP_REPEATS: `${V2}skip-repeats`,
	LOGGING: `${V2}logging`,
	TRACKING_HEALTH: `${V2}tracking-health`,
	LAST_WRITE: `${V2}lastWrite`,
	ACTIVE_PROVIDER: `${V2}active-provider`,
	PREFERENCES: `${V2}preferences`,
	STATSFM_CONFIG: `${V2}statsfm`,
	LASTFM_CONFIG: `${V2}lastfm-provider`,
	LASTFM_API_KEY: `${V2}lastfm-api-key`,
	PROVIDER_WIZARD_SEEN: `${V2}provider-wizard-seen`,
	PROVIDER_PERIODS: `${V2}provider-periods`,
	RANK_MODE: `${V2}rank-mode`,
	PLAYLIST_CONFIG: `${V2}playlist-config`,
	PLAYLIST_STATE: `${V2}playlist-state`,
	TOUR_SEEN_VERSION: `${V2}tour-seen-version`,
	RECAP_DISMISSED_MONTH: `${V2}recap-dismissed-month`,
	UPDATE_PROMPT_SNOOZE_UNTIL: `${V2}update-prompt-snooze-until`,
	DISMISSED_REMOTE_ANNOUNCEMENT_ID: `${V2}dismissed-remote-announcement-id`,
	WORLD_CHARTS_WINDOW: `${V2}world-charts-window`,
} as const;

/** Prefix for settings that only v3 knows about. */
export const V3_PREFIX = V3;

export const V3_KEYS = {
	PLAYLISTS: `${V3}playlists`,
	DEVICE_ID: `${V3}device-id`,
	FIRST_RUN_SNAPSHOT_DONE: `${V3}snapshot-done`,
	TRACKER_HEALTH: `${V3}tracker-health`,
} as const;

/** What the extension writes to V3_KEYS.TRACKER_HEALTH and the settings page reads back. */
export interface TrackerHealth {
	startedAt: number;
	lastEventAt: number;
	lastWriteAt: number;
	lastError: string | null;
	privateSession: boolean;
}
