import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setPreference } from "../app/preferences";
import { localProvider } from "../shared/stats/local-provider";
import { providerRegistry } from "../shared/stats/provider";
import { db } from "../shared/storage/db";
import type { PlayEvent } from "../shared/types/play-event";

function makePlayEvent(
	trackUri: string,
	startedAt: number,
	overrides?: Partial<PlayEvent>,
): PlayEvent {
	return {
		trackUri,
		trackName: "Test Track",
		artistName: "Test Artist",
		artistUri: "spotify:artist:test",
		albumName: "Test Album",
		albumUri: "spotify:album:test",
		durationMs: 200000,
		playedMs: 180000,
		startedAt,
		endedAt: startedAt + 180000,
		type: "play",
		...overrides,
	};
}

describe("PlaybarWidget", () => {
	let container: HTMLDivElement;

	beforeEach(async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
		providerRegistry._resetForTesting();
		providerRegistry.register(localProvider);
		providerRegistry.setActive("local");
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("renders nothing when no track is playing", async () => {
		(Spicetify.Player as any).data = { isPaused: false, item: null };
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		expect(container.querySelector(".play-count-pill")).toBeNull();
		expect(container.querySelector(".play-count-bubble")).toBeNull();
		expect(container.querySelector(".play-count-minimal")).toBeNull();
	});

	it("renders nothing when track has playCount <= 1", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.add(makePlayEvent(uri, Date.now() - 60000));
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		// Wait for async effect
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-pill")).toBeNull();
	});

	it("renders pill when track has playCount > 1", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 120000),
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		const pill = container.querySelector(".play-count-pill");
		expect(pill).not.toBeNull();
		expect(pill?.textContent).toContain("3 plays");
	});

	it("renders bubble variant when preference is set to bubble", async () => {
		setPreference("playCountVariant", "bubble");
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-bubble")).not.toBeNull();
	});

	it("renders minimal variant when preference is set to minimal", async () => {
		setPreference("playCountVariant", "minimal");
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-minimal")).not.toBeNull();
	});

	it("renders pill even when active provider is stats.fm free tier", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm free",
				capabilities: {
					hasActivityData: false,
					hasGenreData: false,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "free" as const,
				},
			}),
			getSupportedPeriods: () => [],
			calculateStats: async () => ({}) as any,
			init: async () => {},
			destroy: () => {},
		});
		providerRegistry.setActive("statsfm");

		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-pill")).not.toBeNull();
	});

	it("renders when active provider is stats.fm Plus tier", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		providerRegistry._resetForTesting();
		providerRegistry.register({
			getProviderInfo: () => ({
				id: "statsfm",
				name: "stats.fm",
				description: "stats.fm Plus",
				capabilities: {
					hasActivityData: true,
					hasGenreData: true,
					hasStreakData: false,
					hasSkipRate: false,
					tier: "plus" as const,
				},
			}),
			getSupportedPeriods: () => [],
			calculateStats: async () => ({}) as any,
			init: async () => {},
			destroy: () => {},
		});
		providerRegistry.setActive("statsfm");

		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-pill")).not.toBeNull();
	});

	it("shows tooltip with first-play date", async () => {
		const uri = "spotify:track:abc123";
		const firstDate = new Date("2026-03-12T10:00:00Z").getTime();
		await db.playEvents.bulkAdd([makePlayEvent(uri, firstDate), makePlayEvent(uri, Date.now())]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		const pill = container.querySelector(".play-count-pill");
		expect(pill?.getAttribute("title")).toMatch(/Played 2 times/);
		expect(pill?.getAttribute("title")).toMatch(/first on/);
	});

	it("updates when PREFS_CHANGED event fires (variant switch)", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-pill")).not.toBeNull();

		// Switch to minimal variant
		setPreference("playCountVariant", "minimal");
		window.dispatchEvent(new CustomEvent("listening-stats:prefs-changed"));
		await new Promise((r) => setTimeout(r, 50));
		expect(container.querySelector(".play-count-minimal")).not.toBeNull();
		expect(container.querySelector(".play-count-pill")).toBeNull();
	});

	it("mounts next to now-playing track info (not in playbar right)", async () => {
		const nowPlayingWidget = document.createElement("div");
		nowPlayingWidget.className = "main-nowPlayingWidget-nowPlaying";
		document.body.appendChild(nowPlayingWidget);

		const uri = "spotify:track:abc123";
		await db.playEvents.bulkAdd([
			makePlayEvent(uri, Date.now() - 60000),
			makePlayEvent(uri, Date.now()),
		]);
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		const widgetContainer = document.createElement("div");
		nowPlayingWidget.appendChild(widgetContainer);
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), widgetContainer);
		await new Promise((r) => setTimeout(r, 50));
		const pill = nowPlayingWidget.querySelector(".play-count-pill");
		expect(pill).not.toBeNull();
		const anchor = nowPlayingWidget.querySelector(".play-count-widget-anchor") as HTMLElement;
		expect(anchor).not.toBeNull();
		Spicetify.ReactDOM.unmountComponentAtNode(widgetContainer);
		nowPlayingWidget.remove();
	});

	it("updates when PLAY_RECORDED event fires", async () => {
		const uri = "spotify:track:abc123";
		await db.playEvents.add(makePlayEvent(uri, Date.now() - 60000));
		(Spicetify.Player as any).data = {
			isPaused: false,
			item: { uri, name: "Test Track", metadata: {} },
		};
		const { PlaybarWidget } = await import("../app/components/PlaybarWidget");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(PlaybarWidget), container);
		await new Promise((r) => setTimeout(r, 50));
		// count = 1, should be hidden
		expect(container.querySelector(".play-count-pill")).toBeNull();

		// Add another play and fire event
		await db.playEvents.add(makePlayEvent(uri, Date.now()));
		window.dispatchEvent(new CustomEvent("listening-stats:play-recorded"));
		await new Promise((r) => setTimeout(r, 50));
		// count = 2, should now be visible
		expect(container.querySelector(".play-count-pill")).not.toBeNull();
		expect(container.querySelector(".play-count-pill")?.textContent).toContain("2 plays");
	});
});
