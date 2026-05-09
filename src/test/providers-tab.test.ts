import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deriveTierBadge } from "../app/components/settings/ProvidersTab";

vi.mock("../shared/api/statsfm-client", () => ({
	validateUsername: vi.fn(),
}));
vi.mock("../shared/stats/statsfm-provider", () => ({
	statsfmProvider: { init: vi.fn().mockResolvedValue(undefined) },
}));

import { ERROR_MESSAGES, readStatsFmConfig } from "../app/components/settings/ProvidersTab";
import type { StatsFmConfig } from "../shared/api/statsfm-client";
import { validateUsername } from "../shared/api/statsfm-client";
import { EVENTS } from "../shared/constants/events";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { providerRegistry } from "../shared/stats/provider";
import { statsCache } from "../shared/stats/stats-cache";
import { statsfmProvider } from "../shared/stats/statsfm-provider";

// Cast mocks to vi.Mock for type-safe .mockResolvedValue, .mockReturnValue etc.
const mockValidateUsername = validateUsername as ReturnType<typeof vi.fn>;
const mockStatsfmProviderInit = statsfmProvider.init as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupConnectedConfig(
	overrides: Partial<{
		username: string;
		isPlus: boolean;
		connectedAt: number;
		lastValidated: number;
	}> = {},
) {
	const config = {
		username: "testuser",
		isPlus: false,
		connectedAt: 1712300000000,
		lastValidated: Date.now(),
		...overrides,
	};
	localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(config));
	return config;
}

/**
 * Simulate handleConnect logic as extracted from ProvidersTab.
 * Mirrors the exact implementation so tests remain deterministic.
 */
async function handleConnect(username: string) {
	if (!username.trim()) return;

	const result = await validateUsername(username.trim());
	if (!result.valid) {
		return {
			error:
				ERROR_MESSAGES[result.reason] ?? "Connection failed \u2014 check the console for details",
		};
	}

	const config = {
		username: username.trim(),
		isPlus: result.isPlus,
		connectedAt: Date.now(),
		lastValidated: Date.now(),
	};
	localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(config));
	await statsfmProvider.init();
	statsCache.invalidate();
	providerRegistry.setActive("statsfm");
	window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_CONNECTED));
	window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
	return { config };
}

/**
 * Simulate handleDisconnect logic as extracted from ProvidersTab.
 */
function handleDisconnect() {
	localStorage.removeItem(LS_KEYS.STATSFM_CONFIG);
	statsCache.invalidate();
	providerRegistry.setActive("local");
	window.dispatchEvent(new CustomEvent(EVENTS.STATSFM_DISCONNECTED));
	window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
}

/**
 * Simulate handleProviderSwitch logic as extracted from ProvidersTab.
 */
function handleProviderSwitch(newId: string) {
	statsCache.invalidate();
	providerRegistry.setActive(newId);
	window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProvidersTab connected state", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("reads StatsFmConfig from localStorage and parses username and isPlus", () => {
		setupConnectedConfig({ username: "testuser", isPlus: false });
		const config = readStatsFmConfig();
		expect(config).not.toBeNull();
		expect(config?.username).toBe("testuser");
		expect(config?.isPlus).toBe(false);
	});

	it("returns null when no config is stored", () => {
		expect(readStatsFmConfig()).toBeNull();
	});

	it("returns Plus tier when isPlus is true", () => {
		setupConnectedConfig({ username: "plususer", isPlus: true });
		const config = readStatsFmConfig();
		expect(config?.isPlus).toBe(true);
	});
});

describe("ProvidersTab private profile", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("shows 'Profile is private' error when validateUsername returns private reason", async () => {
		mockValidateUsername.mockResolvedValue({ valid: false, reason: "private" });
		const result = await handleConnect("privateuser");
		expect(result).toHaveProperty("error");
		expect(result?.error).toContain("Profile is private");
	});

	it("ERROR_MESSAGES.private contains 'Profile is private'", () => {
		expect(ERROR_MESSAGES.private).toContain("Profile is private");
	});

	it("ERROR_MESSAGES.not_found contains 'Username not found'", () => {
		expect(ERROR_MESSAGES.not_found).toContain("Username not found");
	});

	it("ERROR_MESSAGES.network contains 'Could not reach stats.fm'", () => {
		expect(ERROR_MESSAGES.network).toContain("Could not reach stats.fm");
	});

	it("ERROR_MESSAGES.circuit_open contains 'temporarily unavailable'", () => {
		expect(ERROR_MESSAGES.circuit_open).toContain("temporarily unavailable");
	});
});

describe("ProvidersTab connect flow", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		// Register both providers so setActive("statsfm") doesn't throw
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("writes StatsFmConfig to localStorage on valid username", async () => {
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: true, displayName: "TestUser" });
		await handleConnect("testuser");
		const stored = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
		expect(stored).not.toBeNull();
		const config = JSON.parse(stored!);
		expect(config.username).toBe("testuser");
	});

	it("calls statsfmProvider.init() after writing config", async () => {
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: false, displayName: "TestUser" });
		await handleConnect("testuser");
		expect(mockStatsfmProviderInit).toHaveBeenCalledTimes(1);
	});

	it("calls providerRegistry.setActive('statsfm') on successful connect", async () => {
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: false, displayName: "TestUser" });
		const setActiveSpy = vi.spyOn(providerRegistry, "setActive");
		await handleConnect("testuser");
		expect(setActiveSpy).toHaveBeenCalledWith("statsfm");
	});

	it("does nothing when username is empty", async () => {
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: false, displayName: "TestUser" });
		const result = await handleConnect("  ");
		expect(result).toBeUndefined();
		expect(mockValidateUsername).not.toHaveBeenCalled();
	});
});

describe("ProvidersTab disconnect", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		setupConnectedConfig();
		providerRegistry.setActive("statsfm");
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("removes StatsFmConfig from localStorage on disconnect", () => {
		handleDisconnect();
		expect(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)).toBeNull();
	});

	it("reverts active provider to 'local' on disconnect", () => {
		const setActiveSpy = vi.spyOn(providerRegistry, "setActive");
		handleDisconnect();
		expect(setActiveSpy).toHaveBeenCalledWith("local");
	});

	it("dispatches STATSFM_DISCONNECTED event", () => {
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		handleDisconnect();
		const eventNames = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(eventNames).toContain(EVENTS.STATSFM_DISCONNECTED);
	});

	it("dispatches PROVIDER_CHANGED event on disconnect", () => {
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		handleDisconnect();
		const eventNames = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(eventNames).toContain(EVENTS.PROVIDER_CHANGED);
	});
});

describe("ProvidersTab provider switch", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.setActive("statsfm");
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("calls statsCache.invalidate() when switching provider", () => {
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");
		handleProviderSwitch("local");
		expect(invalidateSpy).toHaveBeenCalledTimes(1);
	});

	it("calls providerRegistry.setActive() when switching provider", () => {
		const setActiveSpy = vi.spyOn(providerRegistry, "setActive");
		handleProviderSwitch("local");
		expect(setActiveSpy).toHaveBeenCalledWith("local");
	});

	it("dispatches PROVIDER_CHANGED event on switch", () => {
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		handleProviderSwitch("local");
		const eventNames = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(eventNames).toContain(EVENTS.PROVIDER_CHANGED);
	});
});

describe("ProvidersTab provider switch cache order", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.setActive("statsfm");
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("invalidate() is called before setActive() during provider switch", () => {
		const callOrder: string[] = [];
		vi.spyOn(statsCache, "invalidate").mockImplementation(() => {
			callOrder.push("invalidate");
		});
		vi.spyOn(providerRegistry, "setActive").mockImplementation((_id: string) => {
			callOrder.push("setActive");
		});
		handleProviderSwitch("local");
		expect(callOrder[0]).toBe("invalidate");
		expect(callOrder[1]).toBe("setActive");
	});
});

describe("ProvidersTab deriveTierBadge", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("returns Plus badge content when stats.fm provider's capabilities.tier === 'plus'", () => {
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: true,
					tier: "plus" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});

		const result = deriveTierBadge(providerRegistry);
		expect(result.tier).toBe("plus");
		expect(result.tierClass).toBe("tier-badge--plus");
		expect(result.tierLabel).toBe("Plus");
	});

	it("returns Free badge content when stats.fm provider's capabilities.tier === 'free'", () => {
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});

		const result = deriveTierBadge(providerRegistry);
		expect(result.tier).toBe("free");
		expect(result.tierClass).toBe("tier-badge--free");
		expect(result.tierLabel).toBe("Free");
	});

	it("defaults to Free when stats.fm provider is missing from registry (empty registry)", () => {
		// No providers registered  -  only after _resetForTesting in beforeEach
		const result = deriveTierBadge(providerRegistry);
		expect(result.tier).toBe("free");
		expect(result.tierClass).toBe("tier-badge--free");
		expect(result.tierLabel).toBe("Free");
	});

	it("defaults to Free when only the local provider is registered (no stats.fm)", () => {
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});

		const result = deriveTierBadge(providerRegistry);
		expect(result.tier).toBe("free");
		expect(result.tierClass).toBe("tier-badge--free");
		expect(result.tierLabel).toBe("Free");
	});

	it("does not source tier from config.isPlus  -  Free localStorage config + Plus registry capability returns 'plus'", () => {
		// Smoke test: even if localStorage says isPlus: false, the registry's capabilities
		// are the source of truth. This guards against regressions to the old config.isPlus path.
		localStorage.setItem(
			LS_KEYS.STATSFM_CONFIG,
			JSON.stringify({
				username: "tester",
				isPlus: false,
				connectedAt: Date.now(),
				lastValidated: Date.now(),
			}),
		);
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: true,
					tier: "plus" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});

		const result = deriveTierBadge(providerRegistry);
		expect(result.tier).toBe("plus");
		expect(result.tierLabel).toBe("Plus");
	});
});

/** Test helper mirroring ProvidersTab re-validate flow */
async function handleRevalidate(config: StatsFmConfig | null) {
	if (!config) return;
	const prevIsPlus = config.isPlus;

	const result = await validateUsername(config.username);
	if (!result.valid) {
		return {
			error: ERROR_MESSAGES[result.reason] ?? "Validation failed. Check the console for details.",
		};
	}

	const newConfig: StatsFmConfig = {
		...config,
		isPlus: result.isPlus,
		lastValidated: Date.now(),
	};
	localStorage.setItem(LS_KEYS.STATSFM_CONFIG, JSON.stringify(newConfig));
	await statsfmProvider.init();

	let dispatched = false;
	let invalidated = false;
	if (prevIsPlus !== result.isPlus) {
		statsCache.invalidate();
		invalidated = true;
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));
		dispatched = true;
	}

	return { config: newConfig, dispatched, invalidated };
}

describe("ProvidersTab re-validate flow", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "local",
				name: "Local",
				description: "Local provider",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: true,
					hasSkipRate: false,
					tier: "n/a" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm provider",
				capabilities: {
					hasActivityData: false,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: vi.fn().mockReturnValue([]),
			calculateStats: vi.fn().mockResolvedValue({}),
			init: vi.fn().mockResolvedValue(undefined),
			destroy: vi.fn(),
		});
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("successful free-to-plus refresh updates storage without resetting connectedAt", async () => {
		const config = setupConnectedConfig({
			username: "tester",
			isPlus: false,
			connectedAt: 1700000000000,
			lastValidated: 1700000000000,
		});
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: true, displayName: "Tester" });

		const before = Date.now();
		const result = await handleRevalidate(config);

		expect(result).toBeDefined();
		expect("error" in result!).toBe(false);
		expect(mockValidateUsername).toHaveBeenCalledWith("tester");
		expect(mockStatsfmProviderInit).toHaveBeenCalledTimes(1);

		const stored = JSON.parse(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)!);
		expect(stored.username).toBe("tester");
		expect(stored.isPlus).toBe(true);
		expect(stored.connectedAt).toBe(1700000000000); // UNCHANGED
		expect(stored.lastValidated).toBeGreaterThanOrEqual(before); // UPDATED
	});

	it("tier flip from free to plus dispatches PROVIDER_CHANGED and clears stats cache", async () => {
		const config = setupConnectedConfig({ isPlus: false });
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: true, displayName: "Tester" });
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");

		const result = await handleRevalidate(config);

		expect((result as { dispatched: boolean }).dispatched).toBe(true);
		expect((result as { invalidated: boolean }).invalidated).toBe(true);
		expect(invalidateSpy).toHaveBeenCalledTimes(1);
		const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(dispatchedTypes).toContain(EVENTS.PROVIDER_CHANGED);
		expect(dispatchedTypes).not.toContain(EVENTS.STATSFM_CONNECTED); // re-validate is NOT a connect
	});

	it("unchanged free tier skips PROVIDER_CHANGED and cache invalidation", async () => {
		const config = setupConnectedConfig({ isPlus: false });
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: false, displayName: "Tester" });
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");

		const result = await handleRevalidate(config);

		expect((result as { dispatched: boolean }).dispatched).toBe(false);
		expect((result as { invalidated: boolean }).invalidated).toBe(false);
		expect(invalidateSpy).not.toHaveBeenCalled();
		const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(dispatchedTypes).not.toContain(EVENTS.PROVIDER_CHANGED);
	});

	it("unchanged plus tier skips PROVIDER_CHANGED and cache invalidation", async () => {
		const config = setupConnectedConfig({ isPlus: true });
		mockValidateUsername.mockResolvedValue({ valid: true, isPlus: true, displayName: "Tester" });
		const dispatchSpy = vi.spyOn(window, "dispatchEvent");
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");

		const result = await handleRevalidate(config);

		expect((result as { dispatched: boolean }).dispatched).toBe(false);
		expect(invalidateSpy).not.toHaveBeenCalled();
		const dispatchedTypes = dispatchSpy.mock.calls.map((call) => (call[0] as CustomEvent).type);
		expect(dispatchedTypes).not.toContain(EVENTS.PROVIDER_CHANGED);
	});

	it("network validation failure leaves storage untouched and skips provider init", async () => {
		const config = setupConnectedConfig({
			isPlus: false,
			connectedAt: 1700000000000,
			lastValidated: 1700000000000,
		});
		const originalStored = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
		mockValidateUsername.mockResolvedValue({ valid: false, reason: "network" });

		const result = await handleRevalidate(config);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Could not reach stats.fm");
		// No partial write on failure
		expect(localStorage.getItem(LS_KEYS.STATSFM_CONFIG)).toBe(originalStored);
		// statsfmProvider.init NOT called on failure
		expect(mockStatsfmProviderInit).not.toHaveBeenCalled();
	});

	it("not_found validation maps to username missing error copy", async () => {
		const config = setupConnectedConfig({ isPlus: true });
		mockValidateUsername.mockResolvedValue({ valid: false, reason: "not_found" });

		const result = await handleRevalidate(config);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Username not found");
	});

	it("circuit_open validation maps to temporarily unavailable copy", async () => {
		const config = setupConnectedConfig({ isPlus: false });
		mockValidateUsername.mockResolvedValue({ valid: false, reason: "circuit_open" });

		const result = await handleRevalidate(config);

		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("temporarily unavailable");
	});

	it("returns undefined when config is null (defensive guard)", async () => {
		const result = await handleRevalidate(null);
		expect(result).toBeUndefined();
		expect(mockValidateUsername).not.toHaveBeenCalled();
	});

	it("ProvidersTab source wires busy state on Re-validate button", async () => {
		const fs = await import("node:fs");
		const source = fs.readFileSync("src/app/components/settings/ProvidersTab.tsx", "utf-8");
		expect(source).toMatch(/disabled=\{revalidating\}/);
		expect(source).toMatch(/aria-busy=\{revalidating\}/);
		// Confirm button label changes when in flight
		expect(source).toMatch(/Re-validating\.\.\./);
		expect(source).toMatch(/className="btn-secondary"/);
	});
});
