import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { providerRegistry } from "../shared/stats/provider";
import { localProvider } from "../shared/stats/local-provider";
import { statsfmProvider } from "../shared/stats/statsfm-provider";
import { setPreference } from "../app/preferences";
import type { StatsResult, Period } from "../shared/types/stats";

const baseStats: StatsResult = {
	topTracks: [],
	topArtists: [],
	topAlbums: [],
	topGenres: [],
	totalPlays: 100,
	totalDuration: 7_200_000,
	recentPlays: [],
	hourlyDistribution: Array(24).fill(0),
	peakHour: 14,
	skipRate: 0.1,
	uniqueTrackCount: 50,
	uniqueArtistCount: 20,
};

const mockPeriod: Period = {
	id: "today",
	label: "Today",
	getBoundaries: () => ({ start: 0, end: Date.now() }),
} as unknown as Period;

function setActiveProvider(id: "local" | "statsfm"): void {
	providerRegistry._resetForTesting();
	providerRegistry.register(localProvider);
	providerRegistry.register(statsfmProvider);
	providerRegistry.setActive(id);
}

async function renderOverview(container: HTMLElement, stats: StatsResult, period: Period = mockPeriod) {
	const OverviewSection = (await import("../app/components/OverviewSection")).default;
	Spicetify.ReactDOM.render(
		Spicetify.React.createElement(OverviewSection, { stats, activePeriod: period }),
		container,
	);
}

// ──────────────────────────────────────────────────────────────────────
// 1. Overview 2x2 grid: stats.fm right block must be 2 columns, not 4
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: overview right block is always 2-column (2x2)", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("stats.fm: 4 cards in right block use 2-column grid (2x2 layout)", async () => {
		setActiveProvider("statsfm");
		await renderOverview(container, {
			...baseStats,
			newArtistCount: 5,
			topGenres: [{ rank: 1, genre: "rock", count: 10 } as any],
		});
		const rightBlock = container.querySelector<HTMLElement>(".overview-right-block");
		expect(rightBlock).not.toBeNull();
		const cards = rightBlock!.querySelectorAll(".overview-card");
		expect(cards.length).toBe(4);
		const cols = rightBlock!.style.gridTemplateColumns;
		expect(cols).not.toContain("repeat(4");
	});

	it("local: 4 cards in right block also use max 2-column grid", async () => {
		setActiveProvider("local");
		await renderOverview(container, { ...baseStats, streak: 3, newArtistCount: 5 });
		const rightBlock = container.querySelector<HTMLElement>(".overview-right-block");
		expect(rightBlock).not.toBeNull();
		const cards = rightBlock!.querySelectorAll(".overview-card");
		expect(cards.length).toBe(4);
		const cols = rightBlock!.style.gridTemplateColumns;
		expect(cols).not.toContain("repeat(4");
	});

	it("stats.fm: no bottom row when only 4 cards total", async () => {
		setActiveProvider("statsfm");
		await renderOverview(container, {
			...baseStats,
			newArtistCount: 5,
			topGenres: [{ rank: 1, genre: "rock", count: 10 } as any],
		});
		expect(container.querySelector(".overview-bottom-row")).toBeNull();
	});
});

// ──────────────────────────────────────────────────────────────────────
// 2. Card reflow: missing cards should not leave holes
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: card reflow for missing/unavailable cards", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
		setActiveProvider("local");
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("when newArtistCount missing, remaining bottom row cards reflow without gaps", async () => {
		await renderOverview(container, { ...baseStats, streak: 3 });
		const bottomRow = container.querySelector<HTMLElement>(".overview-bottom-row");
		expect(bottomRow).not.toBeNull();
		const cards = bottomRow!.querySelectorAll(".overview-card");
		expect(cards.length).toBe(2);
		const cols = bottomRow!.style.gridTemplateColumns;
		expect(cols).toContain("2");
	});

	it("hiding a card via prefs does not leave an empty slot", async () => {
		setPreference("hiddenSections", ["streak"]);
		await renderOverview(container, { ...baseStats, streak: 3, newArtistCount: 5 });
		const allCards = container.querySelectorAll("[data-card-id]");
		const ids = Array.from(allCards).map((c) => c.getAttribute("data-card-id"));
		expect(ids).not.toContain("streak");
		expect(ids.length).toBe(6);
	});
});

// ──────────────────────────────────────────────────────────────────────
// 3. Spacing: stats-page-content gap verified via CSS file content
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: section spacing", () => {
	it("stats-page-content uses --space-md (16px) gap, not --space-lg (24px)", async () => {
		const fs = await import("fs");
		const css = fs.readFileSync("src/app/styles.css", "utf8");
		const match = css.match(/\.stats-page-content\s*\{[^}]*gap:\s*([^;]+)/);
		expect(match).not.toBeNull();
		expect(match![1]).toContain("--space-md");
		expect(match![1]).not.toContain("--space-lg");
	});
});

// ──────────────────────────────────────────────────────────────────────
// 4. Onboarding: wizard is in-page, not a dialog
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: onboarding is in-page window", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("wizard does not use role=dialog", async () => {
		const { SetupWizard } = await import("../app/components/SetupWizard");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(SetupWizard, { onComplete: vi.fn() }),
			container,
		);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});

	it("wizard does not use aria-modal", async () => {
		const { SetupWizard } = await import("../app/components/SetupWizard");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(SetupWizard, { onComplete: vi.fn() }),
			container,
		);
		expect(container.querySelector('[aria-modal]')).toBeNull();
	});
});

// ──────────────────────────────────────────────────────────────────────
// 5. Data wipe: must delete IndexedDB databases
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: data wipe clears all storage", () => {
	it("wipe handler clears localStorage and sessionStorage", async () => {
		localStorage.setItem("test-key", "test-value");
		sessionStorage.setItem("test-key", "test-value");
		const { db } = await import("../shared/storage/db");
		const { statsCache } = await import("../shared/stats/stats-cache");
		const { lastfmCache } = await import("../shared/api/lastfm-cache");

		await db.delete();
		statsCache.invalidate();
		await lastfmCache.deleteDatabase();
		localStorage.clear();
		sessionStorage.clear();

		expect(localStorage.getItem("test-key")).toBeNull();
		expect(sessionStorage.getItem("test-key")).toBeNull();
	});
});

// ──────────────────────────────────────────────────────────────────────
// 6. Playbar widget: retry-based mounting
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: playbar widget mounts with retry", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("findPlaybarMount returns null when no matching elements exist", async () => {
		const { findPlaybarMount } = await import("../app/index");
		expect(findPlaybarMount()).toBeNull();
	});

	it("findPlaybarMount finds .main-nowPlayingWidget-nowPlaying", async () => {
		const el = document.createElement("div");
		el.className = "main-nowPlayingWidget-nowPlaying";
		document.body.appendChild(el);
		const { findPlaybarMount } = await import("../app/index");
		expect(findPlaybarMount()).toBe(el);
	});

	it("findPlaybarMount falls back to .main-nowPlayingBar-left", async () => {
		const el = document.createElement("div");
		el.className = "main-nowPlayingBar-left";
		document.body.appendChild(el);
		const { findPlaybarMount } = await import("../app/index");
		expect(findPlaybarMount()).toBe(el);
	});

	it("findPlaybarMount falls back to [data-testid='now-playing-widget']", async () => {
		const el = document.createElement("div");
		el.setAttribute("data-testid", "now-playing-widget");
		document.body.appendChild(el);
		const { findPlaybarMount } = await import("../app/index");
		expect(findPlaybarMount()).toBe(el);
	});
});

// ──────────────────────────────────────────────────────────────────────
// 7. Em-dash tests: source uses regular hyphen, not em-dash
// ──────────────────────────────────────────────────────────────────────
describe("Issue 41: no em-dash in UI values", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
		setActiveProvider("local");
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("streak == 0 renders hyphen-minus, not em-dash", async () => {
		await renderOverview(container, { ...baseStats, streak: 0, newArtistCount: 3 });
		const streakCard = container.querySelector('[data-card-id="streak"]');
		const value = streakCard!.querySelector(".overview-card-value");
		expect(value?.textContent).toBe("-");
	});

	it("top-genre with empty topGenres renders hyphen-minus, not em-dash", async () => {
		setActiveProvider("statsfm");
		await renderOverview(container, { ...baseStats, newArtistCount: 5, topGenres: [] });
		const card = container.querySelector('[data-card-id="top-genre"]');
		expect(card?.querySelector(".overview-card-value")?.textContent).toBe("-");
	});
});
