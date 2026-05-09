import { describe, expect, it } from "vitest";
import {
	formatDuration,
	formatHour,
	formatRelativeTime,
	formatEstimatedPayout,
} from "../app/format";

describe("formatDuration", () => {
	it("returns '<1 min' for durations under 1 minute", () => {
		expect(formatDuration(0)).toBe("<1 min");
		expect(formatDuration(30_000)).toBe("<1 min");
		expect(formatDuration(59_999)).toBe("<1 min");
	});

	it("returns '1 min' for exactly 90 seconds (90000ms)", () => {
		expect(formatDuration(90_000)).toBe("1 min");
	});

	it("returns minutes for durations under 1 hour", () => {
		expect(formatDuration(60_000)).toBe("1 min");
		expect(formatDuration(120_000)).toBe("2 min");
		expect(formatDuration(3_540_000)).toBe("59 min");
	});

	it("returns '1h' for exactly 1 hour (3600000ms)", () => {
		expect(formatDuration(3_600_000)).toBe("1h");
	});

	it("returns '1h 30m' for 1.5 hours (5400000ms)", () => {
		expect(formatDuration(5_400_000)).toBe("1h 30m");
	});

	it("returns hours without minutes when remainder is 0", () => {
		expect(formatDuration(7_200_000)).toBe("2h");
	});

	it("returns days for durations >= 24 hours", () => {
		expect(formatDuration(86_400_000)).toBe("1d");
		expect(formatDuration(90_000_000)).toBe("1d 1h");
		expect(formatDuration(172_800_000)).toBe("2d");
	});
});

describe("formatHour", () => {
	it("(0, false) returns '12am'", () => {
		expect(formatHour(0, false)).toBe("12am");
	});

	it("(1, false) returns '1am'", () => {
		expect(formatHour(1, false)).toBe("1am");
	});

	it("(12, false) returns '12pm'", () => {
		expect(formatHour(12, false)).toBe("12pm");
	});

	it("(13, false) returns '1pm'", () => {
		expect(formatHour(13, false)).toBe("1pm");
	});

	it("(23, false) returns '11pm'", () => {
		expect(formatHour(23, false)).toBe("11pm");
	});

	it("(13, true) returns '13:00'", () => {
		expect(formatHour(13, true)).toBe("13:00");
	});

	it("(0, true) returns '0:00'", () => {
		expect(formatHour(0, true)).toBe("0:00");
	});
});

describe("formatRelativeTime", () => {
	it("returns 'just now' for timestamps within 60 seconds of now", () => {
		expect(formatRelativeTime(Date.now() - 30_000)).toBe("just now");
	});

	it("returns minutes ago for timestamps within 1 hour", () => {
		expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe("5m ago");
	});

	it("returns hours ago for timestamps within 1 day", () => {
		expect(formatRelativeTime(Date.now() - 3 * 3_600_000)).toBe("3h ago");
	});

	it("returns days ago for older timestamps", () => {
		expect(formatRelativeTime(Date.now() - 2 * 86_400_000)).toBe("2d ago");
	});
});

describe("formatEstimatedPayout", () => {
	it("returns '$4.00' for 1000 plays", () => {
		expect(formatEstimatedPayout(1000)).toBe("$4.00");
	});

	it("returns '$0.00' for 0 plays", () => {
		expect(formatEstimatedPayout(0)).toBe("$0.00");
	});

	it("returns '$0.40' for 100 plays", () => {
		expect(formatEstimatedPayout(100)).toBe("$0.40");
	});
});
