import type { Period, StatsResult } from "../types/stats";
import type { WaveCallback } from "./progressive";
import { LS_KEYS } from "../constants/storage-keys";

export interface ProviderCapabilities {
	hasActivityData: boolean;  // hourly/weekday distribution available
	hasConsistencyData?: boolean; // provider-specific consistency view available
	hasGenreData: boolean;     // topGenres populated
	hasStreakData: boolean;    // streak card data available
	hasSkipRate: boolean;      // skip-rate overview card available
	tier: 'free' | 'plus' | 'n/a';  // 'n/a' for local provider
}

export interface ProviderInfo {
	id: string; // e.g. "local", "lastfm", "statsfm"
	name: string; // display name
	description: string;
	capabilities: ProviderCapabilities;
}

export interface StatsProvider {
	getProviderInfo(): ProviderInfo;
	getSupportedPeriods(): Period[];
	calculateStats(period: Period): Promise<StatsResult>;
	calculateStatsProgressive?(period: Period, onWave: WaveCallback): Promise<StatsResult>;
	init(): Promise<void>;
	destroy(): void;
}

export class ProviderRegistry {
	private providers = new Map<string, StatsProvider>();
	private activeId: string | null = null;

	register(provider: StatsProvider): void {
		const info = provider.getProviderInfo();
		this.providers.set(info.id, provider);
	}

	getActive(): StatsProvider | null {
		if (!this.activeId) return null;
		return this.providers.get(this.activeId) ?? null;
	}

	getActiveId(): string | null {
		return this.activeId;
	}

	setActive(id: string): void {
		if (!this.providers.has(id)) throw new Error(`Provider "${id}" not registered`);
		this.activeId = id;
		localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, id);
	}

	restoreActive(): void {
		const saved = localStorage.getItem(LS_KEYS.ACTIVE_PROVIDER);
		if (saved && this.providers.has(saved)) {
			this.activeId = saved;
		}
	}

	/** Reset internal state for testing only */
	_resetForTesting(): void {
		this.providers.clear();
		this.activeId = null;
	}

	getAll(): ProviderInfo[] {
		return Array.from(this.providers.values()).map((p) => p.getProviderInfo());
	}
}

export const providerRegistry = new ProviderRegistry();
