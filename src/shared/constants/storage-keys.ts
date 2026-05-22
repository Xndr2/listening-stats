export const LS_KEYS = {
	PLAY_THRESHOLD: "listening-stats:playThreshold",
	TRACKING_PAUSED: "listening-stats:tracking-paused",
	SKIP_REPEATS: "listening-stats:skip-repeats",
	LAST_UPDATE: "listening-stats:lastUpdate",
	LOGGING: "listening-stats:logging",
	// New in v2
	TRACKING_HEALTH: "listening-stats:tracking-health",
	LAST_WRITE: "listening-stats:lastWrite",
	ACTIVE_PROVIDER: "listening-stats:active-provider",
	PREFERENCES: "listening-stats:preferences",
	MIGRATION_PENDING: "listening-stats:migration-pending",
	// stats.fm provider (v2.2)
	STATSFM_CONFIG: "listening-stats:statsfm",
	PROVIDER_WIZARD_SEEN: "listening-stats:provider-wizard-seen",
	// Period persistence (v2.3)
	PROVIDER_PERIODS: "listening-stats:provider-periods",
	// Health dot (v2.3)
	STATSFM_HEALTH: "listening-stats:statsfm-health",
	// Announcement banner (v2.6)
	DISMISSED_BANNER_VERSION: "listening-stats:dismissed-banner-version",
	// Last.fm provider + World Charts (v2.6)
	LASTFM_API_KEY: "listening-stats:lastfm-api-key",
	LASTFM_CONFIG: "listening-stats:lastfm-provider",
	WORLD_CHARTS_SCOPE: "listening-stats:world-charts-scope",
	WORLD_CHARTS_WINDOW: "listening-stats:world-charts-window",
	// Guided tour (v2.6)
	TOUR_SEEN_VERSION: "listening-stats:tour-seen-version",
	// Remote announcement dismiss id (GitHub ANNOUNCEMENT.md)
	DISMISSED_REMOTE_ANNOUNCEMENT_ID: "listening-stats:dismissed-remote-announcement-id",
	// Update modal snooze (epoch ms  -  show prompt again after this time)
	UPDATE_PROMPT_SNOOZE_UNTIL: "listening-stats:update-prompt-snooze-until",
} as const;
