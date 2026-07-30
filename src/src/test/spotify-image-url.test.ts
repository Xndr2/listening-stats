import { describe, expect, it } from "vitest";
import { normalizeSpotifyImageUrl } from "../shared/util/spotify-image-url";

describe("normalizeSpotifyImageUrl", () => {
	it("maps spotify:image id to i.scdn.co", () => {
		expect(normalizeSpotifyImageUrl("spotify:image:ab67616d00001e024229702de91cb3d3a4383302")).toBe(
			"https://i.scdn.co/image/ab67616d00001e024229702de91cb3d3a4383302",
		);
	});

	it("is case-insensitive on the scheme", () => {
		expect(normalizeSpotifyImageUrl("Spotify:Image:abc123")).toBe("https://i.scdn.co/image/abc123");
	});

	it("passes through normal https URLs", () => {
		expect(normalizeSpotifyImageUrl("https://i.scdn.co/image/x")).toBe("https://i.scdn.co/image/x");
	});

	it("returns undefined for empty input", () => {
		expect(normalizeSpotifyImageUrl(undefined)).toBeUndefined();
		expect(normalizeSpotifyImageUrl(null)).toBeUndefined();
		expect(normalizeSpotifyImageUrl("")).toBeUndefined();
		expect(normalizeSpotifyImageUrl("   ")).toBeUndefined();
		expect(normalizeSpotifyImageUrl("spotify:image:")).toBeUndefined();
	});
});
