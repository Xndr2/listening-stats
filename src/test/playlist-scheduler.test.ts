import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/playlist/builder", () => ({
	maybeUpdateDailyPlaylist: vi.fn(async () => {}),
}));

import { initPlaylistScheduler } from "../extension/playlist-scheduler";
import { maybeUpdateDailyPlaylist } from "../shared/playlist/builder";

const updateMock = vi.mocked(maybeUpdateDailyPlaylist);

describe("playlist-scheduler", () => {
	beforeEach(() => {
		updateMock.mockClear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-30T22:00:00"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("runs the playlist refresh once at startup", () => {
		initPlaylistScheduler();
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("does not run again while the calendar day is unchanged", () => {
		initPlaylistScheduler();
		vi.advanceTimersByTime(60 * 60_000); // one hour of minute polls, same day
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("runs again when the local day rolls over", () => {
		initPlaylistScheduler();
		vi.setSystemTime(new Date("2026-07-31T00:00:30"));
		vi.advanceTimersByTime(60_000);
		expect(updateMock).toHaveBeenCalledTimes(2);
	});

	it("runs only once per day change even across many polls", () => {
		initPlaylistScheduler();
		vi.setSystemTime(new Date("2026-07-31T00:00:30"));
		vi.advanceTimersByTime(10 * 60_000);
		expect(updateMock).toHaveBeenCalledTimes(2);
	});

	it("survives sleep/resume style clock jumps of multiple days", () => {
		initPlaylistScheduler();
		vi.setSystemTime(new Date("2026-08-04T09:00:00"));
		vi.advanceTimersByTime(60_000);
		expect(updateMock).toHaveBeenCalledTimes(2);
	});
});
