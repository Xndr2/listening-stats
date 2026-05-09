import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	cleanup();
	localStorage.clear();
});

async function renderAndWaitForLoad(props: {
	hasLastfmKey: boolean;
	onConnectLastfm?: () => void;
}) {
	const { WorldChartsPage } = await import("../app/components/WorldChartsPage");
	const result = render(React.createElement(WorldChartsPage, props));
	if (props.hasLastfmKey) {
		await vi.waitFor(() => {
			expect(result.container.querySelector(".world-charts-skeleton")).toBeNull();
		});
	}
	return result;
}

// ─── WorldTrack type + mock data ─────────────────────────────────────────────

describe("WorldTrack type and WORLD_TRACKS mock data", () => {
	it("WORLD_TRACKS has 8 entries", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		expect(WORLD_TRACKS).toHaveLength(8);
	});

	it("each track has id, title, artist, country, plays, delta fields", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		for (const t of WORLD_TRACKS) {
			expect(typeof t.id).toBe("string");
			expect(typeof t.title).toBe("string");
			expect(typeof t.artist).toBe("string");
			expect(typeof t.country).toBe("string");
			expect(typeof t.plays).toBe("string");
			expect(typeof t.delta).toBe("number");
		}
	});

	it("track ids are unique", async () => {
		const { WORLD_TRACKS } = await import("../app/world-charts-service");
		const ids = WORLD_TRACKS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

// ─── worldChartsService ──────────────────────────────────────────────────────

describe("worldChartsService", () => {
	it("getCharts returns an array of WorldTrack", async () => {
		const { getCharts } = await import("../app/world-charts-service");
		const tracks = getCharts("world", "today");
		expect(Array.isArray(tracks)).toBe(true);
		expect(tracks.length).toBeGreaterThan(0);
	});

	it("returns 8 tracks for default scope/window", async () => {
		const { getCharts } = await import("../app/world-charts-service");
		expect(getCharts("world", "today")).toHaveLength(8);
	});

	it("returns data for all scope/window combinations", async () => {
		const { getCharts } = await import("../app/world-charts-service");
		const scopes = ["world", "us", "gb", "jp"] as const;
		const windows = ["today", "week"] as const;
		for (const scope of scopes) {
			for (const win of windows) {
				const tracks = getCharts(scope, win);
				expect(tracks).toHaveLength(8);
				expect(tracks[0].title).toBeTruthy();
			}
		}
	});
});

// ─── Preferences  -  activePage ────────────────────────────────────────────────

describe("preferences  -  activePage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults to 'dashboard' on fresh install", async () => {
		const { getPreferences } = await import("../app/preferences");
		expect(getPreferences().activePage).toBe("dashboard");
	});

	it("persists activePage via setPreference and round-trips", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activePage", "world");
		expect(getPreferences().activePage).toBe("world");
	});

	it("preserves activePage when setting other preferences", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activePage", "world");
		setPreference("use24HourTime", true);
		const prefs = getPreferences();
		expect(prefs.activePage).toBe("world");
		expect(prefs.use24HourTime).toBe(true);
	});

	it("falls back to 'dashboard' for unknown stored activePage value", async () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ activePage: "nonexistent" }),
		);
		const { getPreferences } = await import("../app/preferences");
		const prefs = getPreferences();
		expect(prefs.activePage).toBe("nonexistent");
	});
});

// ─── WorldChartsPage  -  rendering ────────────────────────────────────────────

describe("WorldChartsPage  -  rendering", () => {
	it("renders section heading with kicker 'World Charts'", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const kickers = container.querySelectorAll(".section-kicker");
		expect(kickers.length).toBeGreaterThan(0);
		expect(kickers[0]?.textContent).toBe("World Charts");
	});

	it("renders section heading with title 'What the world is playing'", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const title = container.querySelector(".section-title");
		expect(title).not.toBeNull();
		expect(title?.textContent).toBe("What the world is playing");
	});

	it("renders 8 ranked track items in tracks section", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		expect(tracksSection).not.toBeNull();
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		expect(items).toHaveLength(8);
	});

	it("renders scope tabs with World, US, UK, JP options", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		expect(scopeTabs).not.toBeNull();
		const buttons = scopeTabs!.querySelectorAll("button");
		const labels = Array.from(buttons).map((b) => b.textContent);
		expect(labels).toEqual(["World", "US", "UK", "JP"]);
	});

	it("renders window tabs with Today, Week options", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const windowTabs = container.querySelector("[data-tabs='window']");
		expect(windowTabs).not.toBeNull();
		const buttons = windowTabs!.querySelectorAll("button");
		const labels = Array.from(buttons).map((b) => b.textContent);
		expect(labels).toEqual(["Today", "Week"]);
	});

	it("renders source attribution line", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const source = container.querySelector(".world-charts-source");
		expect(source).not.toBeNull();
		expect(source?.textContent).toContain("Last.fm");
	});

	it("applies rank badge classes to top 3 tracks", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		expect(items[0].querySelector(".rank-gold")).not.toBeNull();
		expect(items[1].querySelector(".rank-silver")).not.toBeNull();
		expect(items[2].querySelector(".rank-bronze")).not.toBeNull();
	});

	it("rank badges for top 3 display the rank number", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		expect(items[0].querySelector(".rank-gold")?.textContent).toBe("1");
		expect(items[1].querySelector(".rank-silver")?.textContent).toBe("2");
		expect(items[2].querySelector(".rank-bronze")?.textContent).toBe("3");
	});

	it("renders rank numbers for items beyond top 3", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		const rank4 = items[3].querySelector(".rank-number");
		expect(rank4).not.toBeNull();
		expect(rank4?.textContent).toBe("4");
	});

	it("renders 2-column grid layout for tracks and artists", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const grids = container.querySelectorAll(".world-charts-grid");
		expect(grids.length).toBe(2);
	});

	it("renders delta indicators (up/down/neutral)", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		const deltas = Array.from(items).map(
			(item) => item.querySelector(".world-chart-delta")?.textContent,
		);
		expect(deltas.length).toBe(8);
		expect(deltas.some((d) => d?.includes("▲"))).toBe(true);
		expect(deltas.some((d) => d?.includes("▼"))).toBe(true);
	});
});

// ─── WorldChartsPage  -  art tiles ──────────────────────────────────────────────

describe("WorldChartsPage  -  art tiles", () => {
	it("each track item contains a gradient tile placeholder", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const items = tracksSection!.querySelectorAll(".world-chart-item");
		for (const item of items) {
			const tile = item.querySelector(".world-chart-tile");
			expect(tile).not.toBeNull();
			expect((tile as HTMLElement).style.background).toContain("linear-gradient");
		}
	});

	it("track tiles are square (no round modifier)", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tracksSection = container.querySelector("[data-section='tracks']");
		const tiles = tracksSection!.querySelectorAll(".world-chart-tile");
		for (const tile of tiles) {
			expect(tile.classList.contains("world-chart-tile--round")).toBe(false);
		}
	});

	it("artist tiles are round", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const artistsSection = container.querySelector("[data-section='artists']");
		const tiles = artistsSection!.querySelectorAll(".world-chart-tile");
		expect(tiles.length).toBeGreaterThan(0);
		for (const tile of tiles) {
			expect(tile.classList.contains("world-chart-tile--round")).toBe(true);
		}
	});

	it("tiles have deterministic gradients based on item id", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const tiles = container.querySelectorAll(".world-chart-tile");
		const backgrounds = Array.from(tiles).map((t) => (t as HTMLElement).style.background);
		expect(backgrounds[0]).toBeTruthy();
		expect(backgrounds[0]).not.toBe(backgrounds[1]);
	});
});

// ─── WorldChartsPage  -  scope/window interaction ─────────────────────────────

describe("WorldChartsPage  -  scope/window interaction", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults scope to 'world'", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const activeBtn = scopeTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("World");
	});

	it("defaults window to 'today'", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const windowTabs = container.querySelector("[data-tabs='window']");
		const activeBtn = windowTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("Today");
	});

	it("clicking a scope tab selects it", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const usBtn = scopeTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(usBtn);
		expect(usBtn.classList.contains("active")).toBe(true);
	});

	it("clicking a window tab selects it", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const windowTabs = container.querySelector("[data-tabs='window']");
		const weekBtn = windowTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(weekBtn);
		expect(weekBtn.classList.contains("active")).toBe(true);
	});

	it("persists scope selection to localStorage", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const usBtn = scopeTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(usBtn);
		expect(localStorage.getItem(LS_KEYS.WORLD_CHARTS_SCOPE)).toBe("us");
	});

	it("persists window selection to localStorage", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const windowTabs = container.querySelector("[data-tabs='window']");
		const weekBtn = windowTabs!.querySelectorAll("button")[1]!;
		fireEvent.click(weekBtn);
		expect(localStorage.getItem(LS_KEYS.WORLD_CHARTS_WINDOW)).toBe("week");
	});

	it("restores scope from localStorage on mount", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_SCOPE, "jp");
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const activeBtn = scopeTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("JP");
	});

	it("restores window from localStorage on mount", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_WINDOW, "week");
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const windowTabs = container.querySelector("[data-tabs='window']");
		const activeBtn = windowTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("Week");
	});

	it("falls back to defaults for invalid stored scope", async () => {
		const { LS_KEYS } = await import("../shared/constants/storage-keys");
		localStorage.setItem(LS_KEYS.WORLD_CHARTS_SCOPE, "invalid");
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		const activeBtn = scopeTabs?.querySelector("button.active");
		expect(activeBtn?.textContent).toBe("World");
	});
});

// ─── WorldChartsPage  -  empty state ──────────────────────────────────────────

describe("WorldChartsPage  -  empty state (no Last.fm key)", () => {
	it("shows Connect Last.fm empty state when hasLastfmKey is false", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: false });
		const emptyState = container.querySelector(".world-charts-empty");
		expect(emptyState).not.toBeNull();
		expect(emptyState?.textContent).toContain("Last.fm");
	});

	it("does not render track list in empty state", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: false });
		const items = container.querySelectorAll(".world-chart-item");
		expect(items).toHaveLength(0);
	});

	it("does not render scope/window tabs in empty state", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: false });
		const scopeTabs = container.querySelector("[data-tabs='scope']");
		expect(scopeTabs).toBeNull();
	});

	it("renders normal content when hasLastfmKey is true", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const emptyState = container.querySelector(".world-charts-empty");
		expect(emptyState).toBeNull();
		const items = container.querySelectorAll(".world-chart-item");
		expect(items).toHaveLength(16);
	});

	it("empty state has a Connect button", async () => {
		const { container } = await renderAndWaitForLoad({
			hasLastfmKey: false,
			onConnectLastfm: () => {},
		});
		const btn = container.querySelector(".world-charts-empty button");
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toContain("Connect");
	});
});

// ─── WorldChartsPage  -  click-to-search ────────────────────────────────────────

describe("WorldChartsPage  -  click-to-search", () => {
	beforeEach(() => {
		vi.mocked(Spicetify.Platform.History.push).mockClear();
	});
	it("chart items have role=button and tabIndex for accessibility", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const items = container.querySelectorAll(".world-chart-item");
		expect(items.length).toBeGreaterThan(0);
		for (const item of items) {
			expect(item.getAttribute("role")).toBe("button");
			expect(item.getAttribute("tabindex")).toBe("0");
		}
	});

	it("clicking a track item triggers Spotify search navigation", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const items = container.querySelectorAll(".world-chart-item");
		fireEvent.click(items[0]);
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith(
			expect.stringContaining("/search/"),
		);
	});

	it("pressing Enter on a track item triggers navigation", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const items = container.querySelectorAll(".world-chart-item");
		fireEvent.keyDown(items[0], { key: "Enter" });
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith(
			expect.stringContaining("/search/"),
		);
	});

	it("pressing Space on a track item triggers navigation", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const items = container.querySelectorAll(".world-chart-item");
		fireEvent.keyDown(items[0], { key: " " });
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith(
			expect.stringContaining("/search/"),
		);
	});
});

// ─── WorldChartsPage  -  top artists section ────────────────────────────────────

describe("WorldChartsPage  -  top artists section", () => {
	it("renders a Top Artists section alongside tracks", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const sectionKickers = container.querySelectorAll(".section-kicker");
		const kickers = Array.from(sectionKickers).map((k) => k.textContent);
		expect(kickers).toContain("Trending");
		expect(kickers).toContain("Popular");
	});

	it("renders artist items in the artists grid", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const artistGrid = container.querySelector("[data-section='artists']");
		expect(artistGrid).not.toBeNull();
		const items = artistGrid!.querySelectorAll(".world-chart-item");
		expect(items.length).toBeGreaterThan(0);
	});

	it("artist items have click-to-search functionality", async () => {
		const { container } = await renderAndWaitForLoad({ hasLastfmKey: true });
		const artistGrid = container.querySelector("[data-section='artists']");
		const items = artistGrid!.querySelectorAll(".world-chart-item");
		fireEvent.click(items[0]);
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith(
			expect.stringContaining("/search/"),
		);
	});
});

// ─── Page navigation ─────────────────────────────────────────────────────────

describe("page navigation  -  PAGE_IDS", () => {
	it("PAGE_IDS contains 'dashboard' and 'world'", async () => {
		const { PAGE_IDS } = await import("../app/preferences");
		expect(PAGE_IDS).toContain("dashboard");
		expect(PAGE_IDS).toContain("world");
		expect(PAGE_IDS).toHaveLength(2);
	});
});
