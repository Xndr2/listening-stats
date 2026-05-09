import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	getPlayThreshold,
	isSkipRepeatsEnabled,
	isTrackingPaused,
	setPlayThreshold,
	setSkipRepeatsEnabled,
	setTrackingPaused,
} from "../extension/tracker/settings";
import { LS_KEYS } from "../shared/constants/storage-keys";

describe("Settings accessors", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe("getPlayThreshold", () => {
		it("returns 30000 when no localStorage value exists", () => {
			expect(getPlayThreshold()).toBe(30000);
		});

		it("returns stored value when valid (e.g., 15000)", () => {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, "15000");
			expect(getPlayThreshold()).toBe(15000);
		});

		it("returns 30000 when stored value is below 0", () => {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, "-1");
			expect(getPlayThreshold()).toBe(30000);
		});

		it("returns 30000 when stored value exceeds 60000", () => {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, "70000");
			expect(getPlayThreshold()).toBe(30000);
		});

		it("returns 0 when stored value is 0 (edge: valid lower bound)", () => {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, "0");
			expect(getPlayThreshold()).toBe(0);
		});

		it("returns 60000 when stored value is 60000 (edge: valid upper bound)", () => {
			localStorage.setItem(LS_KEYS.PLAY_THRESHOLD, "60000");
			expect(getPlayThreshold()).toBe(60000);
		});
	});

	describe("setPlayThreshold", () => {
		it("writes value to localStorage key", () => {
			setPlayThreshold(45000);
			expect(localStorage.getItem(LS_KEYS.PLAY_THRESHOLD)).toBe("45000");
		});

		it("clamps value to 0 minimum", () => {
			setPlayThreshold(-100);
			expect(localStorage.getItem(LS_KEYS.PLAY_THRESHOLD)).toBe("0");
		});

		it("clamps value to 60000 maximum", () => {
			setPlayThreshold(99999);
			expect(localStorage.getItem(LS_KEYS.PLAY_THRESHOLD)).toBe("60000");
		});
	});

	describe("isTrackingPaused", () => {
		it("returns false when key is absent", () => {
			expect(isTrackingPaused()).toBe(false);
		});

		it("returns true when key is '1'", () => {
			localStorage.setItem(LS_KEYS.TRACKING_PAUSED, "1");
			expect(isTrackingPaused()).toBe(true);
		});

		it("returns false when key is not '1'", () => {
			localStorage.setItem(LS_KEYS.TRACKING_PAUSED, "0");
			expect(isTrackingPaused()).toBe(false);
		});
	});

	describe("setTrackingPaused", () => {
		it("sets key to '1' when true", () => {
			setTrackingPaused(true);
			expect(localStorage.getItem(LS_KEYS.TRACKING_PAUSED)).toBe("1");
		});

		it("removes key when false", () => {
			localStorage.setItem(LS_KEYS.TRACKING_PAUSED, "1");
			setTrackingPaused(false);
			expect(localStorage.getItem(LS_KEYS.TRACKING_PAUSED)).toBeNull();
		});
	});

	describe("isSkipRepeatsEnabled", () => {
		it("returns false when key is absent", () => {
			expect(isSkipRepeatsEnabled()).toBe(false);
		});

		it("returns true when key is '1'", () => {
			localStorage.setItem(LS_KEYS.SKIP_REPEATS, "1");
			expect(isSkipRepeatsEnabled()).toBe(true);
		});

		it("returns false when key is not '1'", () => {
			localStorage.setItem(LS_KEYS.SKIP_REPEATS, "0");
			expect(isSkipRepeatsEnabled()).toBe(false);
		});
	});

	describe("setSkipRepeatsEnabled", () => {
		it("sets key to '1' when true", () => {
			setSkipRepeatsEnabled(true);
			expect(localStorage.getItem(LS_KEYS.SKIP_REPEATS)).toBe("1");
		});

		it("removes key when false", () => {
			localStorage.setItem(LS_KEYS.SKIP_REPEATS, "1");
			setSkipRepeatsEnabled(false);
			expect(localStorage.getItem(LS_KEYS.SKIP_REPEATS)).toBeNull();
		});
	});
});
