import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/world-charts-service", async (importOriginal) => {
	const orig = await importOriginal<typeof import("../app/world-charts-service")>();
	return {
		...orig,
		getChartsAsync: vi.fn(),
		getArtistChartsAsync: vi.fn(),
	};
});

import {
	getArtistChartsAsync,
	getChartsAsync,
	WORLD_ARTISTS,
	WORLD_TRACKS,
} from "../app/world-charts-service";
import type { LastfmResult } from "../shared/api/lastfm-client";

const getChartsAsyncMock = vi.mocked(getChartsAsync);
const getArtistChartsAsyncMock = vi.mocked(getArtistChartsAsync);

function mockBothSuccess() {
	getChartsAsyncMock.mockResolvedValue({ ok: true, data: [...WORLD_TRACKS] });
	getArtistChartsAsyncMock.mockResolvedValue({ ok: true, data: [...WORLD_ARTISTS] });
}

beforeEach(() => {
	localStorage.clear();
	getChartsAsyncMock.mockReset();
	getArtistChartsAsyncMock.mockReset();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("WorldChartsPage  -  async loading", () => {
	it("shows skeleton loading state while fetching", async () => {
		let resolveCharts!: (value: LastfmResult) => void;
		getChartsAsyncMock.mockReturnValue(
			new Promise<LastfmResult>((resolve) => {
				resolveCharts = resolve;
			}),
		);
		getArtistChartsAsyncMock.mockReturnValue(new Promise(() => {}));

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		const skeleton = container.querySelector(".world-charts-skeleton");
		expect(skeleton).not.toBeNull();
		const shimmerRows = skeleton!.querySelectorAll(".skeleton-shimmer");
		expect(shimmerRows.length).toBeGreaterThan(0);
		resolveCharts({ ok: true, data: [...WORLD_TRACKS] });
	});

	it("skeleton includes tile placeholders for each item row", async () => {
		getChartsAsyncMock.mockReturnValue(new Promise(() => {}));
		getArtistChartsAsyncMock.mockReturnValue(new Promise(() => {}));

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		const skeleton = container.querySelector(".world-charts-skeleton");
		expect(skeleton).not.toBeNull();
		const tilePlaceholders = skeleton!.querySelectorAll(".skeleton-tile");
		expect(tilePlaceholders.length).toBe(16);
	});

	it("renders tracks after async load completes", async () => {
		mockBothSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			const items = container.querySelectorAll(".world-chart-item");
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

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			const errorCard = container.querySelector(".inline-error-card");
			expect(errorCard).not.toBeNull();
		});
	});

	it("error card shows InvalidApiKey variant for 403", async () => {
		getChartsAsyncMock.mockResolvedValue({ ok: false, status: 403, message: "Invalid API key" });
		getArtistChartsAsyncMock.mockResolvedValue({
			ok: false,
			status: 403,
			message: "Invalid API key",
		});

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			const errorTitle = container.querySelector(".inline-error-title");
			expect(errorTitle?.textContent).toContain("API key");
		});
	});

	it("retry button refetches data", async () => {
		getChartsAsyncMock
			.mockResolvedValueOnce({ ok: false, status: 500, message: "Internal Server Error" })
			.mockResolvedValueOnce({ ok: true, data: [...WORLD_TRACKS] });
		getArtistChartsAsyncMock
			.mockResolvedValueOnce({ ok: false, status: 500, message: "Internal Server Error" })
			.mockResolvedValueOnce({ ok: true, data: [...WORLD_ARTISTS] });

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			const retryBtn = container.querySelector(".inline-error-cta");
			expect(retryBtn).not.toBeNull();
		});

		const retryBtn = container.querySelector(".inline-error-cta") as HTMLButtonElement;
		fireEvent.click(retryBtn);

		await vi.waitFor(() => {
			const items = container.querySelectorAll(".world-chart-item");
			expect(items.length).toBeGreaterThan(0);
		});
	});

	it("re-fetches when scope changes", async () => {
		mockBothSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			expect(container.querySelectorAll(".world-chart-item").length).toBeGreaterThan(0);
		});

		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const usBtn = scopeTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(usBtn);

		await vi.waitFor(() => {
			expect(getChartsAsyncMock).toHaveBeenCalledTimes(2);
		});
	});

	it("shows source as Last.fm when connected", async () => {
		mockBothSuccess();

		const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
		const { container } = render(React.createElement(WorldChartsPage, { hasLastfmKey: true }));

		await vi.waitFor(() => {
			const source = container.querySelector(".world-charts-source");
			expect(source?.textContent).toContain("Last.fm");
		});
	});
});
