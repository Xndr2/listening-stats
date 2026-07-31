import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT_ID = "listening-stats-widget-root";

async function importFreshWidgetMount() {
	vi.resetModules();
	return import("../app/widget-mount");
}

describe("widget-mount", () => {
	beforeEach(() => {
		document.getElementById(ROOT_ID)?.remove();
		document.getElementById("listening-stats-styles")?.remove();
	});

	afterEach(() => {
		document.getElementById(ROOT_ID)?.remove();
		document.querySelectorAll(".main-nowPlayingWidget-nowPlaying").forEach((el) => el.remove());
		vi.restoreAllMocks();
	});

	it("creates the widget root and injects styles", async () => {
		const { mountPlaybarWidget } = await importFreshWidgetMount();
		mountPlaybarWidget();
		expect(document.getElementById(ROOT_ID)).not.toBeNull();
		expect(document.getElementById("listening-stats-styles")).not.toBeNull();
	});

	it("is idempotent - a second call (from another bundle copy) does not duplicate the root", async () => {
		const first = await importFreshWidgetMount();
		first.mountPlaybarWidget();
		// Simulate the second bundle carrying its own module copy.
		const second = await importFreshWidgetMount();
		second.mountPlaybarWidget();
		expect(document.querySelectorAll(`#${ROOT_ID}`)).toHaveLength(1);
	});

	it("attaches the root to the playbar when a mount point exists", async () => {
		const playbar = document.createElement("div");
		playbar.className = "main-nowPlayingWidget-nowPlaying";
		document.body.appendChild(playbar);

		const { mountPlaybarWidget } = await importFreshWidgetMount();
		mountPlaybarWidget();
		expect(document.getElementById(ROOT_ID)?.parentElement).toBe(playbar);
	});

	it("re-attaches to the playbar when it appears after mount", async () => {
		const { mountPlaybarWidget } = await importFreshWidgetMount();
		mountPlaybarWidget();
		expect(document.getElementById(ROOT_ID)?.parentElement).toBe(document.body);

		const playbar = document.createElement("div");
		playbar.className = "main-nowPlayingWidget-nowPlaying";
		document.body.appendChild(playbar);
		// MutationObserver callbacks run as microtasks in jsdom.
		await new Promise((r) => setTimeout(r, 0));
		expect(document.getElementById(ROOT_ID)?.parentElement).toBe(playbar);
	});

	it("prefers ReactDOM.createRoot over legacy render when available", async () => {
		const rootRender = vi.fn();
		const createRoot = vi.fn(() => ({ render: rootRender }));
		const legacyRender = vi.fn();
		const original = Spicetify.ReactDOM;
		(Spicetify as unknown as { ReactDOM: unknown }).ReactDOM = {
			createRoot,
			render: legacyRender,
		};
		try {
			const { mountPlaybarWidget } = await importFreshWidgetMount();
			mountPlaybarWidget();
			expect(createRoot).toHaveBeenCalledTimes(1);
			expect(rootRender).toHaveBeenCalledTimes(1);
			expect(legacyRender).not.toHaveBeenCalled();
		} finally {
			(Spicetify as unknown as { ReactDOM: unknown }).ReactDOM = original;
		}
	});

	it("falls back to legacy render when createRoot is missing", async () => {
		const legacyRender = vi.fn();
		const original = Spicetify.ReactDOM;
		(Spicetify as unknown as { ReactDOM: unknown }).ReactDOM = { render: legacyRender };
		try {
			const { mountPlaybarWidget } = await importFreshWidgetMount();
			mountPlaybarWidget();
			expect(legacyRender).toHaveBeenCalledTimes(1);
		} finally {
			(Spicetify as unknown as { ReactDOM: unknown }).ReactDOM = original;
		}
	});
});
