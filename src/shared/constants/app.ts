/** Identifier used for DOM ids, log prefixes and the CustomApps folder name. */
export const APP_ID = "listening-stats";

export const LOG_PREFIX = `[${APP_ID}]`;

/** Injected by build.mjs from package.json. */
declare const __VERSION__: string;
export const APP_VERSION: string = __VERSION__;

/**
 * Sentry project DSN for crash reports. Public by design: it can only submit
 * events. Empty = reporting off; the Report button then copies the report and
 * offers a GitHub issue instead.
 */
export const SENTRY_DSN =
	"https://375f4896ea343a2fcd67dca3291ffd49@o4512291678191616.ingest.de.sentry.io/4512294947979344";

/** Upstream repo (update checks, announcements, issue reports). Same as v2. */
export const GITHUB_REPO = "Xndr2/listening-stats";

/** Support link shown in the footer and in Settings, About. Same as v2. */
export const BUYMEACOFFEE_URL = "https://buymeacoffee.com/xndr_";

/** Community Discord, shown in the footer and in Settings, About. */
export const DISCORD_URL = "https://discord.gg/XtqbFAHk6a";
