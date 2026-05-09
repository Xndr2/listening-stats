export const EVENTS = {
	PLAY_RECORDED: "listening-stats:play-recorded",
	SKIP_RECORDED: "listening-stats:skip-recorded",
	HEALTH_CHANGED: "listening-stats:health-changed",
	TRACKING_PAUSED: "listening-stats:tracking-paused",
	TRACKING_RESUMED: "listening-stats:tracking-resumed",
	// Provider events (v2.2)
	PROVIDER_CHANGED: "listening-stats:provider-changed",
	STATSFM_CONNECTED: "listening-stats:statsfm-connected",
	STATSFM_DISCONNECTED: "listening-stats:statsfm-disconnected",
	// Health events (v2.3)
	STATSFM_HEALTH_CHANGED: "listening-stats:statsfm-health-changed",
	// Preference events (v2.5)
	PREFS_CHANGED: "listening-stats:prefs-changed",
} as const;
