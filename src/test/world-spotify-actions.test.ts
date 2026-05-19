import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldTrack } from "../shared/types/world-charts";

vi.mock("../shared/api/cosmos-async", () => ({
	cosmosGet: vi.fn(),
}));

import {
	enrichTracksWithSpotifyIds,
	navigateWorldItem,
	playOrOpenWorldTrack,
	playWorldTrack,
	spotifyTrackUri,
} from "../app/world-spotify-actions";
import { cosmosGet } from "../shared/api/cosmos-async";

const cosmosGetMock = vi.mocked(cosmosGet);

describe("world-spotify-actions", () => {
	beforeEach(() => {
		vi.mocked(Spicetify.Platform.History.push).mockClear();
		cosmosGetMock.mockReset();
	});

	it("spotifyTrackUri builds uri", () => {
		expect(spotifyTrackUri("abc")).toBe("spotify:track:abc");
	});

	it("playWorldTrack calls Player.playUri", () => {
		const playUri = vi.fn();
		(Spicetify.Player as { playUri?: (uri: string) => void }).playUri = playUri;
		const item: WorldTrack = {
			id: "t1",
			title: "Song",
			artist: "Artist",
			country: "GL",
			plays: "1M",
			delta: null,
			spotifyTrackId: "abc123",
		};
		expect(playWorldTrack(item)).toBe(true);
		expect(playUri).toHaveBeenCalledWith("spotify:track:abc123");
	});

	it("enrichTracksWithSpotifyIds resolves via relaxed Spotify search", async () => {
		cosmosGetMock.mockResolvedValue({
			ok: true,
			data: {
				tracks: {
					items: [
						{
							id: "spotify-swim",
							name: "SWIM",
							artists: [{ name: "BTS" }],
						},
					],
				},
			},
		});
		const tracks: WorldTrack[] = [
			{
				id: "1",
				title: "SWIM",
				artist: "BTS",
				country: "GL",
				plays: "1M",
				delta: null,
				statsFmTrackId: 351284082,
			},
		];
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ item: { externalIds: { spotify: [] } } }),
		}) as typeof fetch;

		const enriched = await enrichTracksWithSpotifyIds(tracks, { max: 1 });
		expect(enriched[0].spotifyTrackId).toBe("spotify-swim");
	});

	it("playOrOpenWorldTrack navigates to search when no Spotify id", () => {
		const item: WorldTrack = {
			id: "t1",
			title: "SWIM",
			artist: "BTS",
			country: "GL",
			plays: "1M",
			delta: null,
		};
		playOrOpenWorldTrack(item);
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith("/search/SWIM%20BTS");
	});

	it("navigateWorldItem opens track page via uri", () => {
		const item: WorldTrack = {
			id: "t1",
			title: "Song",
			artist: "Artist",
			country: "GL",
			plays: "1M",
			delta: null,
			spotifyTrackId: "abc123",
		};
		navigateWorldItem(item, "track");
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith("/track/abc123");
	});
});
