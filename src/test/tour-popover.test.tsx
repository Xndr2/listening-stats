import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS } from "../app/tour";

describe("TourPopover", () => {
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

	it("renders step counter, label, and text for current step", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		expect(container.textContent).toContain(`Step 1 of ${TOUR_STEPS.length}`);
		expect(container.textContent).toContain(TOUR_STEPS[0].label);
		expect(container.textContent).toContain(TOUR_STEPS[0].text);
	});

	it("renders correct content for step 3 (index 2)", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 2,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		expect(container.textContent).toContain(`Step 3 of ${TOUR_STEPS.length}`);
		expect(container.textContent).toContain(TOUR_STEPS[2].label);
		expect(container.textContent).toContain(TOUR_STEPS[2].text);
	});

	it("renders dot indicators with active dot for current step", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 1,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		const dots = container.querySelectorAll(".tour-dot");
		expect(dots.length).toBe(TOUR_STEPS.length);
		expect(dots[1].classList.contains("active")).toBe(true);
		expect(dots[0].classList.contains("active")).toBe(false);
	});

	it("calls onNext when Next button is clicked", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		const onNext = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext,
				onSkip: vi.fn(),
			}),
			container,
		);
		const nextBtn = container.querySelector(".tour-btn-next") as HTMLButtonElement;
		expect(nextBtn).not.toBeNull();
		nextBtn.click();
		expect(onNext).toHaveBeenCalledOnce();
	});

	it("calls onSkip when Skip button is clicked", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		const onSkip = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip,
			}),
			container,
		);
		const skipBtn = container.querySelector(".tour-btn-skip") as HTMLButtonElement;
		expect(skipBtn).not.toBeNull();
		skipBtn.click();
		expect(onSkip).toHaveBeenCalledOnce();
	});

	it("shows 'Finish' instead of 'Next' on the last step", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: TOUR_STEPS.length - 1,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		const nextBtn = container.querySelector(".tour-btn-next") as HTMLButtonElement;
		expect(nextBtn.textContent).toBe("Finish");
	});

	it("shows 'Next' on non-last steps", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		const nextBtn = container.querySelector(".tour-btn-next") as HTMLButtonElement;
		expect(nextBtn.textContent).toBe("Next");
	});

	it("has tour-popover root class for CSS targeting", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		const popover = container.querySelector(".tour-popover");
		expect(popover).not.toBeNull();
	});

	it("shows Skip when onBack is not provided", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
			}),
			container,
		);
		expect(container.querySelector(".tour-btn-skip")).not.toBeNull();
		expect(container.querySelector(".tour-btn-back")).toBeNull();
	});

	it("shows Back instead of Skip when onBack is provided", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 1,
				onNext: vi.fn(),
				onSkip: vi.fn(),
				onBack: vi.fn(),
			}),
			container,
		);
		expect(container.querySelector(".tour-btn-back")).not.toBeNull();
		expect(container.querySelector(".tour-btn-skip")).toBeNull();
	});

	it("calls onBack when Back button is clicked", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		const onBack = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 1,
				onNext: vi.fn(),
				onSkip: vi.fn(),
				onBack,
			}),
			container,
		);
		const backBtn = container.querySelector(".tour-btn-back") as HTMLButtonElement;
		backBtn.click();
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("adds tour-popover--positioned class when targetRect is provided", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
				targetRect: { top: 100, left: 50, width: 200, height: 40 },
			}),
			container,
		);
		expect(container.querySelector(".tour-popover--positioned")).not.toBeNull();
	});

	it("does not add tour-popover--positioned when targetRect is null", async () => {
		const { TourPopover } = await import("../app/components/TourPopover");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TourPopover, {
				step: 0,
				onNext: vi.fn(),
				onSkip: vi.fn(),
				targetRect: null,
			}),
			container,
		);
		expect(container.querySelector(".tour-popover--positioned")).toBeNull();
	});
});
