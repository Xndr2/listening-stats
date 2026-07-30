import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InlineErrorCard } from "../app/components/InlineErrorCard";
import type { AppError } from "../shared/errors";

afterEach(() => {
	cleanup();
});

function makeError(variant: AppError["variant"], overrides: Partial<AppError> = {}): AppError {
	return { variant, message: "test", retryable: true, ...overrides };
}

describe("InlineErrorCard", () => {
	it("renders UserNotFound title and body", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("UserNotFound"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toContain("couldn't find");
		expect(container.textContent).toContain("Settings");
	});

	it("renders NetworkError title and body", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("NetworkError"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toContain("reach stats.fm");
	});

	it("renders ServiceDown title", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("ServiceDown"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toContain("having a moment");
	});

	it("renders RateLimited title", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("RateLimited", { retryable: false }),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toContain("Too many requests");
	});

	it("renders Unknown title", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("Unknown"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toContain("went sideways");
	});

	it("shows Retry button for retryable errors and calls onRetry", () => {
		const onRetry = vi.fn();
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("NetworkError", { retryable: true }),
				onRetry,
				onOpenSettings: () => {},
			}),
		);
		const btn = container.querySelector("button");
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toContain("Retry");
		btn?.click();
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("shows Open Settings button for UserNotFound and calls onOpenSettings", () => {
		const onOpenSettings = vi.fn();
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("UserNotFound", { retryable: false }),
				onRetry: () => {},
				onOpenSettings,
			}),
		);
		const btn = container.querySelector("button");
		expect(btn).not.toBeNull();
		expect(btn?.textContent).toContain("Settings");
		btn?.click();
		expect(onOpenSettings).toHaveBeenCalledOnce();
	});

	it("does not show a CTA button for RateLimited", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("RateLimited", { retryable: false }),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		const btn = container.querySelector("button");
		expect(btn).toBeNull();
	});

	it("uses dashed border styling", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("NetworkError"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		const panel = container.querySelector(".inline-error-card");
		expect(panel).not.toBeNull();
	});

	it("renders countdown when resetAt is in the future", () => {
		vi.useFakeTimers();
		vi.setSystemTime(1000000);
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("RateLimited", { retryable: false, resetAt: 1000000 + 42_000 }),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.textContent).toMatch(/0:\d{2}/);
		vi.useRealTimers();
	});

	it("has role=status for accessibility", () => {
		const { container } = render(
			React.createElement(InlineErrorCard, {
				error: makeError("Unknown"),
				onRetry: () => {},
				onOpenSettings: () => {},
			}),
		);
		expect(container.querySelector('[role="status"]')).not.toBeNull();
	});
});
