/**
 * Every user setting, declared once.
 *
 * A setting owns one localStorage key and knows how to read and write it.
 * Settings v2 also had keep v2's key and encoding (see storage-keys.ts), so
 * both versions agree on them. Display preferences that v2 kept inside its
 * JSON "preferences" blob are read from there until the user changes them in
 * v3, after which they get their own v3 key.
 *
 * Reading never throws: a missing, corrupt or out-of-range value gives the
 * default.
 */
import { EVENTS, emit, listen } from "../constants/events";
import { V2_KEYS, V3_PREFIX } from "../constants/storage-keys";

interface Codec<T> {
	/** undefined = stored value is unusable, use the default */
	parse(raw: string): T | undefined;
	/** null = remove the key (v2 removes some keys to mean "default") */
	serialize(value: T): string | null;
}

interface SettingDef<T> {
	key: string;
	default: T;
	codec: Codec<T>;
	/** Where to look when the key itself is missing (a v2 location). */
	legacy?: () => T | undefined;
}

const json = <T>(check: (v: unknown) => v is T): Codec<T> => ({
	parse(raw) {
		try {
			const v: unknown = JSON.parse(raw);
			return check(v) ? v : undefined;
		} catch {
			return undefined;
		}
	},
	serialize: (v) => JSON.stringify(v),
});

const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStringMap = (v: unknown): v is Record<string, string> =>
	!!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string");
const oneOf =
	<T extends string>(values: readonly T[]) =>
	(v: unknown): v is T =>
		typeof v === "string" && (values as readonly string[]).includes(v);
const intIn =
	(min: number, max: number) =>
	(v: unknown): v is number =>
		typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** v2 boolean flags: "1" = on, key absent = off. */
const flag01: Codec<boolean> = {
	parse: (raw) => raw === "1",
	serialize: (v) => (v ? "1" : null),
};

/** v2 plain-string enums. `omitValue` is removed instead of written, like v2 did. */
const plainEnum = <T extends string>(values: readonly T[], omitValue?: T): Codec<T> => ({
	parse: (raw) => (oneOf(values)(raw) ? raw : undefined),
	serialize: (v) => (v === omitValue ? null : v),
});

const plainInt = (min: number, max: number): Codec<number> => ({
	parse(raw) {
		const n = Number.parseInt(raw, 10);
		return intIn(min, max)(n) ? n : undefined;
	},
	serialize: (v) => String(v),
});

/** Read a field from v2's preferences blob, if it is present and valid. */
function v2Pref<T>(field: string, check: (v: unknown) => v is T): () => T | undefined {
	return () => {
		try {
			const raw = localStorage.getItem(V2_KEYS.PREFERENCES);
			if (!raw) return undefined;
			const v = (JSON.parse(raw) as Record<string, unknown>)[field];
			return check(v) ? v : undefined;
		} catch {
			return undefined;
		}
	};
}

const v3 = (name: string) => `${V3_PREFIX}${name}`;

export const PROVIDER_IDS = ["local", "statsfm", "lastfm"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
export const RANK_MODES = ["streams", "minutes"] as const;
export type RankMode = (typeof RANK_MODES)[number];
export const PLAY_COUNT_VARIANTS = ["pill", "bubble", "minimal", "off"] as const;
export const ITEMS_PER_LIST = [5, 10, 20, 50] as const;

const def = <T>(d: SettingDef<T>) => d;

export const SETTINGS = {
	// Tracking (shared with v2)
	trackingPaused: def({ key: V2_KEYS.TRACKING_PAUSED, default: false, codec: flag01 }),
	skipRepeats: def({ key: V2_KEYS.SKIP_REPEATS, default: false, codec: flag01 }),
	thresholdMode: def({
		key: V2_KEYS.PLAY_THRESHOLD_MODE,
		default: "seconds" as "seconds" | "percent",
		codec: plainEnum(["seconds", "percent"] as const, "seconds"),
	}),
	/** Milliseconds a track must play before it counts. v2 stores ms, 0-60000. */
	thresholdMs: def({ key: V2_KEYS.PLAY_THRESHOLD, default: 30_000, codec: plainInt(0, 60_000) }),
	thresholdPercent: def({ key: V2_KEYS.PLAY_THRESHOLD_PERCENT, default: 25, codec: plainInt(0, 100) }),
	debugLogging: def({
		key: V2_KEYS.LOGGING,
		default: false,
		codec: { parse: (raw) => raw === "true", serialize: (v) => (v ? "true" : null) },
	}),

	// Tracking (v3 only)
	excludePodcasts: def({ key: v3("exclude-podcasts"), default: true, codec: json(isBool) }),
	/** Genres for local stats via stats.fm search (sends artist names, no username). */
	genresViaStatsFm: def({ key: v3("genres-via-statsfm"), default: false, codec: json(isBool) }),
	respectPrivateSession: def({ key: v3("respect-private-session"), default: true, codec: json(isBool) }),

	// Data source (shared with v2)
	activeProvider: def({
		key: V2_KEYS.ACTIVE_PROVIDER,
		default: "local" as ProviderId,
		codec: plainEnum(PROVIDER_IDS),
	}),
	rankMode: def({ key: V2_KEYS.RANK_MODE, default: "streams" as RankMode, codec: plainEnum(RANK_MODES) }),

	/** Last period picked per provider, e.g. { local: "this-week" }. Seeded from v2. */
	periodByProvider: def({
		key: v3("period-by-provider"),
		default: {} as Record<string, string>,
		codec: json(isStringMap),
		legacy: () => {
			try {
				const raw = localStorage.getItem(V2_KEYS.PROVIDER_PERIODS);
				const v: unknown = raw ? JSON.parse(raw) : undefined;
				return isStringMap(v) ? v : undefined;
			} catch {
				return undefined;
			}
		},
	}),

	// Display (v3 keys, seeded from v2's preferences blob)
	use24HourTime: def({
		key: v3("use-24h"),
		default: false,
		codec: json(isBool),
		legacy: v2Pref("use24HourTime", isBool),
	}),
	weekStart: def({
		key: v3("week-start"),
		default: "monday" as "monday" | "sunday",
		codec: json(oneOf(["monday", "sunday"] as const)),
	}),
	itemsPerList: def({
		key: v3("items-per-list"),
		default: 10 as number,
		codec: json((v): v is number => (ITEMS_PER_LIST as readonly unknown[]).includes(v)),
	}),
	hiddenWidgets: def({
		key: v3("hidden-widgets"),
		default: [] as string[],
		codec: json((v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string")),
	}),
	/** Slot ids in the order the user arranged them; unknown ids are ignored, missing ones keep their default place. */
	widgetOrder: def({
		key: v3("widget-order"),
		default: [] as string[],
		codec: json((v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string")),
	}),
	playCountVariant: def({
		key: v3("play-count-variant"),
		default: "pill" as (typeof PLAY_COUNT_VARIANTS)[number],
		codec: json(oneOf(PLAY_COUNT_VARIANTS)),
		legacy: v2Pref("playCountVariant", oneOf(PLAY_COUNT_VARIANTS)),
	}),
	playCountShowPeriod: def({
		key: v3("play-count-period"),
		default: true,
		codec: json(isBool),
		legacy: v2Pref("playCountShowPeriodStreams", isBool),
	}),
	showShareCaption: def({
		key: v3("share-caption"),
		default: true,
		codec: json(isBool),
		legacy: v2Pref("showShareCaption", isBool),
	}),
	heatmapFit: def({
		key: v3("heatmap-fit"),
		default: true,
		codec: json(isBool),
		legacy: v2Pref("heatmapShrink", isBool),
	}),

	// App
	betaUpdates: def({
		key: v3("beta-updates"),
		default: false,
		codec: json(isBool),
		legacy: v2Pref("receiveBetaUpdates", isBool),
	}),
	showAnnouncements: def({
		key: v3("announcements"),
		default: true,
		codec: json(isBool),
		legacy: v2Pref("showAnnouncementBanner", isBool),
	}),
	autoCrashReports: def({ key: v3("auto-crash-reports"), default: false, codec: json(isBool) }),
} as const;

export type Settings = typeof SETTINGS;
export type SettingName = keyof Settings;
export type SettingValue<K extends SettingName> = Settings[K]["default"];

export function getSetting<K extends SettingName>(name: K): SettingValue<K> {
	const d = SETTINGS[name] as SettingDef<SettingValue<K>>;
	try {
		const raw = localStorage.getItem(d.key);
		if (raw !== null) {
			const v = d.codec.parse(raw);
			if (v !== undefined) return v;
		} else {
			// Flags encode "off" as a missing key; a legacy source only applies
			// to settings that store something explicit.
			const fromLegacy = d.legacy?.();
			if (fromLegacy !== undefined) return fromLegacy;
		}
	} catch {
		// localStorage unavailable
	}
	return structuredClone(d.default);
}

export function setSetting<K extends SettingName>(name: K, value: SettingValue<K>): void {
	const d = SETTINGS[name] as SettingDef<SettingValue<K>>;
	try {
		const out = d.codec.serialize(value);
		if (out === null) localStorage.removeItem(d.key);
		else localStorage.setItem(d.key, out);
	} catch {
		// localStorage full or unavailable; the in-memory change still broadcasts
	}
	emit(EVENTS.SETTINGS_CHANGED, { name, value });
}

export function onSettingChange<K extends SettingName>(name: K, fn: (value: SettingValue<K>) => void): () => void {
	return listen<{ name: SettingName; value: unknown }>(EVENTS.SETTINGS_CHANGED, (d) => {
		if (d.name === name) fn(d.value as SettingValue<K>);
	});
}

/** The effective play threshold for a track of `durationMs`. */
export function playThresholdMs(durationMs: number): number {
	if (getSetting("thresholdMode") === "percent") {
		return Math.round((durationMs * getSetting("thresholdPercent")) / 100);
	}
	return getSetting("thresholdMs");
}
