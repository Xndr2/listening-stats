const PREFS_KEY = "listening-stats:preferences";
const PREFS_CHANGED_EVENT = "listening-stats:prefs-changed";

export interface UserPreferences {
  use24HourTime: boolean;
  itemsPerSection: number;
  genresPerSection: number;
  hiddenSections: string[];
}

const DEFAULTS: UserPreferences = {
  use24HourTime: false,
  itemsPerSection: 5,
  genresPerSection: 5,
  hiddenSections: [],
};

let cached: UserPreferences | null = null;

export function getPreferences(): UserPreferences {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      cached = { ...DEFAULTS, ...JSON.parse(stored) };
      return cached!;
    }
  } catch {
    /* ignore parse errors */
  }
  cached = { ...DEFAULTS };
  return cached;
}

export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const prefs = getPreferences();
  prefs[key] = value;
  cached = prefs;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(
    new CustomEvent(PREFS_CHANGED_EVENT, { detail: { key, value } }),
  );
}

export function onPreferencesChanged(
  callback: (key: string, value: any) => void,
): () => void {
  const handler = (e: Event) => {
    const { key, value } = (e as CustomEvent).detail;
    callback(key, value);
  };
  window.addEventListener(PREFS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
}
