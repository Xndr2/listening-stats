import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildLocalTooltip,
	buildStatsFmTooltip,
	getHealthColor,
	getStatsFmHealthColor,
} from "../app/components/Header";
import type { HealthPayload } from "../extension/tracker/health";
import type { StatsFmHealthPayload } from "../shared/api/statsfm-client";
import { localProvider } from "../shared/stats/local-provider";
import { LOCAL_PERIODS } from "../shared/stats/periods";
import { providerRegistry } from "../shared/stats/provider";
import { statsfmProvider } from "../shared/stats/statsfm-provider";

function setActiveProvider(id: "local" | "statsfm"): void {
	providerRegistry._resetForTesting();
	providerRegistry.register(localProvider);
	providerRegistry.register(statsfmProvider);
	providerRegistry.setActive(id);
}

const localCaps = {
	hasActivityData: true,
	hasGenreData: true,
	hasStreakData: true,
	hasSkipRate: false,
	tier: "n/a" as const,
};
const statsfmFreeCaps = {
	hasActivityData: false,
	hasGenreData: true,
	hasStreakData: false,
	hasSkipRate: false,
	tier: "free" as const,
};

// Frozen time for deterministic tests: 2023-11-14T22:13:20Z
const FROZEN_MS = 1700000000000;

// --- Header health color logic tests ---

describe("Header health color", () => {
	it("returns red when health is null", () => {
		expect(getHealthColor("local", null, null)).toBe("red");
	});

	it("returns red when lastWriteAt is null", () => {
		const health: HealthPayload = {
			healthy: false,
			lastWriteAt: null,
			lastTrackName: null,
			errorCount: 0,
			lastError: null,
		};
		expect(getHealthColor("local", health, null)).toBe("red");
	});

	it("returns green when last write < 5 min ago", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: Date.now() - 2 * 60_000, // 2 min ago
			lastTrackName: "Track",
			errorCount: 0,
			lastError: null,
		};
		expect(getHealthColor("local", health, null)).toBe("green");
	});

	it("returns yellow when last write 5-60 min ago", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: Date.now() - 30 * 60_000, // 30 min ago
			lastTrackName: "Track",
			errorCount: 0,
			lastError: null,
		};
		expect(getHealthColor("local", health, null)).toBe("yellow");
	});

	it("returns red when last write > 60 min ago", () => {
		const health: HealthPayload = {
			healthy: false,
			lastWriteAt: Date.now() - 90 * 60_000, // 90 min ago
			lastTrackName: "Track",
			errorCount: 0,
			lastError: null,
		};
		expect(getHealthColor("local", health, null)).toBe("red");
	});

	it("returns green at exactly 0 minutes (just now)", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: Date.now(),
			lastTrackName: "Track",
			errorCount: 0,
			lastError: null,
		};
		expect(getHealthColor("local", health, null)).toBe("green");
	});

	it("returns yellow at exactly 5 min ago boundary", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: Date.now() - 5 * 60_000, // exactly 5 min
			lastTrackName: "Track",
			errorCount: 0,
			lastError: null,
		};
		// 5 min: ageMin is 5 which is NOT < 5 so falls through to < 60 check → yellow
		expect(getHealthColor("local", health, null)).toBe("yellow");
	});

	it("delegates to stats.fm health when provider is statsfm", () => {
		const sfmPayload: StatsFmHealthPayload = {
			lastFetchAt: Date.now(),
			lastSuccessAt: Date.now() - 2 * 60_000, // 2 min ago = green
			lastError: null,
			circuitOpen: false,
		};
		expect(getHealthColor("statsfm", null, sfmPayload)).toBe("green");
	});
});

// --- buildLocalTooltip tests ---

describe("buildLocalTooltip", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FROZEN_MS);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns 'No plays recorded yet' when health is null", () => {
		expect(buildLocalTooltip(null)).toBe("No plays recorded yet");
	});

	it("returns 'No plays recorded yet' when lastWriteAt is null", () => {
		const health: HealthPayload = {
			healthy: false,
			lastWriteAt: null,
			lastTrackName: null,
			errorCount: 0,
			lastError: null,
		};
		expect(buildLocalTooltip(health)).toBe("No plays recorded yet");
	});

	it("returns 'Tracking error: {error}' when healthy=false with lastError", () => {
		const health: HealthPayload = {
			healthy: false,
			lastWriteAt: FROZEN_MS - 10 * 60_000,
			lastTrackName: "Some Track",
			errorCount: 1,
			lastError: "IndexedDB write failed",
		};
		expect(buildLocalTooltip(health)).toBe("Tracking error: IndexedDB write failed");
	});

	it("returns 'Last play just now' when lastWriteAt < 1 min ago", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: FROZEN_MS - 30_000, // 30 sec ago
			lastTrackName: "My Track",
			errorCount: 0,
			lastError: null,
		};
		expect(buildLocalTooltip(health)).toBe("Last play just now - My Track");
	});

	it("returns 'Last play 3m ago - {trackName}' for 3 min ago", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: FROZEN_MS - 3 * 60_000,
			lastTrackName: "My Track",
			errorCount: 0,
			lastError: null,
		};
		expect(buildLocalTooltip(health)).toBe("Last play 3m ago - My Track");
	});

	it("returns 'Last play 2h ago - {trackName}' for 2 hours ago", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: FROZEN_MS - 2 * 60 * 60_000,
			lastTrackName: "My Track",
			errorCount: 0,
			lastError: null,
		};
		expect(buildLocalTooltip(health)).toBe("Last play 2h ago - My Track");
	});

	it("truncates trackName > 40 chars with ellipsis", () => {
		const longName = "A Very Long Track Name That Exceeds The Forty Character Limit";
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: FROZEN_MS - 5 * 60_000,
			lastTrackName: longName,
			errorCount: 0,
			lastError: null,
		};
		const result = buildLocalTooltip(health);
		expect(result).toContain("A Very Long Track Name That Exceeds The ");
		expect(result).toContain("...");
		const trackPart = result.split(" - ")[1];
		expect(trackPart).toBe("A Very Long Track Name That Exceeds The " + "...");
	});

	it("omits track suffix when lastTrackName is null", () => {
		const health: HealthPayload = {
			healthy: true,
			lastWriteAt: FROZEN_MS - 5 * 60_000,
			lastTrackName: null,
			errorCount: 0,
			lastError: null,
		};
		expect(buildLocalTooltip(health)).toBe("Last play 5m ago");
	});
});

// --- buildStatsFmTooltip tests ---

describe("buildStatsFmTooltip", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FROZEN_MS);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns 'No data fetched yet' when health is null", () => {
		expect(buildStatsFmTooltip(null)).toBe("No data fetched yet");
	});

	it("returns 'No data fetched yet' when lastFetchAt is null", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: null,
			lastSuccessAt: null,
			lastError: null,
			circuitOpen: false,
		};
		expect(buildStatsFmTooltip(health)).toBe("No data fetched yet");
	});

	it("returns 'stats.fm unavailable: circuit open' when circuitOpen is true", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: null,
			lastError: null,
			circuitOpen: true,
		};
		expect(buildStatsFmTooltip(health)).toBe("stats.fm unavailable: circuit open");
	});

	it("returns 'API error: {error}' when lastError is set", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: null,
			lastError: "Rate limited",
			circuitOpen: false,
		};
		expect(buildStatsFmTooltip(health)).toBe("API error: Rate limited");
	});

	it("truncates lastError > 60 chars with ellipsis", () => {
		const longError = "This is a very long error message that exceeds sixty characters in total length";
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: null,
			lastError: longError,
			circuitOpen: false,
		};
		const result = buildStatsFmTooltip(health);
		expect(result.startsWith("API error: ")).toBe(true);
		const errorPart = result.slice("API error: ".length);
		expect(errorPart.endsWith("…")).toBe(true);
		expect(errorPart.length).toBe(61);
	});

	it("returns 'API healthy, just refreshed' with refresh countdown when lastSuccessAt < 1 min ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 30_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(buildStatsFmTooltip(health)).toBe("API healthy, just refreshed · refresh in 1m 30s");
	});

	it("returns 'API healthy, refreshed 5m ago' with due-now status for 5 min ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 5 * 60_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(buildStatsFmTooltip(health)).toBe("API healthy, refreshed 5m ago · refresh due now");
	});

	it("returns 'Data stale, last refresh 2h ago' with due-now status for 2 hours ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 2 * 60 * 60_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(buildStatsFmTooltip(health)).toBe("Data stale, last refresh 2h ago · refresh due now");
	});
});

// --- getStatsFmHealthColor tests ---

describe("getStatsFmHealthColor", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FROZEN_MS);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns 'red' when health is null", () => {
		expect(getStatsFmHealthColor(null)).toBe("red");
	});

	it("returns 'red' when circuitOpen is true", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 60_000,
			lastError: null,
			circuitOpen: true,
		};
		expect(getStatsFmHealthColor(health)).toBe("red");
	});

	it("returns 'red' when lastSuccessAt is null", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: null,
			lastError: null,
			circuitOpen: false,
		};
		expect(getStatsFmHealthColor(health)).toBe("red");
	});

	it("returns 'green' when lastSuccessAt < 30 min ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 10 * 60_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(getStatsFmHealthColor(health)).toBe("green");
	});

	it("returns 'yellow' when lastSuccessAt 31-119 min ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 60 * 60_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(getStatsFmHealthColor(health)).toBe("yellow");
	});

	it("returns 'red' when lastSuccessAt >= 120 min ago", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: FROZEN_MS - 120 * 60_000,
			lastError: null,
			circuitOpen: false,
		};
		expect(getStatsFmHealthColor(health)).toBe("red");
	});

	it("returns 'red' when lastError set and no prior success", () => {
		const health: StatsFmHealthPayload = {
			lastFetchAt: FROZEN_MS,
			lastSuccessAt: null,
			lastError: "Connection refused",
			circuitOpen: false,
		};
		expect(getStatsFmHealthColor(health)).toBe("red");
	});
});

// --- Component render tests ---

describe("EmptyState component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it('renders "No listening data yet" text', async () => {
		const EmptyState = (await import("../app/components/EmptyState")).default;
		const onOpenSettings = vi.fn();
		Spicetify.ReactDOM.render(Spicetify.React.createElement(EmptyState, { onOpenSettings }), container);
		expect(container.textContent).toContain("No listening data yet");
	});

	it('renders "Open Settings" button', async () => {
		const EmptyState = (await import("../app/components/EmptyState")).default;
		const onOpenSettings = vi.fn();
		Spicetify.ReactDOM.render(Spicetify.React.createElement(EmptyState, { onOpenSettings }), container);
		expect(container.textContent).toContain("Open Settings");
	});

	it("calls onOpenSettings when button is clicked", async () => {
		const EmptyState = (await import("../app/components/EmptyState")).default;
		const onOpenSettings = vi.fn();
		Spicetify.ReactDOM.render(Spicetify.React.createElement(EmptyState, { onOpenSettings }), container);
		const button = container.querySelector("button");
		button?.click();
		expect(onOpenSettings).toHaveBeenCalledOnce();
	});
});

describe("ErrorState component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders section name in error message", async () => {
		const ErrorState = (await import("../app/components/ErrorState")).default;
		const onRetry = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ErrorState, { sectionName: "Top Tracks", onRetry }),
			container,
		);
		expect(container.textContent).toContain("Top Tracks");
	});

	it('renders "Retry Load" button', async () => {
		const ErrorState = (await import("../app/components/ErrorState")).default;
		const onRetry = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ErrorState, { sectionName: "Activity Chart", onRetry }),
			container,
		);
		expect(container.textContent).toContain("Retry Load");
	});

	it("calls onRetry when Retry Load button is clicked", async () => {
		const ErrorState = (await import("../app/components/ErrorState")).default;
		const onRetry = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ErrorState, { sectionName: "Top Tracks", onRetry }),
			container,
		);
		const button = container.querySelector("button");
		button?.click();
		expect(onRetry).toHaveBeenCalledOnce();
	});
});

describe("PeriodTabs component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders correct number of tabs for LOCAL_PERIODS (5)", async () => {
		const PeriodTabs = (await import("../app/components/PeriodTabs")).default;
		const onPeriodChange = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(PeriodTabs, {
				periods: LOCAL_PERIODS,
				activePeriod: LOCAL_PERIODS[0],
				onPeriodChange,
			}),
			container,
		);
		const buttons = container.querySelectorAll("button");
		expect(buttons).toHaveLength(5);
	});

	it("marks active period tab with aria-selected=true", async () => {
		const PeriodTabs = (await import("../app/components/PeriodTabs")).default;
		const onPeriodChange = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(PeriodTabs, {
				periods: LOCAL_PERIODS,
				activePeriod: LOCAL_PERIODS[0],
				onPeriodChange,
			}),
			container,
		);
		const activeButton = container.querySelector('button[aria-selected="true"]');
		expect(activeButton).not.toBeNull();
		expect(activeButton?.textContent).toBe("Today");
	});

	it("calls onPeriodChange with the clicked period", async () => {
		const PeriodTabs = (await import("../app/components/PeriodTabs")).default;
		const onPeriodChange = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(PeriodTabs, {
				periods: LOCAL_PERIODS,
				activePeriod: LOCAL_PERIODS[0],
				onPeriodChange,
			}),
			container,
		);
		const buttons = container.querySelectorAll("button");
		buttons[1].click(); // "This Week"
		expect(onPeriodChange).toHaveBeenCalledWith(LOCAL_PERIODS[1]);
	});
});

describe("OverviewCards tooltips", () => {
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

	const baseStats = {
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

	it("each card object has a tooltip field (local provider)", async () => {
		// Hero spans left columns; stat tiles fill right block and bottom row (six tiles without new-artists data).
		setActiveProvider("local");
		const OverviewSection = (await import("../app/components/OverviewSection")).default;
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(OverviewSection, {
				stats: baseStats,
				activePeriod: LOCAL_PERIODS[0],
			}),
			container,
		);
		// Six overview tiles when new-artists is hidden without a count
		const cards = container.querySelectorAll(".overview-card");
		expect(cards.length).toBeGreaterThanOrEqual(4);
		// Hero lives in .overview-hero-cell
		const hero = container.querySelector(".overview-hero-cell");
		expect(hero).not.toBeNull();
	});

	it("shows Streak tooltip for local provider", async () => {
		const { filterOverviewCards } = await import("../app/components/OverviewCards");
		// Verify filterOverviewCards preserves tooltip field
		const testCards = [
			{
				label: "Streak",
				value: "5d",
				tooltip: "Consecutive calendar days with at least one play (local timezone)",
			},
		];
		const filtered = filterOverviewCards(testCards, localCaps);
		expect(filtered[0].tooltip).toBe("Consecutive calendar days with at least one play (local timezone)");
	});

	it("shows Listening Days tooltip for stats.fm provider", async () => {
		const { filterOverviewCards } = await import("../app/components/OverviewCards");
		const testCards = [
			{
				label: "Listening Days",
				value: "12",
				tooltip: "Number of days with at least one play in the selected period",
			},
		];
		const filtered = filterOverviewCards(testCards, statsfmFreeCaps);
		expect(filtered[0].tooltip).toBe("Number of days with at least one play in the selected period");
	});

	it("renders stat grid cards for stats.fm provider plus hero cell", async () => {
		// stats.fm tiles omit streak/skip-rate; with newArtistCount we still expect hero + several cards
		setActiveProvider("statsfm");
		const OverviewSection = (await import("../app/components/OverviewSection")).default;
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(OverviewSection, {
				stats: { ...baseStats, listeningDays: 10, newArtistCount: 5 },
				activePeriod: LOCAL_PERIODS[0],
			}),
			container,
		);
		const cards = container.querySelectorAll(".overview-card");
		expect(cards.length).toBeGreaterThanOrEqual(3);
		const hero = container.querySelector(".overview-hero-cell");
		expect(hero).not.toBeNull();
	});
});

describe("RecentlyPlayedSkeleton component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders 6 items with recently-played-item wrapper", async () => {
		const { RecentlyPlayedSkeleton } = await import("../app/components/LoadingSkeleton");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(RecentlyPlayedSkeleton, null), container);
		const items = container.querySelectorAll(".recently-played-item");
		expect(items).toHaveLength(6);
	});

	it("each item has a 120x120 skeleton art div", async () => {
		const { RecentlyPlayedSkeleton } = await import("../app/components/LoadingSkeleton");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(RecentlyPlayedSkeleton, null), container);
		const arts = container.querySelectorAll(".recently-played-skeleton-art");
		expect(arts).toHaveLength(6);
		arts.forEach((art) => {
			expect(art.classList.contains("skeleton-shimmer")).toBe(true);
		});
	});

	it("each item has text and subtext skeleton lines", async () => {
		const { RecentlyPlayedSkeleton } = await import("../app/components/LoadingSkeleton");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(RecentlyPlayedSkeleton, null), container);
		const texts = container.querySelectorAll(".recently-played-skeleton-text");
		const subtexts = container.querySelectorAll(".recently-played-skeleton-subtext");
		expect(texts).toHaveLength(6);
		expect(subtexts).toHaveLength(6);
	});

	it("renders inside a recently-played container with aria-hidden", async () => {
		const { RecentlyPlayedSkeleton } = await import("../app/components/LoadingSkeleton");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(RecentlyPlayedSkeleton, null), container);
		const wrapper = container.querySelector(".recently-played");
		expect(wrapper).not.toBeNull();
		expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
	});
});

describe("OverviewSection component", () => {
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

	it("renders stat tiles and hero cell in overview grid", async () => {
		// Without newArtistCount, six catalog tiles stay visible
		setActiveProvider("local");
		const OverviewSection = (await import("../app/components/OverviewSection")).default;
		const stats = {
			topTracks: [],
			topArtists: [],
			topAlbums: [],
			topGenres: [],
			totalPlays: 100,
			totalDuration: 7_200_000, // 2 hours
			recentPlays: [],
			hourlyDistribution: Array(24).fill(0),
			peakHour: 14,
			skipRate: 0.1,
			uniqueTrackCount: 50,
			uniqueArtistCount: 20,
		};
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(OverviewSection, {
				stats,
				activePeriod: LOCAL_PERIODS[0],
			}),
			container,
		);
		const cards = container.querySelectorAll(".overview-card");
		expect(cards.length).toBeGreaterThanOrEqual(4);
		const hero = container.querySelector(".overview-hero-cell");
		expect(hero).not.toBeNull();
	});

	it("renders hero with data-testid hour/minute spans", async () => {
		// Animated counter exposes hero-hours / minute spans for tests
		setActiveProvider("local");
		const OverviewSection = (await import("../app/components/OverviewSection")).default;
		const stats = {
			topTracks: [],
			topArtists: [],
			topAlbums: [],
			topGenres: [],
			totalPlays: 50,
			totalDuration: 3_600_000, // 1 hour
			recentPlays: [],
			hourlyDistribution: Array(24).fill(0),
			peakHour: 0,
			skipRate: 0,
			uniqueTrackCount: 30,
			uniqueArtistCount: 15,
		};
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(OverviewSection, {
				stats,
				activePeriod: LOCAL_PERIODS[0],
			}),
			container,
		);
		expect(container.querySelector(".overview-hero-cell")?.textContent).toContain("Total time");
		// The "h" unit is present in the hero
		expect(container.textContent).toContain("h");
		// data-testid="hero-hours" is present
		expect(container.querySelector('[data-testid="hero-hours"]')).not.toBeNull();
	});

	it("renders skip rate as percentage (local provider stat grid)", async () => {
		setActiveProvider("local");
		const OverviewSection = (await import("../app/components/OverviewSection")).default;
		const stats = {
			topTracks: [],
			topArtists: [],
			topAlbums: [],
			topGenres: [],
			totalPlays: 100,
			totalDuration: 1_800_000,
			recentPlays: [],
			hourlyDistribution: Array(24).fill(0),
			peakHour: 8,
			skipRate: 0.25,
			uniqueTrackCount: 80,
			uniqueArtistCount: 30,
		};
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(OverviewSection, {
				stats,
				activePeriod: LOCAL_PERIODS[0],
			}),
			container,
		);
		// Skip Rate is in stat grid for local provider
		expect(container.textContent).toContain("25%");
	});
});
