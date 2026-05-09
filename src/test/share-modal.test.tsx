import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerRegistry } from "../shared/stats/provider";
import { localProvider } from "../shared/stats/local-provider";
import { statsfmProvider } from "../shared/stats/statsfm-provider";
import type { Period, StatsResult } from "../shared/types/stats";

const mockStats: StatsResult = {
	topTracks: Array.from({ length: 5 }, (_, i) => ({
		rank: i + 1,
		trackUri: `spotify:track:${i + 1}`,
		trackName: `Track ${i + 1}`,
		artistName: "Artist",
		artistUri: "spotify:artist:1",
		albumName: "Album",
		albumUri: "spotify:album:1",
		albumArt: null,
		count: 100 - i,
		durationMs: 180000,
	})),
	topArtists: [{ rank: 1, artistUri: "spotify:artist:1", artistName: "Artist", count: 100, durationMs: 1000000, genres: ["indie"], imageUrl: null }],
	topAlbums: [],
	topGenres: [{ rank: 1, genre: "indie", count: 100 }],
	totalPlays: 1000,
	totalDuration: 10_000_000,
	recentPlays: [],
	hourlyDistribution: Array(24).fill(10),
	peakHour: 10,
	skipRate: 0.1,
	uniqueTrackCount: 100,
	uniqueArtistCount: 50,
	streak: 7,
	listeningDays: 20,
	weekdayDistribution: [1, 2, 3, 4, 5, 6, 7],
	peakWeekday: 6,
	dailyPlayCounts: [],
};

const mockPeriod: Period = {
	id: "this-month",
	label: "This Month",
	getBoundaries: () => ({ start: Date.now() - 86400000, end: Date.now() }),
};

async function renderShareModal() {
	const { ShareModal } = await import("../app/components/ShareModal");
	const container = document.createElement("div");
	document.body.appendChild(container);
	const onClose = vi.fn();
	Spicetify.ReactDOM.render(
		Spicetify.React.createElement(ShareModal, { stats: mockStats, activePeriod: mockPeriod, onClose }),
		container,
	);
	return { container, onClose };
}

describe("ShareModal", () => {
	beforeEach(() => {
		localStorage.clear();
		providerRegistry._resetForTesting();
		providerRegistry.register(localProvider);
		providerRegistry.register(statsfmProvider);
		providerRegistry.setActive("local");
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			fillRect: vi.fn(),
			fillText: vi.fn(),
			beginPath: vi.fn(),
			closePath: vi.fn(),
			moveTo: vi.fn(),
			arcTo: vi.fn(),
			fill: vi.fn(),
			stroke: vi.fn(),
			clip: vi.fn(),
			save: vi.fn(),
			restore: vi.fn(),
			drawImage: vi.fn(),
			measureText: vi.fn(() => ({ width: 50 })),
			createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
			createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
			arc: vi.fn(),
			textAlign: "left",
			textBaseline: "alphabetic",
			fillStyle: "",
			font: "",
			lineWidth: 1,
		} as unknown as CanvasRenderingContext2D);
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback) {
			cb(new Blob(["fake"], { type: "image/png" }));
		});
	});

	afterEach(() => {
		document.querySelectorAll(".share-overlay").forEach((el) => el.remove());
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("renders modal chrome and action buttons", async () => {
		const { container } = await renderShareModal();
		expect(document.querySelector(".share-modal")).toBeTruthy();
		expect(document.querySelector("[data-testid='share-copy-btn']")?.textContent).toContain("Copy image");
		expect(document.querySelector("[data-testid='share-download-btn']")?.textContent).toContain("Save PNG");
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		container.remove();
	});

	it("renders preview image from export pipeline", async () => {
		const { container } = await renderShareModal();
		await vi.waitFor(() => {
			expect(document.querySelector("[data-testid='share-card-preview-image']")).toBeTruthy();
		});
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		container.remove();
	});

	it("shows follow theme toggle", async () => {
		const { container } = await renderShareModal();
		const toggle = document.querySelector<HTMLInputElement>(".share-toggle-row input[type='checkbox']");
		expect(toggle).toBeTruthy();
		expect(toggle?.checked).toBe(false);
		toggle?.click();
		expect(toggle?.checked).toBe(true);
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		container.remove();
	});

	it("hides streak variant for statsfm provider", async () => {
		providerRegistry.setActive("statsfm");
		const { container } = await renderShareModal();
		const labels = Array.from(document.querySelectorAll(".share-variant-tab")).map((t) => t.textContent?.trim());
		expect(labels).not.toContain("Streak");
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		container.remove();
	});
});
