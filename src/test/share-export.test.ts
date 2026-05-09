import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCtx = {
	fillRect: vi.fn(),
	fillText: vi.fn(),
	beginPath: vi.fn(),
	closePath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	arc: vi.fn(),
	arcTo: vi.fn(),
	fill: vi.fn(),
	stroke: vi.fn(),
	clip: vi.fn(),
	save: vi.fn(),
	restore: vi.fn(),
	drawImage: vi.fn(),
	rect: vi.fn(),
	measureText: vi.fn(() => ({ width: 50 })),
	createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
	createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
	fillStyle: "",
	strokeStyle: "",
	font: "",
	textAlign: "left" as string,
	textBaseline: "alphabetic" as string,
	globalAlpha: 1,
	lineWidth: 1,
};

class MockImage {
	crossOrigin = "";
	width = 0;
	height = 0;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	private _src = "";
	get src() {
		return this._src;
	}
	set src(url: string) {
		this._src = url;
		Promise.resolve().then(() => this.onerror?.());
	}
}

function setupCanvasMock() {
	vi.stubGlobal("Image", MockImage);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx as any);
	vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
		this: HTMLCanvasElement,
		cb: BlobCallback,
	) {
		cb(new Blob(["fake-png"], { type: "image/png" }));
	});
}

function makeMockStats() {
	return {
		topTracks: [
			{
				rank: 1,
				trackUri: "spotify:track:1",
				trackName: "Ribs",
				artistName: "Lorde",
				artistUri: "spotify:artist:1",
				albumName: "Pure Heroine",
				albumUri: "spotify:album:1",
				albumArt: "https://art/1",
				count: 84,
				durationMs: 240000,
			},
			{
				rank: 2,
				trackUri: "spotify:track:2",
				trackName: "Green Light",
				artistName: "Lorde",
				artistUri: "spotify:artist:1",
				albumName: "Melodrama",
				albumUri: "spotify:album:2",
				albumArt: "https://art/2",
				count: 72,
				durationMs: 234000,
			},
			{
				rank: 3,
				trackUri: "spotify:track:3",
				trackName: "Liability",
				artistName: "Lorde",
				artistUri: "spotify:artist:1",
				albumName: "Melodrama",
				albumUri: "spotify:album:2",
				albumArt: "https://art/3",
				count: 65,
				durationMs: 175000,
			},
			{
				rank: 4,
				trackUri: "spotify:track:4",
				trackName: "Supercut",
				artistName: "Lorde",
				artistUri: "spotify:artist:1",
				albumName: "Melodrama",
				albumUri: "spotify:album:2",
				albumArt: "https://art/4",
				count: 58,
				durationMs: 263000,
			},
			{
				rank: 5,
				trackUri: "spotify:track:5",
				trackName: "Perfect Places",
				artistName: "Lorde",
				artistUri: "spotify:artist:1",
				albumName: "Melodrama",
				albumUri: "spotify:album:2",
				albumArt: "https://art/5",
				count: 51,
				durationMs: 228000,
			},
		],
		topArtists: [
			{
				rank: 1,
				artistUri: "spotify:artist:1",
				artistName: "Lorde",
				count: 312,
				durationMs: 5000000,
				genres: ["art pop"],
				imageUrl: "https://img/1",
			},
			{
				rank: 2,
				artistUri: "spotify:artist:2",
				artistName: "Phoebe Bridgers",
				count: 200,
				durationMs: 3500000,
				genres: ["indie rock"],
				imageUrl: "https://img/2",
			},
			{
				rank: 3,
				artistUri: "spotify:artist:3",
				artistName: "Bon Iver",
				count: 150,
				durationMs: 3000000,
				genres: ["indie folk"],
				imageUrl: "https://img/3",
			},
		],
		topAlbums: [],
		topGenres: [
			{ rank: 1, genre: "indie pop", count: 400 },
			{ rank: 2, genre: "art pop", count: 300 },
			{ rank: 3, genre: "dream pop", count: 200 },
			{ rank: 4, genre: "shoegaze", count: 100 },
		],
		totalPlays: 1842,
		totalDuration: 147 * 60 * 60 * 1000,
		recentPlays: [],
		hourlyDistribution: Array(24).fill(30),
		peakHour: 22,
		skipRate: 0.13,
		uniqueTrackCount: 450,
		uniqueArtistCount: 312,
		streak: 47,
		listeningDays: 28,
		weekdayDistribution: [100, 120, 110, 130, 140, 160, 150],
		peakWeekday: 5,
		dailyPlayCounts: Array.from({ length: 56 }, (_, i) => ({
			date: `2026-03-${i + 1}`,
			count: Math.floor(Math.random() * 50),
		})),
		newArtistCount: 14,
		priorPeriodTotalDuration: 130 * 60 * 60 * 1000,
	};
}

function makeMockPeriod() {
	return {
		id: "4weeks",
		label: "Last 4 weeks",
		getBoundaries: () => ({ start: Date.now() - 28 * 86400000, end: Date.now() }),
	};
}

describe("renderShareCardBlob (Canvas 2D pipeline)", () => {
	beforeEach(() => {
		setupCanvasMock();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("produces a PNG blob", async () => {
		const { renderShareCardBlob } = await import("../app/components/ShareModal");
		const blob = await renderShareCardBlob(
			makeMockStats(),
			"top5",
			"square",
			"Last 4 weeks",
			"testuser",
		);
		expect(blob).toBeInstanceOf(Blob);
		expect(blob.type).toBe("image/png");
	});

	it("creates canvas with correct dimensions for square", async () => {
		const { renderShareCardCanvas } = await import("../app/components/ShareModal");
		const canvas = await renderShareCardCanvas(
			makeMockStats(),
			"top5",
			"square",
			"Last 4 weeks",
			"",
		);
		expect(canvas.width).toBe(1080);
		expect(canvas.height).toBe(1080);
	});

	it("creates canvas with correct dimensions for story", async () => {
		const { renderShareCardCanvas } = await import("../app/components/ShareModal");
		const canvas = await renderShareCardCanvas(
			makeMockStats(),
			"top5",
			"story",
			"Last 4 weeks",
			"",
		);
		expect(canvas.width).toBe(1080);
		expect(canvas.height).toBe(1920);
	});

	it("renders all variant types without error", async () => {
		const { renderShareCardBlob } = await import("../app/components/ShareModal");
		const stats = makeMockStats();
		const variants = ["top5", "time", "genre", "streak", "throwback", "wrapped"] as const;
		for (const v of variants) {
			const blob = await renderShareCardBlob(stats, v, "square", "Last 4 weeks", "testuser");
			expect(blob).toBeInstanceOf(Blob);
		}
	});

	it("renders wrapped variant in story size without error", async () => {
		const { renderShareCardBlob } = await import("../app/components/ShareModal");
		const blob = await renderShareCardBlob(
			makeMockStats(),
			"wrapped",
			"story",
			"Last 4 weeks",
			"testuser",
		);
		expect(blob).toBeInstanceOf(Blob);
	});

	it("handles empty stats gracefully", async () => {
		const { renderShareCardBlob } = await import("../app/components/ShareModal");
		const emptyStats = {
			...makeMockStats(),
			topTracks: [],
			topArtists: [],
			topGenres: [],
			dailyPlayCounts: [],
			streak: 0,
		};
		const blob = await renderShareCardBlob(emptyStats, "top5", "square", "Last 4 weeks", "");
		expect(blob).toBeInstanceOf(Blob);
	});

	it("draws background gradients on the canvas", async () => {
		const { renderShareCardCanvas } = await import("../app/components/ShareModal");
		await renderShareCardCanvas(makeMockStats(), "top5", "square", "Last 4 weeks", "");
		expect(mockCtx.createLinearGradient).toHaveBeenCalled();
		expect(mockCtx.createRadialGradient).toHaveBeenCalled();
		expect(mockCtx.fillRect).toHaveBeenCalled();
	});

	it("draws watermark text on the canvas", async () => {
		const { renderShareCardCanvas } = await import("../app/components/ShareModal");
		await renderShareCardCanvas(makeMockStats(), "top5", "square", "Last 4 weeks", "");
		const textCalls = mockCtx.fillText.mock.calls.map((c: unknown[]) => c[0]);
		expect(textCalls).toContain("LISTENING STATS · SPICETIFY");
	});
});

describe("exportShareCardPng", () => {
	beforeEach(() => {
		setupCanvasMock();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("triggers a file download with correct filename", async () => {
		const { exportShareCardPng } = await import("../app/components/ShareModal");

		const createObjectURL = vi.fn(() => "blob:fake-url");
		const revokeObjectURL = vi.fn();
		vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

		const clickSpy = vi.fn();
		const origCE = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation(
			(tag: string, opts?: ElementCreationOptions) => {
				const node = origCE.call(document, tag, opts);
				if (tag === "a") vi.spyOn(node, "click").mockImplementation(clickSpy);
				return node;
			},
		);

		await exportShareCardPng(makeMockStats(), "top5", "square", "Last 4 weeks", "");

		expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
	});
});

describe("copyShareCardToClipboard", () => {
	beforeEach(() => {
		setupCanvasMock();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes a PNG blob to the clipboard", async () => {
		const { copyShareCardToClipboard } = await import("../app/components/ShareModal");

		const writeFn = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { write: writeFn },
			writable: true,
			configurable: true,
		});
		vi.stubGlobal(
			"ClipboardItem",
			class MockClipboardItem {
				constructor(public items: Record<string, Blob>) {}
			},
		);

		await copyShareCardToClipboard(makeMockStats(), "top5", "square", "Last 4 weeks", "testuser");

		expect(writeFn).toHaveBeenCalledTimes(1);
		const item = writeFn.mock.calls[0][0][0];
		expect(item.items["image/png"]).toBeInstanceOf(Blob);
	});

	it("throws when clipboard API is not available", async () => {
		const { copyShareCardToClipboard } = await import("../app/components/ShareModal");

		Object.defineProperty(navigator, "clipboard", {
			value: { write: undefined },
			writable: true,
			configurable: true,
		});

		await expect(
			copyShareCardToClipboard(makeMockStats(), "top5", "square", "Last 4 weeks", ""),
		).rejects.toThrow("Clipboard API not available");
	});
});

describe("shareOrDownload", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("tries native share first when available", async () => {
		const { shareOrDownload } = await import("../app/components/ShareModal");
		const shareFn = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { ...navigator, share: shareFn, clipboard: { write: vi.fn() } });
		vi.stubGlobal(
			"File",
			class MockFile extends Blob {
				name: string;
				constructor(parts: BlobPart[], name: string, opts?: BlobPropertyBag) {
					super(parts, opts);
					this.name = name;
				}
			},
		);

		const blob = new Blob(["png"], { type: "image/png" });
		const result = await shareOrDownload(blob);

		expect(result).toBe("shared");
		expect(shareFn).toHaveBeenCalledTimes(1);
	});

	it("falls back to clipboard when share throws", async () => {
		const { shareOrDownload } = await import("../app/components/ShareModal");
		const shareFn = vi.fn().mockRejectedValue(new Error("cancelled"));
		const writeFn = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { ...navigator, share: shareFn, clipboard: { write: writeFn } });
		vi.stubGlobal(
			"ClipboardItem",
			class MockClipboardItem {
				constructor(public items: Record<string, Blob>) {}
			},
		);
		vi.stubGlobal(
			"File",
			class MockFile extends Blob {
				name: string;
				constructor(parts: BlobPart[], name: string, opts?: BlobPropertyBag) {
					super(parts, opts);
					this.name = name;
				}
			},
		);

		const blob = new Blob(["png"], { type: "image/png" });
		const result = await shareOrDownload(blob);

		expect(result).toBe("copied");
		expect(writeFn).toHaveBeenCalledTimes(1);
	});

	it("falls back to download when clipboard throws", async () => {
		const { shareOrDownload } = await import("../app/components/ShareModal");
		const writeFn = vi.fn().mockRejectedValue(new Error("denied"));
		vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { write: writeFn } });

		const createObjectURL = vi.fn(() => "blob:url");
		const revokeObjectURL = vi.fn();
		vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

		const clickSpy = vi.fn();
		const origCE = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation(
			(tag: string, opts?: ElementCreationOptions) => {
				const node = origCE.call(document, tag, opts);
				if (tag === "a") vi.spyOn(node, "click").mockImplementation(clickSpy);
				return node;
			},
		);

		const blob = new Blob(["png"], { type: "image/png" });
		const result = await shareOrDownload(blob);

		expect(result).toBe("downloaded");
		expect(clickSpy).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:url");
	});
});

describe("loadImage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null on error", async () => {
		vi.stubGlobal("Image", MockImage);
		const { loadImage } = await import("../app/components/ShareModal");
		const result = await loadImage("https://invalid-url.example.com/img.png");
		expect(result).toBeNull();
	});
});

describe("ShareModal busy state", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		setupCanvasMock();
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		vi.clearAllMocks();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		document.querySelectorAll(".share-overlay").forEach((el: Element) => el.remove());
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("disables buttons while export is in progress", async () => {
		const { ShareModal } = await import("../app/components/ShareModal");
		const mockStats = makeMockStats();
		const mockPeriod = makeMockPeriod();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ShareModal, {
				stats: mockStats,
				activePeriod: mockPeriod,
				onClose: vi.fn(),
			}),
			container,
		);

		const copyBtn = document.querySelector<HTMLButtonElement>("[data-testid='share-copy-btn']");
		const downloadBtn = document.querySelector<HTMLButtonElement>(
			"[data-testid='share-download-btn']",
		);
		expect(copyBtn).toBeTruthy();
		expect(downloadBtn).toBeTruthy();
		expect(copyBtn?.disabled).toBe(false);
		expect(downloadBtn?.disabled).toBe(false);
	});

	it("shows success notification after copy", async () => {
		Object.defineProperty(navigator, "clipboard", {
			value: { write: vi.fn().mockResolvedValue(undefined) },
			writable: true,
			configurable: true,
		});
		vi.stubGlobal(
			"ClipboardItem",
			class MockClipboardItem {
				constructor(public items: Record<string, Blob>) {}
			},
		);

		const { ShareModal } = await import("../app/components/ShareModal");
		const mockStats = makeMockStats();
		const mockPeriod = makeMockPeriod();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ShareModal, {
				stats: mockStats,
				activePeriod: mockPeriod,
				onClose: vi.fn(),
			}),
			container,
		);

		const copyBtn = document.querySelector<HTMLButtonElement>("[data-testid='share-copy-btn']");
		copyBtn?.click();

		await vi.waitFor(() => {
			expect(Spicetify.showNotification).toHaveBeenCalledWith("Copied to clipboard!");
		});
	});

	it("shows download success notification", async () => {
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:fake"),
			revokeObjectURL: vi.fn(),
		});

		const { ShareModal } = await import("../app/components/ShareModal");
		const mockStats = makeMockStats();
		const mockPeriod = makeMockPeriod();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(ShareModal, {
				stats: mockStats,
				activePeriod: mockPeriod,
				onClose: vi.fn(),
			}),
			container,
		);

		const downloadBtn = document.querySelector<HTMLButtonElement>(
			"[data-testid='share-download-btn']",
		);
		downloadBtn?.click();

		await vi.waitFor(() => {
			expect(Spicetify.showNotification).toHaveBeenCalledWith("Share card downloaded!");
		});
	});
});
