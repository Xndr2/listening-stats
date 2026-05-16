import { LS_KEYS } from "../shared/constants/storage-keys";

export const PAGE_IDS = ["dashboard", "world"] as const;

export const SECTION_IDS = [
	"overview",
	"top-genres",
	"top-lists",
	"activity",
	"consistency",
	"recently-played",
] as const;

export const COLUMN_IDS = ["top-tracks", "top-artists", "top-albums"] as const;

export const OVERVIEW_CARD_IDS = {
	local: [
		"tracks",
		"unique-artists",
		"streak",
		"new-artists",
		"peak-hour",
		"skip-rate",
		"est-payout",
	],
	statsfm: ["unique-artists", "new-artists", "top-genre", "est-payout"],
} as const;

export const OVERVIEW_CARD_LABELS: Record<string, string> = {
	tracks: "Tracks",
	"unique-artists": "Unique Artists",
	"listening-days": "Listening Days",
	streak: "Streak",
	"skip-rate": "Skip Rate",
	"est-payout": "Est. Payout",
	"top-genre": "Top Genre",
	"new-artists": "New Artists",
	"peak-hour": "Peak Hour",
};

export const COLUMN_LABELS: Record<string, string> = {
	"top-tracks": "Top Tracks",
	"top-artists": "Top Artists",
	"top-albums": "Top Albums",
};

export type OverviewProviderKey = "local" | "statsfm";

export type ActivityTabId = "hour" | "weekday" | "day";

export type PlayCountVariant = "pill" | "bubble" | "minimal" | "off";

export interface Preferences {
	use24HourTime: boolean;
	itemsPerSection: number; // 3 | 5 | 10
	hiddenSections: string[]; // may contain coarse "top-lists" AND/OR fine "top-tracks"/"top-artists"/"top-albums"
	sectionOrder: string[]; // ordered section IDs - v2.5
	columnOrder: string[]; // ordered TopLists column IDs - v2.5
	overviewOrder: { local: string[]; statsfm: string[] };
	activityTab: ActivityTabId;
	activeGenre: string | null;
	playCountVariant: PlayCountVariant;
	/**
	 * Extra playbar context: for **stats.fm**, resolve streams for the current dashboard period
	 * and show next to lifetime when available; for **local**, show a first-play hint when the
	 * track has no qualifying plays yet (skips excluded).
	 */
	playCountShowPeriodStreams: boolean;

	activePage: string;
	/** Include GitHub prereleases when checking for updates */
	receiveBetaUpdates: boolean;
	/**
	 * When false, the banner is hidden for the current dismiss id (× or Display toggle off).
	 * Turning back on shows the same announcement again. A new dismiss id auto-enables this.
	 */
	showAnnouncementBanner: boolean;
	/**
	 * Snapshot of `ResolvedBanner.dismissKey` when the user turned off `showAnnouncementBanner`.
	 * Empty string means no snapshot (toggle on, or hidden while no banner). New dismiss key → auto show again.
	 */
	announcementBannerHiddenForDismissKey: string;
}

const VALID_ACTIVITY_TABS = new Set<ActivityTabId>(["hour", "weekday", "day"]);
const VALID_PLAY_COUNT_VARIANTS = new Set<PlayCountVariant>(["pill", "bubble", "minimal", "off"]);

const DEFAULTS: Preferences = {
	use24HourTime: false,
	itemsPerSection: 5,
	hiddenSections: [],
	sectionOrder: [...SECTION_IDS],
	columnOrder: [...COLUMN_IDS],
	overviewOrder: {
		local: [...OVERVIEW_CARD_IDS.local],
		statsfm: [...OVERVIEW_CARD_IDS.statsfm],
	},
	activityTab: "hour",
	activeGenre: null,
	playCountVariant: "pill",
	playCountShowPeriodStreams: true,
	activePage: "dashboard",
	receiveBetaUpdates: false,
	showAnnouncementBanner: true,
	announcementBannerHiddenForDismissKey: "",
};

/**
 * Returns a fresh copy of DEFAULTS with all array fields cloned, so that
 * consumer mutations (e.g. `prefs.sectionOrder.push(...)`) cannot leak back
 * into the module-level DEFAULTS constant.
 */
function cloneDefaults(): Preferences {
	return {
		...DEFAULTS,
		hiddenSections: [...DEFAULTS.hiddenSections],
		sectionOrder: [...DEFAULTS.sectionOrder],
		columnOrder: [...DEFAULTS.columnOrder],
		overviewOrder: {
			local: [...DEFAULTS.overviewOrder.local],
			statsfm: [...DEFAULTS.overviewOrder.statsfm],
		},
	};
}

/**
 * Reconcile a stored order array against a canonical list:
 *  - drop unknown ids
 *  - preserve stored order for known ids
 *  - append canonical ids that are missing (in canonical order)
 */
function reconcileOrder(stored: unknown, canonical: readonly string[]): string[] {
	const canon = new Set<string>(canonical);
	const out: string[] = [];
	const seen = new Set<string>();
	if (Array.isArray(stored)) {
		for (const id of stored) {
			if (typeof id === "string" && canon.has(id) && !seen.has(id)) {
				seen.add(id);
				out.push(id);
			}
		}
	}
	for (const id of canonical) {
		if (!seen.has(id)) out.push(id);
	}
	return out;
}

/** Normalize hidden section ids: coarse `top-lists` and fine column ids may both appear. Dedupe, keep order. */
export function normalizeHiddenSections(stored: unknown): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	if (!Array.isArray(stored)) return out;
	for (const id of stored) {
		if (typeof id !== "string") continue;
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

export function getPreferences(): Preferences {
	try {
		const raw = localStorage.getItem(LS_KEYS.PREFERENCES);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Preferences> & {
				overviewOrder?: Partial<Preferences["overviewOrder"]>;
			};
			const base = cloneDefaults();
			const merged: Preferences = {
				...base,
				...parsed,
				hiddenSections: normalizeHiddenSections(parsed.hiddenSections ?? base.hiddenSections),
				sectionOrder: reconcileOrder(parsed.sectionOrder, SECTION_IDS),
				columnOrder: reconcileOrder(parsed.columnOrder, COLUMN_IDS),
				overviewOrder: {
					local: reconcileOrder(parsed.overviewOrder?.local, OVERVIEW_CARD_IDS.local),
					statsfm: reconcileOrder(parsed.overviewOrder?.statsfm, OVERVIEW_CARD_IDS.statsfm),
				},
				activityTab: VALID_ACTIVITY_TABS.has(parsed.activityTab as ActivityTabId)
					? (parsed.activityTab as ActivityTabId)
					: DEFAULTS.activityTab,
				playCountVariant: VALID_PLAY_COUNT_VARIANTS.has(parsed.playCountVariant as PlayCountVariant)
					? (parsed.playCountVariant as PlayCountVariant)
					: DEFAULTS.playCountVariant,
				playCountShowPeriodStreams:
					typeof parsed.playCountShowPeriodStreams === "boolean"
						? parsed.playCountShowPeriodStreams
						: DEFAULTS.playCountShowPeriodStreams,
				receiveBetaUpdates:
					typeof parsed.receiveBetaUpdates === "boolean"
						? parsed.receiveBetaUpdates
						: DEFAULTS.receiveBetaUpdates,
				showAnnouncementBanner:
					typeof parsed.showAnnouncementBanner === "boolean"
						? parsed.showAnnouncementBanner
						: DEFAULTS.showAnnouncementBanner,
				announcementBannerHiddenForDismissKey:
					typeof parsed.announcementBannerHiddenForDismissKey === "string"
						? parsed.announcementBannerHiddenForDismissKey
						: DEFAULTS.announcementBannerHiddenForDismissKey,
			};
			return merged;
		}
	} catch {
		// corrupted, fall through to defaults
	}
	return cloneDefaults();
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
	try {
		const current = getPreferences();
		current[key] = value;
		localStorage.setItem(LS_KEYS.PREFERENCES, JSON.stringify(current));
	} catch {
		// localStorage unavailable
	}
}
