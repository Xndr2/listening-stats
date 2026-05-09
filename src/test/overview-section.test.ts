import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { LOCAL_PERIODS } from "../shared/stats/periods";
import { setPreference } from "../app/preferences";
import { providerRegistry } from "../shared/stats/provider";
import { localProvider } from "../shared/stats/local-provider";
import { statsfmProvider } from "../shared/stats/statsfm-provider";
import type { StatsResult, Period } from "../shared/types/stats";

// Minimal StatsResult fixture; tests override optional prior-period fields as needed.
const baseStats: StatsResult = {
  topTracks: [],
  topArtists: [],
  topAlbums: [],
  topGenres: [],
  totalPlays: 100,
  totalDuration: 7_200_000, // 2h
  recentPlays: [],
  hourlyDistribution: Array(24).fill(0),
  peakHour: 14,
  skipRate: 0.1,
  uniqueTrackCount: 50,
  uniqueArtistCount: 20,
};

const mockPeriods: Period[] = [
  { id: "today", label: "Today", getBoundaries: () => ({ start: 0, end: Date.now() }) } as unknown as Period,
  { id: "week", label: "This Week", getBoundaries: () => ({ start: 0, end: Date.now() }) } as unknown as Period,
];

function setActiveProvider(id: "local" | "statsfm"): void {
  providerRegistry._resetForTesting();
  providerRegistry.register(localProvider);
  providerRegistry.register(statsfmProvider);
  providerRegistry.setActive(id);
}

function renderOverview(stats: StatsResult, activePeriod: Period = mockPeriods[0]) {
  // Returns a function that, when called, renders OverviewSection into the
  // shared `container` (set up in each describe's beforeEach).
  return async (container: HTMLElement) => {
    const OverviewSection = (await import("../app/components/OverviewSection")).default;
    Spicetify.ReactDOM.render(
      Spicetify.React.createElement(OverviewSection, { stats, activePeriod }),
      container,
    );
  };
}

describe("OverviewSection hero structure", () => {
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

  it("renders .overview-section wrapper", async () => {
    await renderOverview(baseStats)(container);
    expect(container.querySelector(".overview-section")).not.toBeNull();
  });

  it("renders .overview-hero-cell (replaces legacy .overview-hero)", async () => {
    await renderOverview(baseStats)(container);
    expect(container.querySelector(".overview-hero-cell")).not.toBeNull();
    // Legacy class no longer present
    expect(container.querySelector(".overview-hero")).toBeNull();
  });

  it("kicker contains 'Total time · {periodLabel}'", async () => {
    await renderOverview(baseStats, mockPeriods[1])(container);
    const heroCell = container.querySelector(".overview-hero-cell");
    expect(heroCell?.textContent).toContain("Total time");
    expect(heroCell?.textContent).toContain("This Week");
  });

  it("renders hero-hours and hero-minutes spans", async () => {
    await renderOverview(baseStats)(container);
    expect(container.querySelector('[data-testid="hero-hours"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hero-minutes"]')).not.toBeNull();
  });

  it("renders hero-sublabel with formatted plays + artists", async () => {
    await renderOverview({ ...baseStats, totalPlays: 100, uniqueArtistCount: 20 })(container);
    const sublabel = container.querySelector('[data-testid="hero-sublabel"]');
    expect(sublabel).not.toBeNull();
    expect(sublabel?.textContent).toContain("plays");
    expect(sublabel?.textContent).toContain("artists");
  });

  it("delta indicator IS rendered when priorPeriodTotalDuration > 0", async () => {
    await renderOverview({
      ...baseStats,
      totalDuration: 8_000_000,
      priorPeriodTotalDuration: 6_000_000,
    })(container);
    const delta = container.querySelector('[data-testid="hero-delta"]');
    expect(delta).not.toBeNull();
    expect(delta?.textContent).toContain("vs prev");
  });

  it("delta indicator is NOT rendered when priorPeriodTotalDuration is undefined", async () => {
    await renderOverview(baseStats)(container);
    expect(container.querySelector('[data-testid="hero-delta"]')).toBeNull();
  });

  it("delta indicator is NOT rendered when priorPeriodTotalDuration === 0", async () => {
    await renderOverview({ ...baseStats, priorPeriodTotalDuration: 0 })(container);
    expect(container.querySelector('[data-testid="hero-delta"]')).toBeNull();
  });
});

describe("OverviewSection hero RAF counter", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    localStorage.clear();
    providerRegistry._resetForTesting();
    setActiveProvider("local");
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });

  afterEach(() => {
    Spicetify.ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
    localStorage.clear();
    vi.useRealTimers();
  });

  it("with reduced-motion OFF, hero-hours animates from 0 toward final over ~900ms", async () => {
    // Default matchMedia stub returns matches: false (no reduced motion).
    // Wrap initial render in act() to ensure the useEffect (which schedules the first RAF) runs.
    await act(async () => {
      await renderOverview({ ...baseStats, totalDuration: 3_600_000 })(container); // 1h target
    });
    const hoursSpan = container.querySelector('[data-testid="hero-hours"]');
    expect(hoursSpan).not.toBeNull();
    // Initial frame: hours stay at 0 until RAF advances
    expect(hoursSpan?.textContent).toBe("0");
    // Advance past the 900ms animation window; act() flushes React state updates from RAF setVal() calls
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // Counter reaches final value for a one-hour total
    const finalHours = container.querySelector('[data-testid="hero-hours"]')?.textContent;
    expect(finalHours).toBe("1");
  });

  it("with reduced-motion ON, hero-hours immediately equals final value (no animation)", async () => {
    // Override matchMedia to return matches: true
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    );
    await renderOverview({ ...baseStats, totalDuration: 3_600_000 })(container); // 1h
    // Reduced-motion: snap to final immediately, no rAF advance needed
    const hoursSpan = container.querySelector('[data-testid="hero-hours"]');
    expect(hoursSpan?.textContent).toBe("1");
  });

  it("period change re-render drives counter to new period final value (cleanup + restart verified)", async () => {
    // Render first period (one hour of listening)
    await act(async () => {
      await renderOverview({ ...baseStats, totalDuration: 3_600_000 }, mockPeriods[0])(container);
    });
    // Full animation for period[0] completes: hours = 1.
    expect(container.querySelector('[data-testid="hero-hours"]')?.textContent).toBe("1");

    // Switch period to two hours of listening
    await act(async () => {
      await renderOverview({ ...baseStats, totalDuration: 7_200_000 }, mockPeriods[1])(container);
    });
    expect(container.querySelector('[data-testid="hero-hours"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="hero-minutes"]')?.textContent).toBe("00");
  });

  it("unmount cancels in-flight RAF (no errors after timer advance past 900ms)", async () => {
    await renderOverview({ ...baseStats, totalDuration: 3_600_000 })(container);
    // Unmount mid-animation
    act(() => {
      Spicetify.ReactDOM.unmountComponentAtNode(container);
    });
    // Advance timers; if cancelAnimationFrame failed to fire, the RAF callback
    // would attempt to call setVal on an unmounted component (warning/error).
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1500);
      });
    }).not.toThrow();
  });
});

describe("OverviewSection grid topology", () => {
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

  it("outer wrapper has class .overview-section", async () => {
    await renderOverview(baseStats)(container);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).classList.contains("overview-section")).toBe(true);
  });

  it("hero is rendered inside .overview-hero-cell", async () => {
    await renderOverview(baseStats)(container);
    const heroCell = container.querySelector(".overview-hero-cell");
    expect(heroCell?.querySelector('[data-testid="hero-hours"]')).not.toBeNull();
  });

  it("renders .overview-right-block containing top 4 visible tiles", async () => {
    // newArtistCount provided → all 7 IDs visible → top4 = first 4 = tracks/unique-artists/streak/new-artists
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    const rightBlock = container.querySelector(".overview-right-block");
    expect(rightBlock).not.toBeNull();
    const cards = rightBlock!.querySelectorAll(".overview-card");
    expect(cards.length).toBe(4);
  });

  it("renders .overview-bottom-row containing next 3 visible tiles", async () => {
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    const bottomRow = container.querySelector(".overview-bottom-row");
    expect(bottomRow).not.toBeNull();
    const cards = bottomRow!.querySelectorAll(".overview-card");
    expect(cards.length).toBe(3);
  });

  it("when newArtistCount is undefined, only 6 tiles render (4 in right block + 2 in bottom)", async () => {
    // No newArtistCount → tile filter drops "new-artists" → 6 visible
    await renderOverview({ ...baseStats, streak: 3 })(container);
    const allCards = container.querySelectorAll(".overview-card");
    expect(allCards.length).toBe(6);
    // No data-card-id="new-artists" present
    expect(container.querySelector('[data-card-id="new-artists"]')).toBeNull();
    // Right block has 4; bottom row has 2 (top4 = first 4 visible after filter)
    expect(container.querySelectorAll(".overview-right-block .overview-card").length).toBe(4);
    expect(container.querySelectorAll(".overview-bottom-row .overview-card").length).toBe(2);
  });

  it("data-card-id attributes preserved on all tiles", async () => {
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    const cards = container.querySelectorAll("[data-card-id]");
    const ids = Array.from(cards).map((c) => c.getAttribute("data-card-id"));
    expect(ids).toEqual([
      "tracks", "unique-artists", "streak", "new-artists",
      "peak-hour", "skip-rate", "est-payout",
    ]);
  });
});

describe("OverviewSection tiles by provider", () => {
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

  it("Local provider with 7 IDs and newArtistCount defined renders all 7 tiles in default order", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    const ids = Array.from(container.querySelectorAll("[data-card-id]")).map((c) => c.getAttribute("data-card-id"));
    expect(ids).toEqual([
      "tracks", "unique-artists", "streak", "new-artists",
      "peak-hour", "skip-rate", "est-payout",
    ]);
  });

  it("stats.fm provider renders top-genre in place of peak-hour, hides streak and skip-rate, tracks in hero only", async () => {
    setActiveProvider("statsfm");
    await renderOverview({
      ...baseStats,
      streak: 3,
      newArtistCount: 5,
      topGenres: [{ rank: 1, genre: "indie rock", count: 42 } as any],
    })(container);
    const ids = Array.from(container.querySelectorAll("[data-card-id]")).map((c) => c.getAttribute("data-card-id"));
    expect(ids).toEqual([
      "unique-artists", "new-artists",
      "top-genre", "est-payout",
    ]);
    expect(ids).not.toContain("tracks");
    expect(ids).not.toContain("peak-hour");
    expect(ids).not.toContain("streak");
    expect(ids).not.toContain("skip-rate");
  });

  it("stats.fm streak tile is hidden (data not available from stats.fm API)", async () => {
    setActiveProvider("statsfm");
    await renderOverview({ ...baseStats, streak: 7, newArtistCount: 5 })(container);
    expect(container.querySelector('[data-card-id="streak"]')).toBeNull();
  });

  it("stats.fm skip-rate tile is hidden (data not available from stats.fm API)", async () => {
    setActiveProvider("statsfm");
    await renderOverview({ ...baseStats, streak: 0, skipRate: 0.5, newArtistCount: 5 })(container);
    expect(container.querySelector('[data-card-id="skip-rate"]')).toBeNull();
  });

  it("Local: streak tile with stats.streak > 0 has accent color on value span", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, streak: 5, newArtistCount: 3 })(container);
    const streakCard = container.querySelector('[data-card-id="streak"]');
    const value = streakCard!.querySelector<HTMLElement>(".overview-card-value");
    expect(value).not.toBeNull();
    expect(value!.style.color).toContain("--spice-button");
  });

  it("Local: streak tile with stats.streak == 0 renders dash without accent", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, streak: 0, newArtistCount: 3 })(container);
    const streakCard = container.querySelector('[data-card-id="streak"]');
    const value = streakCard!.querySelector<HTMLElement>(".overview-card-value");
    expect(value?.textContent).toBe("-");
    // No accent inline style applied
    expect(value!.style.color === "" || !value!.style.color.includes("--spice-button")).toBe(true);
  });

  it("new-artists tile is HIDDEN when stats.newArtistCount is undefined", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, streak: 3 })(container); // newArtistCount omitted
    expect(container.querySelector('[data-card-id="new-artists"]')).toBeNull();
  });

  it("new-artists tile renders the count when stats.newArtistCount is defined", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 7 })(container);
    const newArtistsCard = container.querySelector('[data-card-id="new-artists"]');
    expect(newArtistsCard).not.toBeNull();
    const value = newArtistsCard!.querySelector(".overview-card-value");
    expect(value?.textContent).toBe("7");
  });

  it("peak-hour tile renders the formatted hour", async () => {
    setActiveProvider("local");
    await renderOverview({ ...baseStats, peakHour: 14, streak: 3, newArtistCount: 5 })(container);
    const peakHourCard = container.querySelector('[data-card-id="peak-hour"]');
    expect(peakHourCard).not.toBeNull();
    const value = peakHourCard!.querySelector(".overview-card-value")?.textContent;
    // Default prefs use 12-hour format (14 -> "2pm")
    expect(value).toBe("2pm");
  });
});

describe("OverviewSection ordering and hide prefs", () => {
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

  it("respects custom overviewOrder.local  -  cards rendered in user's stored order", async () => {
    setPreference("overviewOrder", {
      local: ["streak", "tracks", "unique-artists", "new-artists", "peak-hour", "skip-rate", "est-payout"],
      statsfm: ["top-genre", "unique-artists", "new-artists", "est-payout"],
    });
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    const ids = Array.from(container.querySelectorAll("[data-card-id]")).map((c) => c.getAttribute("data-card-id"));
    expect(ids[0]).toBe("streak");
    expect(ids[1]).toBe("tracks");
  });

  it("filters hidden card ids  -  card with id in hiddenSections is not rendered", async () => {
    setPreference("hiddenSections", ["tracks"]);
    await renderOverview({ ...baseStats, streak: 3, newArtistCount: 5 })(container);
    expect(container.querySelector('[data-card-id="tracks"]')).toBeNull();
  });

  it("hero remains visible regardless of any hiddenSections content", async () => {
    setPreference("hiddenSections", ["overview", "tracks", "streak"]);
    await renderOverview(baseStats)(container);
    expect(container.querySelector(".overview-hero-cell")).not.toBeNull();
    expect(container.querySelector('[data-testid="hero-hours"]')).not.toBeNull();
  });

  it("SFMC-01: top-genre renders topGenres[0].genre value when present (stats.fm)", async () => {
    setActiveProvider("statsfm");
    await renderOverview({
      ...baseStats,
      newArtistCount: 5,
      topGenres: [
        { rank: 1, genre: "indie rock", count: 42 } as any,
        { rank: 2, genre: "synth pop", count: 21 } as any,
      ],
    })(container);
    const card = container.querySelector('[data-card-id="top-genre"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector(".overview-card-value")?.textContent).toBe("indie rock");
  });

  it("SFMC-01: top-genre renders '-' when topGenres is empty (stats.fm)", async () => {
    setActiveProvider("statsfm");
    await renderOverview({ ...baseStats, newArtistCount: 5, topGenres: [] })(container);
    const card = container.querySelector('[data-card-id="top-genre"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector(".overview-card-value")?.textContent).toBe("-");
  });
});
