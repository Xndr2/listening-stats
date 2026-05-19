import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/world-charts-service", async (importOriginal) => {
	const orig = await importOriginal<typeof import("../app/world-charts-service")>();
	return {
		...orig,
		getChartsAsync: vi.fn(),
		getArtistChartsAsync: vi.fn(),
		getAlbumChartsAsync: vi.fn(),
	};
});

import type { WorldChartResult } from "../app/world-charts-service";
import {
	getAlbumChartsAsync,
	getArtistChartsAsync,
	getChartsAsync,
	WORLD_ALBUMS,
	WORLD_ARTISTS,
	WORLD_TRACKS,
} from "../app/world-charts-service";
import type { WorldTrack } from "../shared/types/world-charts";

const getChartsAsyncMock = vi.mocked(getChartsAsync);
const getArtistChartsAsyncMock = vi.mocked(getArtistChartsAsync);
const getAlbumChartsAsyncMock = vi.mocked(getAlbumChartsAsync);

function mockAllSuccess() {
	getChartsAsyncMock.mockResolvedValue({ ok: true, data: [...WORLD_TRACKS] });
	getArtistChartsAsyncMock.mockResolvedValue({ ok: true, data: [...WORLD_ARTISTS] });
	getAlbumChartsAsyncMock.mockResolvedValue({ ok: true, data: [...WORLD_ALBUMS] });
}

beforeEach(() => {
	localStorage.clear();
	getChartsAsyncMock.mockReset();
	getArtistChartsAsyncMock.mockReset();
	getAlbumChartsAsyncMock.mockReset();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("WorldChartsPage — async loading", () => {
	it("shows skeleton loading state while fetching", async () => {
		let resolveCharts!: (value: WorldChartResult<WorldTrack[]>) => void;
		getChartsAsyncMock.mockReturnValue(
			new Promise<WorldChartResult<WorldTrack[]>>((resolve) => {
				resolveCharts = resolve;
			}),
		);
		getArtistChartsAsyncMock.mockReturnValue(new Promise(() => {}));
		getAlbumChartsAsyncMock.mockReturnValue(new Promise(() => {}));

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		const skeleton = container.querySelector(".world-page-grid");
		expect(skeleton).not.toBeNull();
		const shimmerRows = skeleton!.querySelectorAll(".skeleton-shimmer");
		expect(shimmerRows.length).toBeGreaterThan(0);
		resolveCharts({ ok: true, data: [...WORLD_TRACKS] });
	});

	it("skeleton includes tile placeholders for chart rows", async () => {
		getChartsAsyncMock.mockReturnValue(new Promise(() => {}));
		getArtistChartsAsyncMock.mockReturnValue(new Promise(() => {}));
		getAlbumChartsAsyncMock.mockReturnValue(new Promise(() => {}));

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		const skeleton = container.querySelector(".world-page-grid");
		expect(skeleton).not.toBeNull();
		const tilePlaceholders = skeleton!.querySelectorAll(".skeleton-tile");
		expect(tilePlaceholders.length).toBeGreaterThanOrEqual(9);
	});

	it("renders chart rows after async load completes", async () => {
		mockAllSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		await vi.waitFor(() => {
			const items = container.querySelectorAll(".top-list-row");
			expect(items.length).toBeGreaterThan(0);
		});
	});

	it("renders InlineErrorCard on API failure", async () => {
		getChartsAsyncMock.mockResolvedValue({ ok: false, status: 403, message: "Invalid API key" });
		getArtistChartsAsyncMock.mockResolvedValue({
			ok: false,
			status: 403,
			message: "Invalid API key",
		});
		getAlbumChartsAsyncMock.mockResolvedValue({
			ok: false,
			status: 403,
			message: "Invalid API key",
		});

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		await vi.waitFor(() => {
			const errorCard = container.querySelector(".inline-error-card");
			expect(errorCard).not.toBeNull();
		});
	});

	it("retry button refetches data", async () => {
		getChartsAsyncMock
			.mockResolvedValueOnce({ ok: false, status: 500, message: "Internal Server Error" })
			.mockResolvedValueOnce({ ok: true, data: [...WORLD_TRACKS] });
		getArtistChartsAsyncMock
			.mockResolvedValueOnce({ ok: false, status: 500, message: "Internal Server Error" })
			.mockResolvedValueOnce({ ok: true, data: [...WORLD_ARTISTS] });
		getAlbumChartsAsyncMock
			.mockResolvedValueOnce({ ok: false, status: 500, message: "Internal Server Error" })
			.mockResolvedValueOnce({ ok: true, data: [...WORLD_ALBUMS] });

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		await vi.waitFor(() => {
			const retryBtn = container.querySelector(".inline-error-cta");
			expect(retryBtn).not.toBeNull();
		});

		const retryBtn = container.querySelector(".inline-error-cta") as HTMLButtonElement;
		fireEvent.click(retryBtn);

		await vi.waitFor(() => {
			const items = container.querySelectorAll(".top-list-row");
			expect(items.length).toBeGreaterThan(0);
		});
	});

	it("re-fetches when time window changes", async () => {
		mockAllSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		await vi.waitFor(() => {
			expect(container.querySelectorAll(".top-list-row").length).toBeGreaterThan(0);
		});

		const weekBtn = container.querySelectorAll("[data-testid='world-window-tabs'] button")[1]!;
		fireEvent.click(weekBtn);

		await vi.waitFor(() => {
			expect(getChartsAsyncMock).toHaveBeenCalledTimes(2);
		});
	});

	it("shows stats.fm attribution", async () => {
		mockAllSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage));

		await vi.waitFor(() => {
			const source = container.querySelector(".world-charts-source");
			expect(source?.textContent).toContain("stats.fm");
		});
	});
});
