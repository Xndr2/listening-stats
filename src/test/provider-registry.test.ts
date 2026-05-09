import { beforeEach, describe, expect, it, vi } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { _resetInitGuard, initProviders } from "../shared/stats/init-providers";
import { localProvider } from "../shared/stats/local-provider";
import type { ProviderInfo, StatsProvider } from "../shared/stats/provider";
import { ProviderRegistry, providerRegistry } from "../shared/stats/provider";

function makeMockProvider(id: string): StatsProvider {
	return {
		getProviderInfo(): ProviderInfo {
			return {
				id,
				name: id,
				description: `${id} provider`,
				capabilities: {
					hasActivityData: false,
					hasGenreData: false,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free",
				},
			};
		},
		getSupportedPeriods: vi.fn().mockReturnValue([]),
		calculateStats: vi.fn().mockResolvedValue({
			topTracks: [],
			topArtists: [],
			topAlbums: [],
			topGenres: [],
			totalPlays: 0,
			totalDuration: 0,
			recentPlays: [],
		}),
		init: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn(),
	};
}

describe("ProviderRegistry persistence", () => {
	let registry: ProviderRegistry;

	beforeEach(() => {
		localStorage.clear();
		registry = new ProviderRegistry();
	});

	it("setActive persists provider ID to localStorage", () => {
		const mock = makeMockProvider("local");
		registry.register(mock);
		registry.setActive("local");
		expect(localStorage.getItem(LS_KEYS.ACTIVE_PROVIDER)).toBe("local");
	});

	it("restoreActive reads from localStorage and sets active", () => {
		const mock = makeMockProvider("local");
		localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, "local");
		registry.register(mock);
		registry.restoreActive();
		expect(registry.getActive()).toBe(mock);
	});

	it("restoreActive ignores invalid saved ID", () => {
		const mock = makeMockProvider("local");
		localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, "nonexistent");
		registry.register(mock);
		registry.restoreActive();
		expect(registry.getActive()).toBeNull();
	});

	it("restoreActive with no saved value leaves active null", () => {
		const mock = makeMockProvider("local");
		registry.register(mock);
		registry.restoreActive();
		expect(registry.getActive()).toBeNull();
	});

	it("getActiveId returns active provider ID string", () => {
		const mock = makeMockProvider("local");
		registry.register(mock);
		registry.setActive("local");
		expect(registry.getActiveId()).toBe("local");
	});

	it("getActiveId returns null when no active", () => {
		expect(registry.getActiveId()).toBeNull();
	});

	it("persist/restore cycle across registry instances", () => {
		const mock = makeMockProvider("local");
		const registry1 = new ProviderRegistry();
		registry1.register(mock);
		registry1.setActive("local");

		const registry2 = new ProviderRegistry();
		registry2.register(mock);
		registry2.restoreActive();
		expect(registry2.getActive()).toBe(mock);
	});
});

describe("initProviders", () => {
	beforeEach(() => {
		localStorage.clear();
		_resetInitGuard();
		providerRegistry._resetForTesting();
	});

	it("registers localProvider and defaults to local", async () => {
		await initProviders();
		expect(providerRegistry.getActiveId()).toBe("local");
	});

	it("restores saved provider from localStorage", async () => {
		localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, "local");
		await initProviders();
		expect(providerRegistry.getActiveId()).toBe("local");
	});

	it("defaults to local when saved provider is invalid", async () => {
		localStorage.setItem(LS_KEYS.ACTIVE_PROVIDER, "nonexistent");
		await initProviders();
		expect(providerRegistry.getActiveId()).toBe("local");
	});

	it("calling initProviders twice does not duplicate registration", async () => {
		await initProviders();
		await initProviders();
		// localProvider + statsfmProvider = 2 registered; calling twice must not add duplicates
		expect(providerRegistry.getAll().length).toBe(2);
	});

	it("calling initProviders twice does not call init twice", async () => {
		const initSpy = vi.spyOn(localProvider, "init");
		await initProviders();
		await initProviders();
		expect(initSpy).toHaveBeenCalledTimes(1);
		initSpy.mockRestore();
	});
});
