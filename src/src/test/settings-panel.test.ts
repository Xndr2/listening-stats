import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPreferences, setPreference } from "../app/preferences";
import {
	getPlayThreshold,
	isSkipRepeatsEnabled,
	isTrackingPaused,
	setPlayThreshold,
	setSkipRepeatsEnabled,
	setTrackingPaused,
} from "../extension/tracker/settings";
import { StatsCache, statsCache } from "../shared/stats/stats-cache";

describe("TrackingTab integration", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("setPlayThreshold writes to localStorage", () => {
		setPlayThreshold(15000);
		expect(getPlayThreshold()).toBe(15000);
	});

	it("setTrackingPaused toggles localStorage flag", () => {
		setTrackingPaused(true);
		expect(isTrackingPaused()).toBe(true);
		setTrackingPaused(false);
		expect(isTrackingPaused()).toBe(false);
	});

	it("setSkipRepeatsEnabled toggles localStorage flag", () => {
		setSkipRepeatsEnabled(true);
		expect(isSkipRepeatsEnabled()).toBe(true);
		setSkipRepeatsEnabled(false);
		expect(isSkipRepeatsEnabled()).toBe(false);
	});
});

describe("DisplayTab integration", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("setPreference persists itemsPerSection", () => {
		setPreference("itemsPerSection", 10);
		expect(getPreferences().itemsPerSection).toBe(10);
	});

	it("setPreference persists hiddenSections", () => {
		setPreference("hiddenSections", ["activity"]);
		expect(getPreferences().hiddenSections).toEqual(["activity"]);
	});

	it("setPreference persists use24HourTime", () => {
		setPreference("use24HourTime", true);
		expect(getPreferences().use24HourTime).toBe(true);
	});
});

describe("DataTab", () => {
	it("statsCache.invalidate clears all entries", () => {
		statsCache.set("test", { data: 1 });
		statsCache.invalidate();
		expect(statsCache.get("test")).toBeNull();
	});

	it("statsCache.invalidate with key removes only that entry", () => {
		statsCache.set("test-1", { data: 1 });
		statsCache.set("test-2", { data: 2 });
		statsCache.invalidate("test-1");
		expect(statsCache.get("test-1")).toBeNull();
		expect(statsCache.get<{ data: number }>("test-2")).toEqual({ data: 2 });
	});

	it("StatsCache is instantiable and statsCache is an instance", () => {
		expect(statsCache).toBeInstanceOf(StatsCache);
	});
});
