import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDuration } from "../app/format";
import type { StatsResult, TopArtist, TopTrack } from "../shared/types/stats";

function makeTrack(overrides: Partial<TopTrack> = {}): TopTrack {
	return {
		rank: 1,
		trackUri: "spotify:track:T1",
		trackName: "Track 1",
		artistName: "Artist 1",
		artistUri: "spotify:artist:A1",
		albumName: "Album 1",
		albumUri: "spotify:album:AL1",
		albumArt: undefined,
		count: 10,
		durationMs: 200000,
		...overrides,
	};
}

function makeArtist(overrides: Partial<TopArtist> = {}): TopArtist {
	return {
		rank: 1,
		artistUri: "spotify:artist:A1",
		artistName: "Artist 1",
		count: 10,
		durationMs: 200000,
		genres: [],
		imageUrl: null,
		...overrides,
	};
}

function makeStats(overrides: Partial<StatsResult> = {}): StatsResult {
	return {
		topTracks: [],
		topArtists: [],
		topAlbums: [],
		topGenres: [],
		totalPlays: 0,
		totalDuration: 0,
		recentPlays: [],
		hourlyDistribution: Array(24).fill(0),
		peakHour: 0,
		skipRate: 0,
		uniqueTrackCount: 0,
		uniqueArtistCount: 0,
		...overrides,
	};
}

function findSectionCardByColumnId(container: HTMLElement, columnId: string): Element | null {
	return container.querySelector(`[data-column-id="${columnId}"]`);
}

describe("TopLists row layout and inline genre", () => {
	beforeEach(() => {
		cleanup();
		vi.mocked(Spicetify.CosmosAsync.get).mockClear();
	});

	it("artist row with genres renders inline-genre span (role=button) for genres[0] only", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topArtists: [makeArtist({ genres: ["rock", "pop"] })],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const artistsCard = findSectionCardByColumnId(container as HTMLElement, "top-artists");
		expect(artistsCard).not.toBeNull();
		const row = artistsCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		// The row container itself is a <div role="button">. The inline-genre is a
		// <span role="button"> nested in the meta row. Use the more specific selector.
		const genreSpans = row?.querySelectorAll('span[role="button"]');
		expect(genreSpans?.length).toBe(1);
		expect(genreSpans?.[0]?.textContent).toBe("rock");
		// genres[1] ("pop") MUST NOT appear in the row (only primary genre is rendered).
		expect(row?.textContent ?? "").not.toContain("pop");
	});

	it("artist row with undefined genres renders zero inline-genre spans", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topArtists: [makeArtist({ genres: undefined })],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const artistsCard = findSectionCardByColumnId(container as HTMLElement, "top-artists");
		const row = artistsCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		// No inline-genre <span role="button"> anywhere in the row.
		expect(row?.querySelectorAll('span[role="button"]').length).toBe(0);
		// Meta shows plays without the genre separator dot when no primary genre
		const text = row?.textContent ?? "";
		expect(text).toContain("plays");
		expect(text).not.toContain("·");
	});

	it("artist row with empty [] genres renders zero inline-genre spans", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topArtists: [makeArtist({ genres: [] })],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const artistsCard = findSectionCardByColumnId(container as HTMLElement, "top-artists");
		const row = artistsCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		expect(row?.querySelectorAll('span[role="button"]').length).toBe(0);
		const text = row?.textContent ?? "";
		expect(text).toContain("plays");
		expect(text).not.toContain("·");
	});

	it("artist row with 5 genres renders exactly one inline-genre span (first genre only)", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topArtists: [makeArtist({ genres: ["a", "b", "c", "d", "e"] })],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const artistsCard = findSectionCardByColumnId(container as HTMLElement, "top-artists");
		const row = artistsCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		const genreSpans = row?.querySelectorAll('span[role="button"]');
		expect(genreSpans?.length).toBe(1);
		expect(genreSpans?.[0]?.textContent).toBe("a");
		// Other genres MUST NOT appear in the row text.
		const text = row?.textContent ?? "";
		expect(text).not.toContain("b");
		expect(text).not.toContain("c");
		expect(text).not.toContain("d");
		expect(text).not.toContain("e");
	});

	it("track row renders no inline-genre span", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topTracks: [
				makeTrack({
					trackUri: "spotify:track:T1",
					artistUri: "spotify:artist:A1",
				}),
			],
			topArtists: [
				makeArtist({
					artistUri: "spotify:artist:A1",
					genres: ["jazz", "funk"],
				}),
			],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const tracksCard = findSectionCardByColumnId(container as HTMLElement, "top-tracks");
		expect(tracksCard).not.toBeNull();
		// No inline-genre spans on track rows (the row container is a <div role=button>,
		// not a <span role=button>).
		const row = tracksCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		expect(row?.querySelectorAll('span[role="button"]').length).toBe(0);
	});

	it("track row whose matching artist has no genres still renders zero inline-genre spans", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topTracks: [
				makeTrack({
					trackUri: "spotify:track:T1",
					artistUri: "spotify:artist:A1",
				}),
			],
			topArtists: [
				makeArtist({
					artistUri: "spotify:artist:A1",
					genres: undefined,
				}),
			],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const tracksCard = findSectionCardByColumnId(container as HTMLElement, "top-tracks");
		const row = tracksCard?.querySelector(".top-list-row");
		expect(row?.querySelectorAll('span[role="button"]').length).toBe(0);
	});

	it("track row right cluster renders formatted duration", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topTracks: [
				makeTrack({
					trackUri: "spotify:track:T1",
					durationMs: 200000,
				}),
			],
		});
		const { container } = render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		const tracksCard = findSectionCardByColumnId(container as HTMLElement, "top-tracks");
		expect(tracksCard).not.toBeNull();
		const row = tracksCard?.querySelector(".top-list-row");
		expect(row).not.toBeNull();
		// Duration string comes from the same formatter the component uses.
		const expectedDuration = formatDuration(200000);
		expect(row?.textContent ?? "").toContain(expectedDuration);
	});

	it("rendering TopLists with stats does not call Spicetify.CosmosAsync.get", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topTracks: [
				makeTrack({
					trackUri: "spotify:track:T1",
					artistUri: "spotify:artist:A1",
				}),
			],
			topArtists: [
				makeArtist({
					artistUri: "spotify:artist:A1",
					genres: ["jazz", "funk"],
				}),
			],
		});
		render(
			React.createElement(TopLists, {
				stats,
				loading: false,
				hiddenSections: [],
			}),
		);
		expect(vi.mocked(Spicetify.CosmosAsync.get).mock.calls.length).toBe(0);
	});
});

describe("TopLists section headings", () => {
	beforeEach(() => {
		cleanup();
		vi.mocked(Spicetify.CosmosAsync.get).mockClear();
	});

	it("Tracks column renders section-heading with kicker 'Most played' and title 'Tracks'", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({ topTracks: [makeTrack()] });
		const { container } = render(
			React.createElement(TopLists, { stats, loading: false, hiddenSections: [] }),
		);
		const tracksCard = container.querySelector('[data-column-id="top-tracks"]');
		expect(tracksCard).not.toBeNull();
		const heading = tracksCard?.querySelector(".section-heading");
		expect(heading).not.toBeNull();
		expect(heading?.querySelector(".section-kicker")?.textContent).toBe("Most played");
		expect(heading?.querySelector(".section-title")?.textContent).toBe("Tracks");
	});

	it("Artists column renders section-heading with kicker 'Top' and title 'Artists'", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({ topArtists: [makeArtist()] });
		const { container } = render(
			React.createElement(TopLists, { stats, loading: false, hiddenSections: [] }),
		);
		const artistsCard = container.querySelector('[data-column-id="top-artists"]');
		expect(artistsCard).not.toBeNull();
		const heading = artistsCard?.querySelector(".section-heading");
		expect(heading).not.toBeNull();
		expect(heading?.querySelector(".section-kicker")?.textContent).toBe("Top");
		expect(heading?.querySelector(".section-title")?.textContent).toBe("Artists");
	});

	it("Albums column renders section-heading with kicker 'Top' and title 'Albums'", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const stats = makeStats({
			topAlbums: [
				{
					rank: 1,
					albumUri: "spotify:album:AL1",
					albumName: "Album 1",
					artistName: "Artist 1",
					albumArt: undefined,
					count: 10,
					durationMs: 200000,
				},
			],
		});
		const { container } = render(
			React.createElement(TopLists, { stats, loading: false, hiddenSections: [] }),
		);
		const albumsCard = container.querySelector('[data-column-id="top-albums"]');
		expect(albumsCard).not.toBeNull();
		const heading = albumsCard?.querySelector(".section-heading");
		expect(heading).not.toBeNull();
		expect(heading?.querySelector(".section-kicker")?.textContent).toBe("Top");
		expect(heading?.querySelector(".section-title")?.textContent).toBe("Albums");
	});
});

describe("TopLists columnOrder and per-column hide", () => {
	beforeEach(() => {
		cleanup();
		localStorage.clear();
		vi.mocked(Spicetify.CosmosAsync.get).mockClear();
	});

	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it("renders 3 columns in default columnOrder when no fine hidden ids set", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const { container } = render(
			React.createElement(TopLists, {
				stats: makeStats(),
				loading: false,
				hiddenSections: [],
			}),
		);
		const columns = container.querySelectorAll("[data-column-id]");
		expect(columns.length).toBe(3);
		const ids = Array.from(columns).map((c) => c.getAttribute("data-column-id"));
		expect(ids).toEqual(["top-tracks", "top-artists", "top-albums"]);
	});

	it("renders columns in custom columnOrder  -  reversed order", async () => {
		const { setPreference } = await import("../app/preferences");
		const { TopLists } = await import("../app/components/TopLists");

		setPreference("columnOrder", ["top-albums", "top-artists", "top-tracks"]);

		const { container } = render(
			React.createElement(TopLists, {
				stats: makeStats(),
				loading: false,
				hiddenSections: [],
			}),
		);
		const columns = container.querySelectorAll("[data-column-id]");
		expect(columns.length).toBe(3);
		const ids = Array.from(columns).map((c) => c.getAttribute("data-column-id"));
		expect(ids).toEqual(["top-albums", "top-artists", "top-tracks"]);
	});

	it("filters out fine-hidden ids  -  hiddenSections=['top-tracks'] removes Top Tracks column", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const { container } = render(
			React.createElement(TopLists, {
				stats: makeStats(),
				loading: false,
				hiddenSections: ["top-tracks"],
			}),
		);
		const columns = container.querySelectorAll("[data-column-id]");
		expect(columns.length).toBe(2);
		const ids = Array.from(columns).map((c) => c.getAttribute("data-column-id"));
		expect(ids).not.toContain("top-tracks");
		expect(ids).toContain("top-artists");
		expect(ids).toContain("top-albums");
	});

	it("returns null when all 3 fine ids hidden  -  preserves Decision 9 behavior", async () => {
		const { TopLists } = await import("../app/components/TopLists");
		const { container } = render(
			React.createElement(TopLists, {
				stats: makeStats(),
				loading: false,
				hiddenSections: ["top-tracks", "top-artists", "top-albums"],
			}),
		);
		// When component returns null, nothing is rendered
		expect(container.firstChild).toBeNull();
	});
});
