import { beforeEach, describe, expect, it } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";

describe("Tour logic", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe("getMajorVersion", () => {
		it("extracts major version from semver string", async () => {
			const { getMajorVersion } = await import("../app/tour");
			expect(getMajorVersion("2.0.0")).toBe("2");
			expect(getMajorVersion("3.1.4")).toBe("3");
			expect(getMajorVersion("10.2.3")).toBe("10");
		});

		it("returns '0' for malformed version strings", async () => {
			const { getMajorVersion } = await import("../app/tour");
			expect(getMajorVersion("")).toBe("0");
			expect(getMajorVersion("abc")).toBe("0");
		});
	});

	describe("shouldAutoStartTour", () => {
		it("returns true when no tour has been seen", async () => {
			const { shouldAutoStartTour } = await import("../app/tour");
			expect(shouldAutoStartTour("2.0.0")).toBe(true);
		});

		it("returns false when tour was seen for same major version", async () => {
			const { shouldAutoStartTour, markTourSeen } = await import("../app/tour");
			markTourSeen("2.0.0");
			expect(shouldAutoStartTour("2.0.0")).toBe(false);
			expect(shouldAutoStartTour("2.1.0")).toBe(false);
		});

		it("returns true when tour was seen for a different major version", async () => {
			const { shouldAutoStartTour, markTourSeen } = await import("../app/tour");
			markTourSeen("2.0.0");
			expect(shouldAutoStartTour("3.0.0")).toBe(true);
		});
	});

	describe("markTourSeen", () => {
		it("persists the major version to localStorage", async () => {
			const { markTourSeen } = await import("../app/tour");
			markTourSeen("2.6.0");
			expect(localStorage.getItem(LS_KEYS.TOUR_SEEN_VERSION)).toBe("2");
		});
	});

	describe("resetTourSeen", () => {
		it("removes the tour seen flag from localStorage", async () => {
			const { markTourSeen, resetTourSeen, shouldAutoStartTour } = await import("../app/tour");
			markTourSeen("2.0.0");
			expect(shouldAutoStartTour("2.0.0")).toBe(false);
			resetTourSeen();
			expect(shouldAutoStartTour("2.0.0")).toBe(true);
		});
	});

	describe("TOUR_STEPS", () => {
		it("has exactly 8 steps", async () => {
			const { TOUR_STEPS } = await import("../app/tour");
			expect(TOUR_STEPS).toHaveLength(8);
		});

		it("each step has id, label, text, and selector", async () => {
			const { TOUR_STEPS } = await import("../app/tour");
			for (const step of TOUR_STEPS) {
				expect(step).toHaveProperty("id");
				expect(step).toHaveProperty("label");
				expect(step).toHaveProperty("text");
				expect(step).toHaveProperty("selector");
				expect(typeof step.id).toBe("string");
				expect(typeof step.label).toBe("string");
				expect(typeof step.text).toBe("string");
				expect(typeof step.selector).toBe("string");
			}
		});

		it("step ids match expected sequence", async () => {
			const { TOUR_STEPS } = await import("../app/tour");
			const ids = TOUR_STEPS.map((s) => s.id);
			expect(ids).toEqual([
				"health",
				"page-tabs",
				"period",
				"overview",
				"lists",
				"activity",
				"share",
				"gear",
			]);
		});

		it("each step has a valid CSS selector", async () => {
			const { TOUR_STEPS } = await import("../app/tour");
			for (const step of TOUR_STEPS) {
				expect(() => document.querySelector(step.selector)).not.toThrow();
			}
		});
	});
});
