import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS } from "../app/tour";

function createTourTarget(
	tourId: string,
	rect: { top: number; left: number; width: number; height: number },
): HTMLElement {
	const el = document.createElement("div");
	el.setAttribute("data-tour-target", tourId);
	el.getBoundingClientRect = () => ({
		...rect,
		right: rect.left + rect.width,
		bottom: rect.top + rect.height,
		x: rect.left,
		y: rect.top,
		toJSON: () => {},
	});
	el.scrollIntoView = vi.fn();
	document.body.appendChild(el);
	return el;
}

describe("Tour alignment scroll vs measure separation", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		document.querySelectorAll("[data-tour-target]").forEach((el) => el.remove());
		document.querySelectorAll("[data-testid]").forEach((el) => el.remove());
		document.querySelectorAll("[data-section-id]").forEach((el) => el.remove());
		localStorage.clear();
		vi.useRealTimers();
	});

	it("scrollIntoView is called once per step, not on delayed re-measurements", async () => {
		const target = createTourTarget("health", { top: 100, left: 50, width: 200, height: 40 });
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(320);
		expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
	});

	it("resize does not re-trigger scrollIntoView", async () => {
		const target = createTourTarget("health", { top: 100, left: 50, width: 200, height: 40 });
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		vi.advanceTimersByTime(320);
		(target.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
		window.dispatchEvent(new Event("resize"));
		expect(target.scrollIntoView).not.toHaveBeenCalled();
	});

	it("scroll event does not re-trigger scrollIntoView", async () => {
		const target = createTourTarget("health", { top: 100, left: 50, width: 200, height: 40 });
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		vi.advanceTimersByTime(320);
		(target.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
		window.dispatchEvent(new Event("scroll"));
		expect(target.scrollIntoView).not.toHaveBeenCalled();
	});

	it("scrollIntoView is called again when advancing to next step", async () => {
		const healthTarget = createTourTarget("health", { top: 100, left: 50, width: 200, height: 40 });
		const periodEl = document.createElement("div");
		periodEl.setAttribute("data-tour-target", "period");
		periodEl.className = "period-tabs";
		periodEl.getBoundingClientRect = () => ({
			top: 60,
			left: 20,
			width: 300,
			height: 36,
			right: 320,
			bottom: 96,
			x: 20,
			y: 60,
			toJSON: () => {},
		});
		periodEl.scrollIntoView = vi.fn();
		document.body.appendChild(periodEl);

		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		vi.advanceTimersByTime(320);
		expect(healthTarget.scrollIntoView).toHaveBeenCalledTimes(1);

		const nextBtn = document.querySelector(".tour-btn-next") as HTMLButtonElement;
		nextBtn.click();
		expect(periodEl.scrollIntoView).toHaveBeenCalledTimes(1);

		periodEl.remove();
	});
});

describe("Tour alignment spotlight rect", () => {
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

	it("spotlight position and size match target bounds with padding", async () => {
		const rect = { top: 120, left: 80, width: 180, height: 36 };
		createTourTarget("health", rect);
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		const spotlight = document.querySelector(".tour-spotlight") as HTMLElement;
		expect(spotlight).not.toBeNull();
		const SPOTLIGHT_PAD = 6;
		expect(spotlight.style.top).toBe(`${rect.top - SPOTLIGHT_PAD}px`);
		expect(spotlight.style.left).toBe(`${rect.left - SPOTLIGHT_PAD}px`);
		expect(spotlight.style.width).toBe(`${rect.width + SPOTLIGHT_PAD * 2}px`);
		expect(spotlight.style.height).toBe(`${rect.height + SPOTLIGHT_PAD * 2}px`);
	});
});

describe("Tour alignment computeStyle popover positioning", () => {
	it("positions popover below target when viewport has space", async () => {
		const { computeStyle } = await import("../app/components/TourPopover");
		const rect = { top: 100, left: 200, width: 150, height: 40 };
		const popoverHeight = 200;
		vi.stubGlobal("innerHeight", 800);
		vi.stubGlobal("innerWidth", 1200);
		const style = computeStyle(rect, popoverHeight);
		const GAP = 12;
		expect(style.top).toBe(rect.top + rect.height + GAP);
	});

	it("positions popover above target when no space below", async () => {
		const { computeStyle } = await import("../app/components/TourPopover");
		const rect = { top: 550, left: 200, width: 150, height: 40 };
		const popoverHeight = 200;
		vi.stubGlobal("innerHeight", 700);
		vi.stubGlobal("innerWidth", 1200);
		const style = computeStyle(rect, popoverHeight);
		const GAP = 12;
		expect(style.top).toBe(rect.top - popoverHeight - GAP);
	});

	it("clamps popover top to EDGE_PAD when above doesn't fit either", async () => {
		const { computeStyle } = await import("../app/components/TourPopover");
		const rect = { top: 50, left: 200, width: 150, height: 40 };
		const popoverHeight = 200;
		vi.stubGlobal("innerHeight", 250);
		vi.stubGlobal("innerWidth", 1200);
		const style = computeStyle(rect, popoverHeight);
		const EDGE_PAD = 8;
		expect(style.top).toBe(EDGE_PAD);
	});

	it("clamps left to EDGE_PAD when target is near left edge", async () => {
		const { computeStyle } = await import("../app/components/TourPopover");
		const rect = { top: 100, left: 10, width: 30, height: 40 };
		const popoverHeight = 200;
		vi.stubGlobal("innerHeight", 800);
		vi.stubGlobal("innerWidth", 1200);
		const style = computeStyle(rect, popoverHeight);
		const EDGE_PAD = 8;
		expect(style.left).toBe(EDGE_PAD);
	});

	it("clamps left to keep popover within right viewport edge", async () => {
		const { computeStyle } = await import("../app/components/TourPopover");
		const rect = { top: 100, left: 1100, width: 80, height: 40 };
		const popoverHeight = 200;
		vi.stubGlobal("innerHeight", 800);
		vi.stubGlobal("innerWidth", 1200);
		const POPOVER_WIDTH = 280;
		const EDGE_PAD = 8;
		const style = computeStyle(rect, popoverHeight);
		expect(style.left).toBe(1200 - POPOVER_WIDTH - EDGE_PAD);
	});
});

describe("Tour alignment popover uses measured height", () => {
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

	it("popover element has a ref for height measurement", async () => {
		createTourTarget("health", { top: 100, left: 50, width: 200, height: 40 });
		const { GuidedTour } = await import("../app/components/GuidedTour");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GuidedTour, {
				active: true,
				version: "2.0.0",
				onComplete: vi.fn(),
			}),
			container,
		);
		const popover = document.querySelector(".tour-popover--positioned") as HTMLElement;
		expect(popover).not.toBeNull();
		expect(popover.style.position).toBe("fixed");
		expect(popover.style.zIndex).toBe("10001");
	});
});

describe("Tour alignment step selectors resolve targets", () => {
	afterEach(() => {
		document.querySelectorAll("[data-tour-target]").forEach((el) => el.remove());
		document.querySelectorAll("[data-testid]").forEach((el) => el.remove());
		document.querySelectorAll("[data-section-id]").forEach((el) => el.remove());
	});

	const targetSetup: Record<string, () => HTMLElement> = {
		health: () => createTourTarget("health", { top: 0, left: 0, width: 100, height: 30 }),
		period: () => {
			const el = document.createElement("div");
			el.setAttribute("data-tour-target", "period");
			el.className = "period-tabs";
			el.getBoundingClientRect = () => ({
				top: 0,
				left: 0,
				width: 100,
				height: 30,
				right: 100,
				bottom: 30,
				x: 0,
				y: 0,
				toJSON: () => {},
			});
			document.body.appendChild(el);
			return el;
		},
		overview: () => {
			const el = document.createElement("div");
			el.setAttribute("data-section-id", "overview");
			document.body.appendChild(el);
			return el;
		},
		lists: () => {
			const el = document.createElement("div");
			el.setAttribute("data-section-id", "top-lists");
			document.body.appendChild(el);
			return el;
		},
		activity: () => {
			const el = document.createElement("div");
			el.setAttribute("data-section-id", "activity");
			document.body.appendChild(el);
			return el;
		},
		share: () => createTourTarget("share", { top: 0, left: 0, width: 100, height: 30 }),
		gear: () => createTourTarget("settings", { top: 0, left: 0, width: 100, height: 30 }),
	};

	for (const step of TOUR_STEPS) {
		it(`selector for step "${step.id}" finds its DOM target`, () => {
			const el = targetSetup[step.id]();
			const found = document.querySelector(step.selector);
			expect(found).not.toBeNull();
			el.remove();
		});
	}
});
