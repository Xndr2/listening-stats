import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, fireEvent } from "@testing-library/react";
import React from "react";

describe("Genre filter pill preferences", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("activeGenre defaults to null on fresh install", async () => {
		const { getPreferences } = await import("../app/preferences");
		const prefs = getPreferences();
		expect(prefs.activeGenre).toBe(null);
	});

	it("activeGenre round-trips through setPreference", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activeGenre", "indie folk");
		expect(getPreferences().activeGenre).toBe("indie folk");
	});

	it("activeGenre can be cleared by setting to null", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activeGenre", "rock");
		setPreference("activeGenre", null);
		expect(getPreferences().activeGenre).toBe(null);
	});

	it("activeGenre survives alongside other preferences", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activeGenre", "jazz");
		setPreference("use24HourTime", true);
		const prefs = getPreferences();
		expect(prefs.activeGenre).toBe("jazz");
		expect(prefs.use24HourTime).toBe(true);
	});

	it("pre-Phase-36 stored prefs without activeGenre get null default", async () => {
		localStorage.setItem(
			"listening-stats:preferences",
			JSON.stringify({ use24HourTime: true, itemsPerSection: 10 }),
		);
		const { getPreferences } = await import("../app/preferences");
		expect(getPreferences().activeGenre).toBe(null);
	});
});

describe("Genre filter FilterPill component", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders nothing when activeGenre is null", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		const { container } = render(
			React.createElement(FilterPill, { activeGenre: null, onClear: () => {} }),
		);
		expect(container.querySelector(".filter-pill")).toBeNull();
	});

	it("renders pill with genre name when activeGenre is set", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		const { container } = render(
			React.createElement(FilterPill, { activeGenre: "indie folk", onClear: () => {} }),
		);
		const pill = container.querySelector(".filter-pill");
		expect(pill).not.toBeNull();
		expect(pill?.textContent).toContain("Filtering by");
		expect(pill?.textContent).toContain("indie folk");
	});

	it("renders filter icon inside pill", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		const { container } = render(
			React.createElement(FilterPill, { activeGenre: "rock", onClear: () => {} }),
		);
		const icon = container.querySelector(".filter-pill-icon");
		expect(icon).not.toBeNull();
	});

	it("renders dismiss button with × inside pill", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		const { container } = render(
			React.createElement(FilterPill, { activeGenre: "rock", onClear: () => {} }),
		);
		const btn = container.querySelector(".filter-pill-close");
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toBe("×");
	});

	it("clicking dismiss button calls onClear", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		let cleared = false;
		const { container } = render(
			React.createElement(FilterPill, {
				activeGenre: "rock",
				onClear: () => { cleared = true; },
			}),
		);
		const btn = container.querySelector(".filter-pill-close") as HTMLButtonElement;
		fireEvent.click(btn);
		expect(cleared).toBe(true);
	});

	it("replaces displayed genre when activeGenre prop changes", async () => {
		const { FilterPill } = await import("../app/components/FilterPill");
		const { container, rerender } = render(
			React.createElement(FilterPill, { activeGenre: "rock", onClear: () => {} }),
		);
		expect(container.querySelector(".filter-pill")?.textContent).toContain("rock");
		rerender(
			React.createElement(FilterPill, { activeGenre: "jazz", onClear: () => {} }),
		);
		expect(container.querySelector(".filter-pill")?.textContent).toContain("jazz");
		expect(container.querySelector(".filter-pill")?.textContent).not.toContain("rock");
	});
});

describe("Genre filter TopGenres wiring", () => {
	afterEach(() => {
		cleanup();
	});

	it("clicking a genre name in TopGenres calls onGenreClick with genre string", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		let clicked = "";
		const { container } = render(
			React.createElement(TopGenres, {
				topGenres: [
					{ rank: 1, genre: "pop", count: 100 },
					{ rank: 2, genre: "rock", count: 50 },
				],
				onGenreClick: (g: string) => { clicked = g; },
				activeGenre: null,
			}),
		);
		const nameBtn = container.querySelector(".top-genres-name") as HTMLButtonElement;
		fireEvent.click(nameBtn);
		expect(clicked).toBe("pop");
	});

	it("clicking a different genre replaces the callback argument (no accumulation)", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		const clicks: string[] = [];
		const { container } = render(
			React.createElement(TopGenres, {
				topGenres: [
					{ rank: 1, genre: "pop", count: 100 },
					{ rank: 2, genre: "rock", count: 50 },
				],
				onGenreClick: (g: string) => { clicks.push(g); },
				activeGenre: null,
			}),
		);
		const btns = container.querySelectorAll(".top-genres-name");
		fireEvent.click(btns[0] as HTMLElement);
		fireEvent.click(btns[1] as HTMLElement);
		expect(clicks).toEqual(["pop", "rock"]);
	});
});

describe("Genre filter clears on provider switch", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("PROVIDER_CHANGED event should clear activeGenre in preferences", async () => {
		const { getPreferences, setPreference } = await import("../app/preferences");
		setPreference("activeGenre", "rock");
		expect(getPreferences().activeGenre).toBe("rock");

		// The App component listens for PROVIDER_CHANGED and clears activeGenre.
		// Here we test the preference clearing function directly.
		const { clearActiveGenre } = await import("../app/components/FilterPill");
		clearActiveGenre();
		expect(getPreferences().activeGenre).toBe(null);
	});
});

describe("FilterIcon export", () => {
	it("FilterIcon is a non-empty SVG string", async () => {
		const { FilterIcon } = await import("../app/icons");
		expect(typeof FilterIcon).toBe("string");
		expect(FilterIcon).toContain("<svg");
		expect(FilterIcon).toContain("</svg>");
	});
});
