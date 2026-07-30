import { beforeEach, describe, expect, it } from "vitest";
import { EVENTS } from "../shared/constants/events";
import { _resetInitGuard, initProviders } from "../shared/stats/init-providers";
import { providerRegistry } from "../shared/stats/provider";
import { statsCache } from "../shared/stats/stats-cache";

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
