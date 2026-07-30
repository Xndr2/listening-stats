import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RecentlyPlayed } from "../app/components/RecentlyPlayed";
import { getRankClass } from "../app/components/TopLists";
import type { RecentPlay } from "../shared/types/stats";

afterEach(() => {
	cleanup();
	localStorage.clear();
});

// ─── getRankClass ─────────────────────────────────────────────────────────────

describe("getRankClass", () => {
	it("returns rank-gold for rank 1", () => {
		expect(getRankClass(1)).toBe("rank-gold");
	});
	it("returns rank-silver for rank 2", () => {
		expect(getRankClass(2)).toBe("rank-silver");
	});
	it("returns rank-bronze for rank 3", () => {
		expect(getRankClass(3)).toBe("rank-bronze");
	});
	it("returns empty string for rank 4+", () => {
		expect(getRankClass(4)).toBe("");
		expect(getRankClass(10)).toBe("");
	});
});

// ─── RecentlyPlayed ───────────────────────────────────────────────────────────

describe("RecentlyPlayed", () => {
	const makePlay = (i: number): RecentPlay => ({
		trackUri: `spotify:track:track${i}`,
		trackName: `Track ${i}`,
		artistName: `Artist ${i}`,
		playedAt: Date.now() - i * 60_000,
	});

	it("renders up to 12 recent plays", () => {
		const plays = Array.from({ length: 12 }, (_, i) => makePlay(i));
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		// Each play item is a direct child of .recently-played
		const wrapper = container.querySelector(".recently-played");
		expect(wrapper).not.toBeNull();
		expect(wrapper?.children).toHaveLength(12);
	});

	it("renders fewer items when fewer plays are provided", () => {
		const plays = Array.from({ length: 3 }, (_, i) => makePlay(i));
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		const wrapper = container.querySelector(".recently-played");
		expect(wrapper?.children).toHaveLength(3);
	});

	it("shows section header", () => {
		const { getByText } = render(React.createElement(RecentlyPlayed, { recentPlays: [] }));
		expect(getByText("Recently Played")).not.toBeNull();
	});

	it("renders album art img when albumArt is provided", () => {
		const plays: RecentPlay[] = [
			{
				trackUri: "spotify:track:abc",
				trackName: "My Track",
				artistName: "My Artist",
				albumArt: "https://example.com/art.jpg",
				playedAt: Date.now(),
			},
		];
		const { container } = render(React.createElement(RecentlyPlayed, { recentPlays: plays }));
		const img = container.querySelector("img");
		expect(img).not.toBeNull();
		expect(img?.src).toBe("https://example.com/art.jpg");
	});
});
