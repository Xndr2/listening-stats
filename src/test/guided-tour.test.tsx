import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markTourSeen, resetTourSeen, shouldAutoStartTour, TOUR_STEPS } from "../app/tour";
import { LS_KEYS } from "../shared/constants/storage-keys";

describe("GuidedTour integration", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("renders when active=true and starts at step 0", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-popover")).not.toBeNull();
		expect(document.body.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
	});

	it("does not render when active=false", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: false,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-popover")).toBeNull();
	});

	it("advances step on Next click", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		const nextBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
		nextBtn.click();
		expect(document.body.textContent).toContain(`Step 2 of ${TOUR_STEPS.length}`);
		expect(document.body.textContent).toContain(TOUR_STEPS[1].label);
	});

	it("calls onComplete and persists when Skip is clicked", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const onComplete = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete,
			}),
			container,
		);
		const skipBtn = document.querySelector(".tour-btn-skip") as HTMLButtonElement;
		skipBtn.click();
		expect(onComplete).toHaveBeenCalledOnce();
		expect(localStorage.getItem(LS_KEYS.TOUR_SEEN_VERSION)).toBe("2");
	});

	it("calls onComplete and persists when Finish is clicked on last step", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const onComplete = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete,
			}),
			container,
		);
		// Navigate to last step
		for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
			const nextBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
			nextBtn.click();
		}
		expect(document.body.textContent).toContain(`Step ${TOUR_STEPS.length} of ${TOUR_STEPS.length}`);
		const finishBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
		expect(finishBtn.textContent).toBe("Finish");
		finishBtn.click();
		expect(onComplete).toHaveBeenCalledOnce();
		expect(localStorage.getItem(LS_KEYS.TOUR_SEEN_VERSION)).toBe("2");
	});

	it("advances step on ArrowRight keydown", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(document.body.textContent).toContain(`Step 2 of ${TOUR_STEPS.length}`);
	});

	it("goes back on ArrowLeft keydown (not below step 0)", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		// First go forward
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(document.body.textContent).toContain(`Step 2 of ${TOUR_STEPS.length}`);
		// Then go back
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		expect(document.body.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
		// Don't go below 0
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		expect(document.body.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
	});

	it("skips tour on Escape keydown", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const onComplete = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete,
			}),
			container,
		);
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(onComplete).toHaveBeenCalledOnce();
		expect(localStorage.getItem(LS_KEYS.TOUR_SEEN_VERSION)).toBe("2");
	});

	it("does not respond to keyboard events when inactive", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const onComplete = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: false,
				version: "2.0.0",
				onComplete,
			}),
			container,
		);
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("completes on ArrowRight from last step", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const onComplete = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete,
			}),
			container,
		);
		for (let i = 0; i < TOUR_STEPS.length; i++) {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		}
		expect(onComplete).toHaveBeenCalledOnce();
	});

	it("has overlay backdrop with tour-overlay class", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-overlay")).not.toBeNull();
	});
});

describe("GuidedTour spotlight and positioning", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		document.querySelectorAll("[data-tour-target]").forEach((el) => el.remove());
		localStorage.clear();
	});

	function createTarget(selector: string): HTMLElement {
		const el = document.createElement("div");
		if (selector.startsWith(".")) {
			el.classList.add(selector.slice(1));
		} else if (selector.startsWith("[data-testid=")) {
			const val = selector.match(/"([^"]+)"/)?.[1] ?? "";
			el.setAttribute("data-testid", val);
		} else if (selector.startsWith("[aria-label=")) {
			const val = selector.match(/"([^"]+)"/)?.[1] ?? "";
			el.setAttribute("aria-label", val);
		} else if (selector.startsWith("[data-section-id=")) {
			const val = selector.match(/"([^"]+)"/)?.[1] ?? "";
			el.setAttribute("data-section-id", val);
		}
		el.setAttribute("data-tour-target", "true");
		el.getBoundingClientRect = () => ({
			top: 100,
			left: 50,
			width: 200,
			height: 40,
			right: 250,
			bottom: 140,
			x: 50,
			y: 100,
			toJSON: () => {},
		});
		el.scrollIntoView = vi.fn();
		document.body.appendChild(el);
		return el;
	}

	it("renders a spotlight element when target exists in the DOM", async () => {
		createTarget(".header-provider-pill");
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-spotlight")).not.toBeNull();
	});

	it("does not render spotlight when target element is missing", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-spotlight")).toBeNull();
	});

	it("popover has tour-popover--positioned class when target exists", async () => {
		createTarget(".header-provider-pill");
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-popover--positioned")).not.toBeNull();
	});

	it("popover falls back to centered (no --positioned) when target is missing", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-popover--positioned")).toBeNull();
		expect(document.querySelector(".tour-popover")).not.toBeNull();
	});

	it("calls scrollIntoView on the target element", async () => {
		const target = createTarget(".header-provider-pill");
		target.scrollIntoView = vi.fn();
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(target.scrollIntoView).toHaveBeenCalled();
	});

	it("shows Back button from step 2 onward", async () => {
		createTarget(".header-provider-pill");
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.querySelector(".tour-btn-back")).toBeNull();
		const nextBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
		nextBtn.click();
		expect(document.querySelector(".tour-btn-back")).not.toBeNull();
	});

	it("Back button goes to previous step", async () => {
		createTarget(".header-provider-pill");
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		const nextBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
		nextBtn.click();
		expect(document.body.textContent).toContain(`Step 2 of ${TOUR_STEPS.length}`);
		const backBtn = document.querySelector(".tour-btn-back") as HTMLButtonElement;
		backBtn.click();
		expect(document.body.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
	});

	it("updates step count to match expanded TOUR_STEPS length", async () => {
		const { GuidedTour } = await import("../app/components/GuidedTour");
		const { TOUR_STEPS } = await import("../app/tour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(document.body.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
	});
});

describe("Guided tour auto-start gating", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("auto-starts on first run (no tour-seen key)", () => {
		expect(shouldAutoStartTour("2.0.0")).toBe(true);
	});

	it("does not auto-start after tour has been seen for same major version", () => {
		markTourSeen("2.0.0");
		expect(shouldAutoStartTour("2.0.0")).toBe(false);
		expect(shouldAutoStartTour("2.1.0")).toBe(false);
	});

	it("auto-starts again after major version bump", () => {
		markTourSeen("2.0.0");
		expect(shouldAutoStartTour("3.0.0")).toBe(true);
	});

	it("restart clears seen flag so auto-start returns true", () => {
		markTourSeen("2.0.0");
		expect(shouldAutoStartTour("2.0.0")).toBe(false);
		resetTourSeen();
		expect(shouldAutoStartTour("2.0.0")).toBe(true);
	});
});

describe("DisplayTab restart tour button", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	it("renders restart button when onRestartTour is provided", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, {
				onPrefsChanged: vi.fn(),
				onRestartTour: vi.fn(),
			}),
			container,
		);
		const btn = container.querySelector("[data-testid='restart-tour']") as HTMLButtonElement;
		expect(btn).not.toBeNull();
		expect(btn.textContent).toBe("Restart");
	});

	it("does not render restart button when onRestartTour is omitted", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, {
				onPrefsChanged: vi.fn(),
			}),
			container,
		);
		const btn = container.querySelector("[data-testid='restart-tour']");
		expect(btn).toBeNull();
	});

	it("calls onRestartTour when restart button is clicked", async () => {
		const { DisplayTab } = await import("../app/components/settings/DisplayTab");
		const onRestartTour = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(DisplayTab, {
				onPrefsChanged: vi.fn(),
				onRestartTour,
			}),
			container,
		);
		const btn = container.querySelector("[data-testid='restart-tour']") as HTMLButtonElement;
		btn.click();
		expect(onRestartTour).toHaveBeenCalledOnce();
	});
});
