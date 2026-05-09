import { describe, it, expect, beforeEach } from "vitest";
import { statsCache } from "../shared/stats/stats-cache";
import { providerRegistry } from "../shared/stats/provider";
import { initProviders, _resetInitGuard } from "../shared/stats/init-providers";
import { EVENTS } from "../shared/constants/events";

describe("Dashboard integration", () => {
	beforeEach(() => {
		// Reset state between tests
		providerRegistry._resetForTesting();
		_resetInitGuard();
		statsCache.invalidate();
	});

	it("statsCache.get returns null for missing keys", () => {
		expect(statsCache.get("nonexistent")).toBeNull();
	});

	it("providerRegistry starts with null active before init", () => {
		expect(providerRegistry.getActive()).toBeNull();
	});

	it("initProviders sets local as active provider", async () => {
		await initProviders();
		expect(providerRegistry.getActiveId()).toBe("local");
	});

	it("PLAY_RECORDED event name is correct constant", () => {
		expect(EVENTS.PLAY_RECORDED).toBe("listening-stats:play-recorded");
	});
});
