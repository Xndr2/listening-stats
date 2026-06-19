import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../app/components/ErrorBoundary";

function Bomb(): never {
	throw new Error("kaboom");
}

function renderInto(element: React.ReactElement): HTMLDivElement {
	const container = document.createElement("div");
	document.body.appendChild(container);
	Spicetify.ReactDOM.render(element, container);
	return container;
}

describe("ErrorBoundary", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders children when nothing throws", () => {
		const container = renderInto(
			<ErrorBoundary>
				<div data-testid="child">ok</div>
			</ErrorBoundary>,
		);
		expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
	});

	it("catches a render error and shows the fallback with the message", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const container = renderInto(
			<ErrorBoundary appVersion="9.9.9">
				<Bomb />
			</ErrorBoundary>,
		);
		consoleSpy.mockRestore();

		const alert = container.querySelector('[role="alert"]');
		expect(alert).not.toBeNull();
		expect(alert?.textContent).toContain("kaboom");
		expect(alert?.textContent).toContain("Copy error details");
	});

	it("renders nothing in silent mode", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const container = renderInto(
			<ErrorBoundary silent>
				<Bomb />
			</ErrorBoundary>,
		);
		consoleSpy.mockRestore();

		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(container.textContent).toBe("");
	});
});
