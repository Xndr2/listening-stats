import { EVENTS } from "../constants/events";

const STATS_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class StatsCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private invalidationListenerAttached = false;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, expiry: Date.now() + STATS_TTL_MS });
  }

  invalidate(key?: string): void {
    if (key !== undefined) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  setupInvalidationListeners(): void {
    // Provider init() can run multiple times (provider switches) — attach once.
    if (this.invalidationListenerAttached) return;
    this.invalidationListenerAttached = true;
    // Invalidate cached aggregates after a recorded play
    window.addEventListener(EVENTS.PLAY_RECORDED, () => {
      this.invalidate();
    });
  }
}

export const statsCache = new StatsCache();
