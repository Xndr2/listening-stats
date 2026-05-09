import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS } from "../shared/constants/events";
import { StatsCache, statsCache } from "../shared/stats/stats-cache";
import type { StatsResult } from "../shared/types/stats";
import type { ProviderInfo, StatsProvider } from "../shared/stats/provider";
import { ProviderRegistry } from "../shared/stats/provider";

const makeMockStats = (): StatsResult => ({
	topTracks: [],
	topArtists: [],
	topAlbums: [],
	topGenres: [],
	totalPlays: 42,
	totalDuration: 12345,
	recentPlays: [],
});

describe("StatsCache", () => {
	let cache: StatsCache;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new StatsCache();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("get() returns null when empty", () => {
		expect(cache.get("local:today")).toBeNull();
	});

	it("set() then get() returns stored data", () => {
		const stats = makeMockStats();
		cache.set("local:today", stats);
		const result = cache.get<StatsResult>("local:today");
		expect(result).toEqual(stats);
	});

	it("get() returns null after 2-min TTL expires", () => {
		const stats = makeMockStats();
		cache.set("local:today", stats);
		// Advance past 2 minutes
		vi.advanceTimersByTime(2 * 60 * 1000 + 1);
		expect(cache.get("local:today")).toBeNull();
	});

	it("get() returns data just before TTL expires", () => {
		const stats = makeMockStats();
		cache.set("local:today", stats);
		// Advance to just before expiry
		vi.advanceTimersByTime(2 * 60 * 1000 - 1);
		expect(cache.get<StatsResult>("local:today")).toEqual(stats);
	});

	it("invalidate(key) removes that entry, other entries survive", () => {
		const stats = makeMockStats();
		cache.set("local:today", stats);
		cache.set("local:this-week", stats);
		cache.invalidate("local:today");
		expect(cache.get("local:today")).toBeNull();
		expect(cache.get<StatsResult>("local:this-week")).toEqual(stats);
	});

	it("invalidate() with no args clears all entries", () => {
		const stats = makeMockStats();
		cache.set("local:today", stats);
		cache.set("local:this-week", stats);
		cache.set("local:all-time", stats);
		cache.invalidate();
		expect(cache.get("local:today")).toBeNull();
		expect(cache.get("local:this-week")).toBeNull();
		expect(cache.get("local:all-time")).toBeNull();
	});

	it("setupInvalidationListeners adds event listener for EVENTS.PLAY_RECORDED that calls invalidate()", () => {
		const invalidateSpy = vi.spyOn(cache, "invalidate");
		cache.setupInvalidationListeners();
		const stats = makeMockStats();
		cache.set("local:today", stats);
		window.dispatchEvent(new CustomEvent(EVENTS.PLAY_RECORDED));
		expect(invalidateSpy).toHaveBeenCalledWith();
		expect(cache.get("local:today")).toBeNull();
	});
});

describe("statsCache singleton", () => {
	it("is a StatsCache instance", () => {
		expect(statsCache).toBeInstanceOf(StatsCache);
	});
});

describe("StatsProvider interface (type-level checks)", () => {
	it("ProviderRegistry can register and getActive provider returns null when no active set", () => {
		const registry = new ProviderRegistry();
		expect(registry.getActive()).toBeNull();
	});

	it("ProviderRegistry registers a provider and setActive makes it retrievable", () => {
		const registry = new ProviderRegistry();

		const mockProvider: StatsProvider = {
			getProviderInfo(): ProviderInfo {
				return {
					id: "local",
					name: "Local",
					description: "Local IndexedDB provider",
					capabilities: {
						hasActivityData: true,
						hasGenreData: true,
						hasStreakData: true,
						hasSkipRate: false,
						tier: "n/a",
					},
				};
			},
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue(makeMockStats()),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		};

		registry.register(mockProvider);
		registry.setActive("local");
		expect(registry.getActive()).toBe(mockProvider);
	});

	it("ProviderRegistry setActive throws when provider not registered", () => {
		const registry = new ProviderRegistry();
		expect(() => registry.setActive("nonexistent")).toThrow('Provider "nonexistent" not registered');
	});

	it("ProviderRegistry getAll returns ProviderInfo for all registered providers", () => {
		const registry = new ProviderRegistry();

		const mockProvider: StatsProvider = {
			getProviderInfo(): ProviderInfo {
				return {
					id: "local",
					name: "Local",
					description: "Local IndexedDB provider",
					capabilities: {
						hasActivityData: true,
						hasGenreData: true,
						hasStreakData: true,
						hasSkipRate: false,
						tier: "n/a",
					},
				};
			},
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue(makeMockStats()),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		};

		registry.register(mockProvider);
		const all = registry.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe("local");
	});
});
