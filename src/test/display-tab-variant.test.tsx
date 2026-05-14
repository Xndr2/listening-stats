import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPreferences } from "../app/preferences";
import { localProvider } from "../shared/stats/local-provider";
import { providerRegistry } from "../shared/stats/provider";

describe("DisplayTab playCountVariant toggle", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
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

	it("renders play count variant selector with 4 options", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged: vi.fn() }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		expect(buttons.length).toBe(4);
	});

	it("highlights the default 'pill' variant", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged: vi.fn() }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		const pillBtn = Array.from(buttons).find((b) => b.textContent === "Pill");
		expect(pillBtn?.className).toContain("btn-primary");
	});

	it("clicking 'Bubble' updates preference to bubble", async () => {
		const onPrefsChanged = vi.fn();
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		const bubbleBtn = Array.from(buttons).find((b) => b.textContent === "Bubble") as HTMLElement;
		bubbleBtn.click();
		expect(getPreferences().playCountVariant).toBe("bubble");
		expect(onPrefsChanged).toHaveBeenCalled();
	});

	it("clicking 'Minimal' updates preference to minimal", async () => {
		const onPrefsChanged = vi.fn();
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		const minimalBtn = Array.from(buttons).find((b) => b.textContent === "Minimal") as HTMLElement;
		minimalBtn.click();
		expect(getPreferences().playCountVariant).toBe("minimal");
		expect(onPrefsChanged).toHaveBeenCalled();
	});

	it("clicking 'Off' updates preference to off", async () => {
		const onPrefsChanged = vi.fn();
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		const offBtn = Array.from(buttons).find((b) => b.textContent === "Off") as HTMLElement;
		offBtn.click();
		expect(getPreferences().playCountVariant).toBe("off");
		expect(onPrefsChanged).toHaveBeenCalled();
	});

	it("shows Extra play context row when local provider is active", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged: vi.fn() }),
			container,
		);
		const row = container.querySelector("[data-testid='play-count-extra-context']");
		expect(row).not.toBeNull();
		expect(row?.textContent).toMatch(/New play/);
	});

	it("pre-selects stored variant on mount", async () => {
		const { setPreference } = await import("../app/preferences");
		setPreference("playCountVariant", "minimal");
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, { onPrefsChanged: vi.fn() }),
			container,
		);
		const buttons = container.querySelectorAll("[data-testid='play-count-variant'] button");
		const minimalBtn = Array.from(buttons).find((b) => b.textContent === "Minimal");
		expect(minimalBtn?.className).toContain("btn-primary");
	});
});
