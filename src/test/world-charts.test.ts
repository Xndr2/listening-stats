import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), { status });
}

function chartTrackItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		position: i + 1,
		streams: 1000 * (n - i),
		indicator: i === 0 ? "UP" : i === 1 ? "DOWN" : "NONE",
		track: {
			name: `Track ${i + 1}`,
			artists: [{ name: `Artist ${i + 1}` }],
			albums: [{}],
		},
	}));
}

function chartArtistItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		position: i + 1,
		streams: 5000 * (n - i),
		indicator: "NONE",
		artist: { name: `Star ${i + 1}` },
	}));
}

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	localStorage.clear();
	vi.stubGlobal("fetch", (url: string | URL) => {
		const u = url.toString();
		if (u.includes("/charts/top/tracks")) {
			return Promise.resolve(makeResponse(200, { items: chartTrackItems(8) }));
		}
		if (u.includes("/charts/top/artists")) {
			return Promise.resolve(makeResponse(200, { items: chartArtistItems(8) }));
		}
		if (u.includes("mytopspotify.io")) {
			return Promise.resolve(makeResponse(200, { data: [] }));
		}
		return Promise.reject(new Error("unexpected fetch"));
	});
});

async function renderAndWaitForLoad() {
	const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
	const result = render(React.createElement(WorldChartsPage));
	await vi.waitFor(() => {
		expect(result.container.querySelector(".world-charts-skeleton")).toBeNull();
	});
	return result;
}

describe("WorldTrack type and WORLD_TRACKS mock data", () => {
	it("WORLD_TRACKS has 8 entries", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		expect(WORLD_TRACKS).toHaveLength(8);
	});

	it("each track has required fields", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		for (const t of WORLD_TRACKS) {
			expect(typeof t.id).toBe("string");
			expect(typeof t.title).toBe("string");
			expect(typeof t.artist).toBe("string");
			expect(typeof t.country).toBe("string");
			expect(typeof t.plays).toBe("string");
			expect(t.delta === null || typeof t.delta === "number").toBe(true);
		}
	});
});

describe("worldChartsService", () => {
	it("getCharts returns 8 tracks", async () => {
		const { getCharts } = await import("../app/world-charts-service");
		expect(getCharts("world", "today")).toHaveLength(8);
	});
});

describe("WorldChartsPage  -  rendering", () => {
	it("renders section heading with kicker 'World Charts'", async () => {
		const { container } = await renderAndWaitForLoad();
		const kickers = container.querySelectorAll(".section-kicker");
		expect(kickers.length).toBeGreaterThan(0);
		expect(kickers[0]?.textContent).toBe("World Charts");
	});

	it("renders window tabs with four range options", async () => {
		const { container } = await renderAndWaitForLoad();
		const windowTabs = container.querySelector("[data-tabs='window']");
		expect(windowTabs).not.toBeNull();
		const labels = Array.from(windowTabs!.querySelectorAll("button")).map((b) => b.textContent);
		expect(labels).toEqual(["Today", "This week", "This month", "All-time"]);
	});

	it("renders source attribution for stats.fm", async () => {
		const { container } = await renderAndWaitForLoad();
		const source = container.querySelector(".world-charts-source");
		expect(source?.textContent).toContain("stats.fm");
	});

	it("renders world page beta notice", async () => {
		const { container } = await renderAndWaitForLoad();
		expect(container.querySelector(".world-page-notice")).not.toBeNull();
	});

	it("renders two section cards for tracks and artists", async () => {
		const { container } = await renderAndWaitForLoad();
		const cards = container.querySelectorAll(".world-charts-layout .section-card");
		expect(cards.length).toBe(2);
	});

	it("renders 8 ranked track items", async () => {
		const { container } = await renderAndWaitForLoad();
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		expect(items).toHaveLength(8);
	});
});

describe("WorldChartsPage  -  art tiles", () => {
	it("track tiles use gradient when no art URL", async () => {
		const { container } = await renderAndWaitForLoad();
		const tracksSection = container.querySelector("[data-section='tracks']");
		const tile = tracksSection!.querySelector(".world-chart-tile") as HTMLElement;
		expect(tile.style.background).toContain("linear-gradient");
	});

	it("artist tiles are round", async () => {
		const { container } = await renderAndWaitForLoad();
		const artistsSection = container.querySelector("[data-section='artists']");
		const tiles = artistsSection!.querySelectorAll(".world-chart-tile");
		for (const tile of tiles) {
			expect(tile.classList.contains("world-chart-tile--round")).toBe(true);
		}
	});
});

describe("WorldChartsPage  -  window interaction", () => {
	it("defaults window to 'today'", async () => {
		const { container } = await renderAndWaitForLoad();
		const windowTabs = container.querySelector("[data-tabs='window']");
		const activeBtn = windowTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("Today");
	});

	it("persists window selection to localStorage", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		const { container } = await renderAndWaitForLoad();
		const windowTabs = container.querySelector("[data-tabs='window']");
		const weekBtn = windowTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(weekBtn);
		expect(localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW)).toBe("week");
	});

	it("restores window from localStorage on mount", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, "month");
		const { container } = await renderAndWaitForLoad();
		const windowTabs = container.querySelector("[data-tabs='window']");
		const activeBtn = windowTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("This month");
	});
});

describe("WorldChartsPage  -  click-to-search", () => {
	beforeEach(() => {
		vi.mocked(Spicetify.Platform.History.push).mockClear();
	});

	it("clicking a track item triggers Spotify search navigation", async () => {
		const { container } = await renderAndWaitForLoad();
		const items = container.querySelectorAll(".world-chart-item");
		fireEvent.click(items[0]);
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith(expect.stringContaining("/search/"));
	});
});

describe("page navigation  -  PAGE_IDS", () => {
	it("PAGE_IDS contains 'dashboard' and 'world'", async () => {
		const { PAGE_IDS } = await import("../app/preferences");
		expect(PAGE_IDS).toContain("dashboard");
		expect(PAGE_IDS).toContain("world");
	});
});
