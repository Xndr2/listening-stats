import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localProvider } from "../shared/stats/local-provider";
import { providerRegistry } from "../shared/stats/provider";
import type { Period } from "../shared/types/stats";

// Build minimal mock periods (the component only needs id/label/getBoundaries).
const mockPeriods: Period[] = [
	{
		id: "today",
		label: "Today",
		getBoundaries: () => ({ start: 0, end: Date.now() }),
	} as unknown as Period,
	{
		id: "week",
		label: "This Week",
		getBoundaries: () => ({ start: 0, end: Date.now() }),
	} as unknown as Period,
];

describe("Header period tabs slot", () => {
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

	it("renders <PeriodTabs> when periods/activePeriod/onPeriodChange props are all supplied", async () => {
		const Header = (await import("../app/components/Header")).default;
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "Local",
				activeProviderId: "local",
				onSettingsClick: vi.fn(),
				periods: mockPeriods,
				activePeriod: mockPeriods[0],
				onPeriodChange: vi.fn(),
			}),
			container,
		);
		// PeriodTabs renders one button per period with class `.period-tab` (verify
		// by reading PeriodTabs.tsx if class differs).
		const tabs = container.querySelectorAll(".period-tab");
		expect(tabs.length).toBe(mockPeriods.length);
	});

	it("does NOT render <PeriodTabs> when period props are absent (back-compat)", async () => {
		const Header = (await import("../app/components/Header")).default;
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "Local",
				activeProviderId: "local",
				onSettingsClick: vi.fn(),
				// periods, activePeriod, onPeriodChange intentionally omitted
			}),
			container,
		);
		const tabs = container.querySelectorAll(".period-tab");
		expect(tabs.length).toBe(0);
	});

	it("calls onPeriodChange when a non-active period tab is clicked", async () => {
		const Header = (await import("../app/components/Header")).default;
		const onPeriodChange = vi.fn();
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(Header, {
				providerName: "Local",
				activeProviderId: "local",
				onSettingsClick: vi.fn(),
				periods: mockPeriods,
				activePeriod: mockPeriods[0],
				onPeriodChange,
			}),
			container,
		);
		const tabs = container.querySelectorAll<HTMLElement>(".period-tab");
		// Find a non-active tab and click it.
		const nonActiveTab = Array.from(tabs).find((t) => !t.classList.contains("active"));
		expect(nonActiveTab).toBeDefined();
		nonActiveTab?.click();
		expect(onPeriodChange).toHaveBeenCalledTimes(1);
		expect(onPeriodChange).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
	});
});
