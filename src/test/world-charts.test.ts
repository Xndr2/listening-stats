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
			return Promise.resolve(makeResponse(200, { items: chartTrackItems(15) }));
		}
		if (u.includes("/charts/top/artists")) {
			return Promise.resolve(makeResponse(200, { items: chartArtistItems(15) }));
		}
		if (u.includes("/charts/top/albums")) {
			return Promise.resolve(makeResponse(200, { items: chartAlbumItems(15) }));
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
		expect(result.container.querySelector("[data-testid='world-podium-title']")).not.toBeNull();
	});
	return result;
}

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

	it("renders kind tabs in the podium card header", async () => {
		const { container } = await renderAndWaitForLoad();
		const card = container.querySelector("[data-testid='world-podium-card']");
		const kindTabs = card!.querySelector("[data-testid='world-kind-tabs']");
		expect(kindTabs).not.toBeNull();
		const labels = Array.from(kindTabs!.querySelectorAll("button")).map((b) => b.textContent);
		expect(labels).toEqual(["Tracks", "Artists", "Albums"]);
	});

	it("renders the podium with #1 centered and medal ranks", async () => {
		const { container } = await renderAndWaitForLoad();
		const podium = container.querySelector("[data-testid='world-podium']");
		expect(podium).not.toBeNull();
		expect(container.querySelector("[data-testid='world-podium-title']")?.textContent).toBe("Track 1");
		const ranks = Array.from(podium!.querySelectorAll(".world-podium-rank")).map((r) => r.textContent);
		expect(ranks).toEqual(["2", "1", "3"]);
		expect(podium!.querySelector(".world-podium-rank")?.classList.contains("rank-silver")).toBe(true);
	});

	it("renders the ladder card with ranks 4-15 in top-list rows", async () => {
		const { container } = await renderAndWaitForLoad();
		const card = container.querySelector("[data-testid='world-ladder-card']");
		expect(card).not.toBeNull();
		const rows = card!.querySelectorAll(".top-list-row");
		expect(rows.length).toBe(12);
		expect(rows[0].querySelector(".rank-number")?.textContent).toBe("4");
		expect(rows[11].querySelector(".rank-number")?.textContent).toBe("15");
	});

	it("switching kind swaps the stage and persists the choice", async () => {
		const { container } = await renderAndWaitForLoad();
		const artistsBtn = container.querySelectorAll("[data-testid='world-kind-tabs'] button")[1]!;
		fireEvent.click(artistsBtn);
		expect(container.querySelector("[data-testid='world-podium-title']")?.textContent).toBe("Star 1");
		expect(localStorage.getItem("listening-stats:world-charts-kind")).toBe("artist");
	});
});

describe("WorldChartsPage — art tiles", () => {
	it("tiles use gradient fallback when no art URL", async () => {
		const { container } = await renderAndWaitForLoad();
		const tile = container.querySelector(".track-art--fallback") as HTMLElement;
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

	it("clicking the #1 podium play button uses Spotify player when track id exists", async () => {
		const playUri = vi.fn();
		(Spicetify.Player as { playUri?: (uri: string) => void }).playUri = playUri;
		const { container } = await renderAndWaitForLoad();
		const cell = container.querySelector(".world-podium-cell[data-rank='1']");
		const playBtn = cell!.querySelector(".world-chart-playbtn") as HTMLButtonElement;
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

	it("clicking a ladder row opens track page after spotify id enrichment", async () => {
		const { container } = await renderAndWaitForLoad();
		const card = container.querySelector("[data-testid='world-ladder-card']");
		const rows = card!.querySelectorAll(".top-list-row");
		fireEvent.click(rows[0] as HTMLElement);
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
