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
			id: 1000 + i,
			name: `Track ${i + 1}`,
			artists: [{ name: `Artist ${i + 1}` }],
			albums: [{}],
			externalIds: i === 0 ? { spotify: ["spotify-track-1"] } : {},
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

function chartAlbumItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		position: i + 1,
		streams: 3000 * (n - i),
		indicator: "NONE",
		album: { name: `Album ${i + 1}`, artists: [{ name: `Artist ${i + 1}` }] },
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
			return Promise.resolve(makeResponse(200, { items: chartTrackItems(10) }));
		}
		if (u.includes("/charts/top/artists")) {
			return Promise.resolve(makeResponse(200, { items: chartArtistItems(10) }));
		}
		if (u.includes("/charts/top/albums")) {
			return Promise.resolve(makeResponse(200, { items: chartAlbumItems(10) }));
		}
		if (u.includes("mytopspotify.io")) {
			return Promise.resolve(makeResponse(200, { data: [] }));
		}
		if (u.includes("/tracks/") && !u.includes("/charts/")) {
			return Promise.resolve(
				makeResponse(200, {
					item: { externalIds: { spotify: ["resolved-spotify-id"] } },
				}),
			);
		}
		return Promise.reject(new Error("unexpected fetch"));
	});
});

async function renderAndWaitForLoad() {
	const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
	const result = render(React.createElement(WorldChartsPage));
	await vi.waitFor(() => {
		expect(result.container.querySelector("[data-testid='world-hero-title']")).not.toBeNull();
	});
	return result;
}

describe("WorldTrack type and WORLD_TRACKS mock data", () => {
	it("WORLD_TRACKS has 10 entries", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		expect(WORLD_TRACKS).toHaveLength(10);
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
	it("getCharts returns 10 tracks", async () => {
		const { getCharts } = await import("../app/world-charts-service");
		expect(getCharts("world", "today")).toHaveLength(10);
	});
});

describe("WorldChartsPage — rendering", () => {
	it("renders page kicker and World title", async () => {
		const { container } = await renderAndWaitForLoad();
		expect(container.querySelector("[data-testid='world-page-kicker']")?.textContent).toBe(
			"What the planet is playing",
		);
		expect(container.querySelector(".world-page-header .section-title")?.textContent).toBe("World");
	});

	it("renders window tabs with supported ranges", async () => {
		const { container } = await renderAndWaitForLoad();
		const windowTabs = container.querySelector("[data-testid='world-window-tabs']");
		expect(windowTabs).not.toBeNull();
		const labels = Array.from(windowTabs!.querySelectorAll("button")).map((b) => b.textContent);
		expect(labels).toEqual(["Today", "This Week"]);
	});

	it("renders source attribution for stats.fm", async () => {
		const { container } = await renderAndWaitForLoad();
		const source = container.querySelector(".world-charts-source");
		expect(source?.textContent).toContain("stats.fm");
	});

	it("renders three chart section cards", async () => {
		const { container } = await renderAndWaitForLoad();
		expect(container.querySelector("[data-section='tracks']")).not.toBeNull();
		expect(container.querySelector("[data-section='artists']")).not.toBeNull();
		expect(container.querySelector("[data-section='albums']")).not.toBeNull();
	});

	it("renders hero for #1 track", async () => {
		const { container } = await renderAndWaitForLoad();
		expect(container.querySelector(".world-hero-section")).not.toBeNull();
		expect(container.querySelector("[data-testid='world-hero-title']")?.textContent).toBe("Track 1");
	});

	it("renders hero aside highlights on large layout", async () => {
		const { container } = await renderAndWaitForLoad();
		const aside = container.querySelector(".world-hero-aside");
		expect(aside).not.toBeNull();
		expect(aside!.querySelectorAll(".world-aside-card").length).toBeGreaterThanOrEqual(3);
	});

	it("renders list rows in tracks section", async () => {
		const { container } = await renderAndWaitForLoad();
		const tracksSection = container.querySelector("[data-section='tracks']");
		expect(tracksSection!.querySelectorAll(".top-list-row").length).toBe(10);
	});
});

describe("WorldChartsPage — art tiles", () => {
	it("row tiles use gradient fallback when no art URL", async () => {
		const { container } = await renderAndWaitForLoad();
		const tracksSection = container.querySelector("[data-section='tracks']");
		const tile = tracksSection!.querySelector(".track-art--fallback") as HTMLElement;
		expect(tile).not.toBeNull();
		expect(tile.style.background).toContain("linear-gradient");
	});
});

describe("WorldChartsPage — window interaction", () => {
	it("defaults window to 'today'", async () => {
		const { container } = await renderAndWaitForLoad();
		const activeBtn = container.querySelector("[data-testid='world-window-tabs'] .period-tab.active");
		expect(activeBtn?.textContent).toBe("Today");
	});

	it("persists window selection to localStorage", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		const { container } = await renderAndWaitForLoad();
		const weekBtn = container.querySelectorAll("[data-testid='world-window-tabs'] button")[1]!;
		fireEvent.click(weekBtn);
		expect(localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW)).toBe("week");
	});

	it("restores window from localStorage on mount", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, "week");
		const { container } = await renderAndWaitForLoad();
		const activeBtn = container.querySelector("[data-testid='world-window-tabs'] .period-tab.active");
		expect(activeBtn?.textContent).toBe("This Week");
	});
});

describe("WorldChartsPage — click navigation", () => {
	beforeEach(() => {
		vi.mocked(Spicetify.Platform.History.push).mockClear();
	});

	it("clicking hero play uses Spotify player when track id exists", async () => {
		const playUri = vi.fn();
		(Spicetify.Player as { playUri?: (uri: string) => void }).playUri = playUri;
		const { container } = await renderAndWaitForLoad();
		const playBtn = container.querySelector("[data-testid='world-hero-play']") as HTMLButtonElement;
		fireEvent.click(playBtn);
		expect(playUri).toHaveBeenCalledWith("spotify:track:spotify-track-1");
	});

	it("does not expose month or all-time tabs (stats.fm unsupported)", async () => {
		const { container } = await renderAndWaitForLoad();
		const labels = Array.from(container.querySelectorAll("[data-testid='world-window-tabs'] button")).map(
			(b) => b.textContent,
		);
		expect(labels).not.toContain("This Month");
		expect(labels).not.toContain("All Time");
	});

	it("resets persisted month window to today", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, "month");
		const { container } = await renderAndWaitForLoad();
		const active = container.querySelector("[data-testid='world-window-tabs'] .period-tab.active");
		expect(active?.textContent).toBe("Today");
	});

	it("clicking a list row opens track page after spotify id enrichment", async () => {
		const { container } = await renderAndWaitForLoad();
		const tracksSection = container.querySelector("[data-section='tracks']");
		const rows = tracksSection!.querySelectorAll(".top-list-row");
		fireEvent.click(rows[3] as HTMLElement);
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith("/track/resolved-spotify-id");
	});
});

describe("page navigation — PAGE_IDS", () => {
	it("PAGE_IDS contains 'dashboard' and 'world'", async () => {
		const { PAGE_IDS } = await import("../app/preferences");
		expect(PAGE_IDS).toContain("dashboard");
		expect(PAGE_IDS).toContain("world");
	});
});
