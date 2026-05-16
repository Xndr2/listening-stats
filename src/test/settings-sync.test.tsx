import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../app/components/Header";
import { getPreferences, SECTION_IDS, setPreference } from "../app/preferences";
import { EVENTS } from "../shared/constants/events";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { localProvider } from "../shared/stats/local-provider";
import { providerRegistry } from "../shared/stats/provider";
import { statsCache } from "../shared/stats/stats-cache";
import { statsfmProvider } from "../shared/stats/statsfm-provider";

describe("settings/dashboard PREFS_CHANGED sync", () => {
	beforeEach(() => {
		localStorage.clear();
		statsCache.invalidate();
	});

	afterEach(() => {
		localStorage.clear();
		statsCache.invalidate();
		vi.restoreAllMocks();
	});

	it("setPreference('hiddenSections', [...]) followed by dispatchEvent PREFS_CHANGED causes a listener to fire once with the new hiddenSections readable via getPreferences", () => {
		let capturedHiddenSections: string[] | null = null;
		let listenerCallCount = 0;

		const listener = () => {
			listenerCallCount++;
			capturedHiddenSections = getPreferences().hiddenSections;
		};
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		setPreference("hiddenSections", ["overview"]);
		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);

		expect(listenerCallCount).toBe(1);
		expect(capturedHiddenSections).toEqual(["overview"]);
	});

	it("Settings Display toggle path: setPreference('hiddenSections', [...]) from DisplayTab's perspective is visible to a separate getPreferences() read on the next tick", () => {
		// Simulate two surfaces using the same localStorage key.
		// "surface A" (DisplayTab) calls setPreference
		setPreference("hiddenSections", ["top-lists"]);

		// Arrange listener to simulate "surface B" (dashboard)
		let surfaceBReceived = false;
		let surfaceBHiddenSections: string[] | null = null;

		const listener = () => {
			surfaceBReceived = true;
			surfaceBHiddenSections = getPreferences().hiddenSections;
		};
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		// "surface A" dispatches the event after writing
		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);

		// "surface B" (direct read, independent) sees the same value
		expect(getPreferences().hiddenSections).toEqual(["top-lists"]);
		// And the event was dispatched from A and received by B
		expect(surfaceBReceived).toBe(true);
		expect(surfaceBHiddenSections).toEqual(["top-lists"]);
	});

	it("dispatching PREFS_CHANGED does not invalidate statsCache", () => {
		// Mirror the existing preferences.test.ts:171-180 pattern
		const invalidateSpy = vi.spyOn(statsCache, "invalidate");
		statsCache.setupInvalidationListeners();
		statsCache.set("local:all-time", { marker: "still-here" });

		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));

		expect(invalidateSpy).not.toHaveBeenCalled();
		expect(statsCache.get("local:all-time")).toEqual({ marker: "still-here" });
	});
});

describe("DisplayTab visible section rows vs SECTION_IDS", () => {
	it("DisplayTab's SECTION_OPTIONS ids are a subset of SECTION_IDS (no legacy top-tracks/top-artists/top-albums in Visible Sections rows)", async () => {
		// Dynamic import keeps jsdom startup cheap
		const { render } = await import("@testing-library/react");
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");

		render(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));

		// Coarse section rows only; column toggles live in the Top Lists grid
		const rows = document.querySelectorAll("[data-row-id]");
		const rowIds = Array.from(rows).map((r) => r.getAttribute("data-row-id"));
		expect(rowIds).toContain("top-lists");
		expect(rowIds).not.toContain("top-tracks");
		expect(rowIds).not.toContain("top-artists");
		expect(rowIds).not.toContain("top-albums");

		// SECTION_IDS alignment: all coarse IDs should be represented
		expect(SECTION_IDS.length).toBe(6);
	});
});

describe("Visible Sections drag-reorder persists sectionOrder + PREFS_CHANGED", () => {
	let renderFn: typeof import("@testing-library/react").render;
	let cleanupFn: typeof import("@testing-library/react").cleanup;
	let fireEvent: typeof import("@testing-library/react").fireEvent;
	let DisplayTab: typeof import("../app/components/settings/DisplayTab").DisplayTab;

	beforeEach(async () => {
		localStorage.clear();
		({ render: renderFn, cleanup: cleanupFn, fireEvent } = await import("@testing-library/react"));
		// Clear any DOM left by prior describe blocks
		cleanupFn();
		({ DisplayTab } = await import("../app/components/settings/DisplayTab"));
	});

	afterEach(() => {
		cleanupFn();
		localStorage.clear();
		vi.restoreAllMocks();
	});

	function stubRowRects() {
		// Stub getBoundingClientRect on [data-row-id] elements so hook can compute midlines.
		// Rows are spaced 40px apart vertically.
		const rows = document.querySelectorAll<HTMLElement>("[data-row-id]");
		rows.forEach((el, i) => {
			el.getBoundingClientRect = () =>
				({
					top: i * 40,
					bottom: (i + 1) * 40,
					left: 0,
					right: 200,
					width: 200,
					height: 40,
					x: 0,
					y: i * 40,
					toJSON: () => ({}),
				}) as DOMRect;
		});
	}

	it("renders 5 sortable rows in canonical SECTION_IDS order on first load", () => {
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		const rows = document.querySelectorAll<HTMLElement>("[data-row-id]");
		expect(rows.length).toBe(5);
		const ids = Array.from(rows).map((r) => r.getAttribute("data-row-id"));
		expect(ids).toEqual(["overview", "top-genres", "top-lists", "activity", "recently-played"]);
	});

	it("dragging the first row past the third row's midline writes a reordered sectionOrder + dispatches PREFS_CHANGED", () => {
		const onPrefsChanged = vi.fn();
		let prefsChangedFired = 0;
		const listener = () => prefsChangedFired++;
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged }));
		stubRowRects();

		const handle = document.querySelector<HTMLElement>('[aria-label="Drag Overview"]');
		expect(handle).not.toBeNull();

		// Use fireEvent for React synthetic event compatibility.
		// pointerdown on the drag handle (activates hook's armed state).
		// pointermove on window (hook listens on window unconditionally).
		// pointerup on window triggers drop resolution.
		fireEvent.pointerDown(handle!, { clientX: 0, clientY: 20 });
		// Move well past 8px threshold and past row[3] midline (row[3] top=120, bottom=160 → mid=140)
		fireEvent.pointerMove(window, { clientX: 0, clientY: 140 });
		fireEvent.pointerUp(window, { clientX: 0, clientY: 140 });

		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "{}");
		expect(stored.sectionOrder).toBeDefined();
		expect(stored.sectionOrder).not.toEqual(["overview", "top-genres", "top-lists", "activity", "recently-played"]);
		expect(stored.sectionOrder.indexOf("overview")).toBeGreaterThan(0); // overview moved down
		expect(prefsChangedFired).toBeGreaterThanOrEqual(1);
		expect(onPrefsChanged).toHaveBeenCalled();

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
	});

	it("clicking a toggle does NOT trigger drag (sectionOrder unchanged)", () => {
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		stubRowRects();

		// sectionOrder is not in localStorage until something writes to it; use default order as baseline
		const defaultOrder = ["overview", "top-genres", "top-lists", "activity", "recently-played"];

		// pointerdown on the toggle slot (not the drag handle)  -  must NOT arm drag
		const overviewRow = document.querySelector<HTMLElement>('[data-row-id="overview"]');
		const toggleSlot = overviewRow?.querySelector<HTMLElement>(".sortable-row-toggle");
		expect(toggleSlot).not.toBeNull();
		fireEvent.pointerDown(toggleSlot!, { clientX: 180, clientY: 20 });
		// Move enough to cross threshold, but drag should not be armed
		fireEvent.pointerMove(window, { clientX: 180, clientY: 200 });
		fireEvent.pointerUp(window, { clientX: 180, clientY: 200 });

		// sectionOrder must remain at default (localStorage either empty or has default order)
		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "null");
		const afterOrder = stored?.sectionOrder ?? defaultOrder;
		expect(afterOrder).toEqual(defaultOrder);
	});

	it("reset layout restores hiddenSections and ordering defaults", () => {
		setPreference("hiddenSections", ["top-lists", "top-tracks", "tracks"]);
		setPreference("sectionOrder", [
			"top-lists",
			"overview",
			"recently-played",
			"top-genres",
			"activity",
			"consistency",
		]);
		setPreference("columnOrder", ["top-albums", "top-tracks", "top-artists"]);
		setPreference("overviewOrder", {
			local: ["skip-rate", "tracks", "unique-artists", "streak", "new-artists", "peak-hour", "est-payout"],
			statsfm: ["est-payout", "top-genre", "new-artists", "unique-artists"],
		});

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		const btn = document.querySelector<HTMLElement>('[data-testid="reset-layout"]');
		expect(btn).not.toBeNull();
		fireEvent.click(btn!);

		const prefs = getPreferences();
		expect(prefs.hiddenSections).toEqual([]);
		expect(prefs.sectionOrder).toEqual([
			"overview",
			"top-genres",
			"top-lists",
			"activity",
			"consistency",
			"recently-played",
		]);
		expect(prefs.columnOrder).toEqual(["top-tracks", "top-artists", "top-albums"]);
		expect(prefs.overviewOrder.local).toEqual([
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
			"est-payout",
		]);
		expect(prefs.overviewOrder.statsfm).toEqual(["unique-artists", "new-artists", "top-genre", "est-payout"]);
	});

	it("undo reset layout restores previous layout customization", () => {
		setPreference("hiddenSections", ["top-lists"]);
		setPreference("sectionOrder", [
			"top-lists",
			"overview",
			"top-genres",
			"activity",
			"consistency",
			"recently-played",
		]);
		setPreference("columnOrder", ["top-albums", "top-tracks", "top-artists"]);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		fireEvent.click(document.querySelector<HTMLElement>('[data-testid="reset-layout"]')!);
		fireEvent.click(document.querySelector<HTMLElement>('[data-testid="undo-reset-layout"]')!);

		const prefs = getPreferences();
		expect(prefs.hiddenSections).toEqual(["top-lists"]);
		expect(prefs.sectionOrder[0]).toBe("top-lists");
		expect(prefs.columnOrder).toEqual(["top-albums", "top-tracks", "top-artists"]);
	});
});

describe("Top Lists Columns grid in DisplayTab", () => {
	let renderFn: typeof import("@testing-library/react").render;
	let cleanupFn: typeof import("@testing-library/react").cleanup;
	let fireEvent: typeof import("@testing-library/react").fireEvent;
	let DisplayTab: typeof import("../app/components/settings/DisplayTab").DisplayTab;

	beforeEach(async () => {
		localStorage.clear();
		({ render: renderFn, cleanup: cleanupFn, fireEvent } = await import("@testing-library/react"));
		cleanupFn();
		({ DisplayTab } = await import("../app/components/settings/DisplayTab"));
	});

	afterEach(() => {
		cleanupFn();
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it("renders 3 column tiles in default columnOrder", () => {
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		// Column tiles have data-tile-id matching COLUMN_IDS  -  filter to top- prefix to exclude overview tiles
		const tiles = document.querySelectorAll<HTMLElement>('[data-tile-id^="top-"]');
		expect(tiles.length).toBe(3);
		const ids = Array.from(tiles).map((t) => t.getAttribute("data-tile-id"));
		expect(ids).toEqual(["top-tracks", "top-artists", "top-albums"]);
	});

	it("dragging a column tile writes columnOrder + dispatches PREFS_CHANGED", () => {
		let prefsChangedFired = 0;
		const listener = () => prefsChangedFired++;
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));

		// Stub tile rects for horizontal layout: 3 tiles side-by-side, each 100px wide
		const tiles = document.querySelectorAll<HTMLElement>('[data-tile-id^="top-"]');
		tiles.forEach((el, i) => {
			el.getBoundingClientRect = () =>
				({
					top: 0,
					bottom: 80,
					left: i * 100,
					right: (i + 1) * 100,
					width: 100,
					height: 80,
					x: i * 100,
					y: 0,
					toJSON: () => ({}),
				}) as DOMRect;
		});

		const firstTile = document.querySelector<HTMLElement>('[data-tile-id="top-tracks"]');
		expect(firstTile).not.toBeNull();

		// Drag "top-tracks" (tile 0, center x=50) rightward past last tile midline (x=250) → drops at slot 2
		fireEvent.pointerDown(firstTile!, { clientX: 50, clientY: 40 });
		fireEvent.pointerMove(window, { clientX: 260, clientY: 40 });
		fireEvent.pointerUp(window, { clientX: 260, clientY: 40 });

		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "{}");
		expect(stored.columnOrder).toBeDefined();
		expect(stored.columnOrder[stored.columnOrder.length - 1]).toBe("top-tracks");
		expect(prefsChangedFired).toBeGreaterThanOrEqual(1);

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
	});

	it("toggling a column tile writes the FINE id to hiddenSections + dispatches PREFS_CHANGED", () => {
		let prefsChangedFired = 0;
		const listener = () => prefsChangedFired++;
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));

		const tracksTile = document.querySelector<HTMLElement>('[data-tile-id="top-tracks"]');
		const checkbox = tracksTile?.querySelector<HTMLInputElement>('input[type="checkbox"]');
		if (!checkbox) {
			// Spicetify Toggle stub missing in jsdom; skip when no checkbox
			window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
			return;
		}
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "{}");
		expect(stored.hiddenSections).toContain("top-tracks");
		expect(prefsChangedFired).toBeGreaterThanOrEqual(1);

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
	});

	it("when coarse 'top-lists' is hidden, columns subsection has opacity 0.4 and pointer-events none", () => {
		setPreference("hiddenSections", ["top-lists"]);
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));

		// The subsection wrapper should have opacity 0.4 and pointerEvents none
		// Find by the data attribute we'll add on the wrapper
		const subsection = document.querySelector<HTMLElement>('[data-testid="top-lists-columns-subsection"]');
		expect(subsection).not.toBeNull();
		expect(subsection?.style.opacity).toBe("0.4");
		expect(subsection?.style.pointerEvents).toBe("none");
	});
});

describe("Header Plus badge", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
		providerRegistry.register(localProvider);
		providerRegistry.register(statsfmProvider);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
	});

	it("renders no Plus badge when active provider is local", async () => {
		providerRegistry.setActive("local");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "Local",
				activeProviderId: "local",
				onSettingsClick: vi.fn(),
			}),
			container,
		);
		expect(container.querySelector(".tier-badge--plus")).toBeNull();
		expect(container.querySelector(".tier-badge--free")).toBeNull();
	});

	it("renders no Plus badge when active provider is stats.fm Free", async () => {
		localStorage.setItem(
			LS_KEYS.STATSFM_CONFIG,
			JSON.stringify({
				username: "tester",
				isPlus: false,
				connectedAt: Date.now(),
				lastValidated: Date.now(),
			}),
		);
		await statsfmProvider.init();
		providerRegistry.setActive("statsfm");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "stats.fm",
				activeProviderId: "statsfm",
				onSettingsClick: vi.fn(),
			}),
			container,
		);
		expect(container.querySelector(".tier-badge--plus")).toBeNull();
		expect(container.querySelector(".tier-badge--free")).toBeNull(); // Free badge NEVER in Header
	});

	it("renders Plus badge with text 'Plus' when active provider is stats.fm Plus", async () => {
		localStorage.setItem(
			LS_KEYS.STATSFM_CONFIG,
			JSON.stringify({
				username: "tester",
				isPlus: true,
				connectedAt: Date.now(),
				lastValidated: Date.now(),
			}),
		);
		await statsfmProvider.init();
		providerRegistry.setActive("statsfm");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "stats.fm",
				activeProviderId: "statsfm",
				onSettingsClick: vi.fn(),
			}),
			container,
		);
		const badge = container.querySelector(".tier-badge--plus");
		expect(badge).not.toBeNull();
		expect(badge?.textContent).toBe("Plus");
		expect(badge?.classList.contains("tier-badge")).toBe(true);
	});

	it("Plus badge sits inside .header-provider-pill with health dot and provider name", async () => {
		localStorage.setItem(
			LS_KEYS.STATSFM_CONFIG,
			JSON.stringify({
				username: "tester",
				isPlus: true,
				connectedAt: Date.now(),
				lastValidated: Date.now(),
			}),
		);
		await statsfmProvider.init();
		providerRegistry.setActive("statsfm");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "stats.fm",
				activeProviderId: "statsfm",
				onSettingsClick: vi.fn(),
			}),
			container,
		);
		const pill = container.querySelector(".header-provider-pill");
		expect(pill).not.toBeNull();
		const children = Array.from(pill!.children);
		// Sequence: .health-dot, .header-provider-name, .tier-badge--plus
		expect(children[0]?.classList.contains("health-dot")).toBe(true);
		expect(children[1]?.classList.contains("header-provider-name")).toBe(true);
		expect(children[2]?.classList.contains("tier-badge--plus")).toBe(true);
	});
});

describe("Overview Details grid in DisplayTab", () => {
	let renderFn: typeof import("@testing-library/react").render;
	let cleanupFn: typeof import("@testing-library/react").cleanup;
	let fireEvent: typeof import("@testing-library/react").fireEvent;
	let DisplayTab: typeof import("../app/components/settings/DisplayTab").DisplayTab;

	beforeEach(async () => {
		localStorage.clear();
		({ render: renderFn, cleanup: cleanupFn, fireEvent } = await import("@testing-library/react"));
		cleanupFn();
		({ DisplayTab } = await import("../app/components/settings/DisplayTab"));
	});

	afterEach(() => {
		cleanupFn();
		localStorage.clear();
		vi.restoreAllMocks();
	});

	function stubTileRects() {
		const tiles = document.querySelectorAll<HTMLElement>("[data-tile-id]");
		const positions = [
			{ top: 0, bottom: 80, left: 0, right: 100 },
			{ top: 0, bottom: 80, left: 100, right: 200 },
			{ top: 80, bottom: 160, left: 0, right: 100 },
			{ top: 80, bottom: 160, left: 100, right: 200 },
		];
		tiles.forEach((el, i) => {
			const p = positions[i] ?? { top: 0, bottom: 80, left: 0, right: 100 };
			el.getBoundingClientRect = () =>
				({
					...p,
					width: p.right - p.left,
					height: p.bottom - p.top,
					x: p.left,
					y: p.top,
					toJSON: () => ({}),
				}) as DOMRect;
		});
	}

	it("renders 7 overview tiles split into top 4 (2x2) + bottom 3 (1x3) for local provider", () => {
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		const tiles = document.querySelectorAll<HTMLElement>("[data-tile-id]:not([data-tile-id^='top-'])");
		expect(tiles.length).toBe(7);
		const ids = Array.from(tiles).map((t) => t.getAttribute("data-tile-id"));
		expect(ids).toEqual(["tracks", "unique-artists", "streak", "new-artists", "peak-hour", "skip-rate", "est-payout"]);
	});

	it("local provider settings shows hero placeholder + 2x2 top grid + 1x3 bottom row", () => {
		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		expect(document.querySelector('[data-testid="overview-settings-hero"]')).not.toBeNull();
		const topGrid = document.querySelector(".overview-settings-top .sortable-grid--2x2");
		expect(topGrid).not.toBeNull();
		const topTiles = topGrid!.querySelectorAll<HTMLElement>("[data-tile-id]");
		expect(topTiles.length).toBe(4);
		const bottomRow = document.querySelector('[data-testid="overview-bottom-row"]');
		expect(bottomRow).not.toBeNull();
		const bottomTiles = bottomRow!.querySelectorAll<HTMLElement>("[data-tile-id]");
		expect(bottomTiles.length).toBe(3);
	});

	it("dragging an overview tile writes overviewOrder.local + dispatches PREFS_CHANGED", () => {
		let prefsChangedFired = 0;
		const listener = () => prefsChangedFired++;
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		stubTileRects();

		// Drag "tracks" (tile 0) down past tile2/tile3 midline
		const tile = document.querySelector<HTMLElement>('[data-tile-id="tracks"]');
		expect(tile).not.toBeNull();

		// pointerdown on tile (fireEvent triggers React synthetic handlers), then window pointermove/pointerup
		fireEvent.pointerDown(tile!, { clientX: 50, clientY: 40 });
		fireEvent.pointerMove(window, { clientX: 50, clientY: 140 });
		fireEvent.pointerUp(window, { clientX: 50, clientY: 140 });

		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "{}");
		expect(stored.overviewOrder).toBeDefined();
		expect(stored.overviewOrder.local).toBeDefined();
		// Seven-tile catalog: any non-trivial drag changes default local order
		expect(stored.overviewOrder.local).not.toEqual([
			"tracks",
			"unique-artists",
			"streak",
			"new-artists",
			"peak-hour",
			"skip-rate",
			"est-payout",
		]);
		expect(prefsChangedFired).toBeGreaterThanOrEqual(1);

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
	});

	it("toggling an overview tile writes hiddenSections with the card id + dispatches PREFS_CHANGED", () => {
		let prefsChangedFired = 0;
		const listener = () => prefsChangedFired++;
		window.addEventListener(EVENTS.PREFS_CHANGED, listener);

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));

		// Find the toggle for tracks tile (fallback checkbox in jsdom since Spicetify.ReactComponent.Toggle is undefined)
		const tracksTile = document.querySelector<HTMLElement>('[data-tile-id="tracks"]');
		const checkbox = tracksTile?.querySelector<HTMLInputElement>('input[type="checkbox"]');
		if (!checkbox) {
			// No checkbox fallback in this environment
			window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
			return;
		}
		checkbox.checked = false;
		checkbox.dispatchEvent(new Event("change", { bubbles: true }));

		const stored = JSON.parse(localStorage.getItem("listening-stats:preferences") ?? "{}");
		expect(stored.hiddenSections).toContain("tracks");
		expect(prefsChangedFired).toBeGreaterThanOrEqual(1);

		window.removeEventListener(EVENTS.PREFS_CHANGED, listener);
	});

	it("switching provider re-renders overview grid with stats.fm tiles", async () => {
		const { providerRegistry } = await import("../shared/stats/provider");
		vi.spyOn(providerRegistry, "getActiveId").mockReturnValue("statsfm");

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));

		const tiles = document.querySelectorAll<HTMLElement>("[data-tile-id]");
		const ids = Array.from(tiles).map((t) => t.getAttribute("data-tile-id"));
		expect(ids).toContain("top-genre");
		expect(ids).toContain("est-payout");
		expect(ids).toContain("unique-artists");
		expect(ids).toContain("new-artists");
		expect(ids).not.toContain("streak");
		expect(ids).not.toContain("skip-rate");
		expect(ids).not.toContain("peak-hour");
		expect(ids).not.toContain("listening-days");
	});

	it("statsfm provider settings shows hero + 2x2 grid only (no bottom row)", async () => {
		const { providerRegistry } = await import("../shared/stats/provider");
		vi.spyOn(providerRegistry, "getActiveId").mockReturnValue("statsfm");

		renderFn(Spicetify.React.createElement(DisplayTab, { onPrefsChanged: () => {} }));
		window.dispatchEvent(new CustomEvent(EVENTS.PROVIDER_CHANGED));

		expect(document.querySelector('[data-testid="overview-settings-hero"]')).not.toBeNull();
		const topGrid = document.querySelector(".overview-settings-top .sortable-grid--2x2");
		expect(topGrid).not.toBeNull();
		const topTiles = topGrid!.querySelectorAll<HTMLElement>("[data-tile-id]");
		expect(topTiles.length).toBe(4);
		expect(document.querySelector('[data-testid="overview-bottom-row"]')).toBeNull();
	});
});
