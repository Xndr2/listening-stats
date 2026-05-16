import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/api/lastfm-client", () => ({
	validateLastfmKey: vi.fn(),
}));

vi.mock("../shared/api/statsfm-client", () => ({
	validateUsername: vi.fn(),
}));

vi.mock("../shared/stats/statsfm-provider", () => ({
	statsfmProvider: { init: vi.fn().mockResolvedValue(undefined) },
}));

import { validateLastfmKey } from "../shared/api/lastfm-client";

const validateMock = vi.mocked(validateLastfmKey);

beforeEach(() => {
	localStorage.clear();
	validateMock.mockReset();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("Last.fm section in ProvidersTab  -  idle state", () => {
	it("renders API key input field", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm API key']");
		expect(input).not.toBeNull();
	});

	it("renders Test Connection button", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const btns = container.querySelectorAll("button");
		const testBtn = Array.from(btns).find((b) => b.textContent?.includes("Test Connection"));
		expect(testBtn).toBeDefined();
	});

	it("disables Test Connection when input is empty", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const btns = container.querySelectorAll("button.btn-primary");
		const testBtn = Array.from(btns).find((b) => b.textContent?.includes("Test Connection")) as HTMLButtonElement;
		expect(testBtn.disabled).toBe(true);
	});
});

describe("Last.fm section in ProvidersTab  -  validation flow", () => {
	it("shows success state on valid API key", async () => {
		validateMock.mockResolvedValue({ valid: true });
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm API key']") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "good-key-123" } });
		const btns = container.querySelectorAll("button.btn-primary");
		const testBtn = Array.from(btns).find((b) => b.textContent?.includes("Test Connection")) as HTMLButtonElement;
		fireEvent.click(testBtn);
		await vi.waitFor(() => {
			const status = container.querySelector("[role='status']");
			expect(status?.textContent).toContain("Connected");
		});
	});

	it("saves API key to localStorage on success", async () => {
		validateMock.mockResolvedValue({ valid: true });
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm API key']") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "good-key-123" } });
		const btns = container.querySelectorAll("button.btn-primary");
		const testBtn = Array.from(btns).find((b) => b.textContent?.includes("Test Connection")) as HTMLButtonElement;
		fireEvent.click(testBtn);
		await vi.waitFor(() => {
			expect(localStorage.getItem("listening-stats:lastfm-api-key")).toBe("good-key-123");
		});
	});

	it("shows error on invalid API key", async () => {
		validateMock.mockResolvedValue({ valid: false, reason: "invalid_key" });
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm API key']") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "bad-key" } });
		const btns = container.querySelectorAll("button.btn-primary");
		const testBtn = Array.from(btns).find((b) => b.textContent?.includes("Test Connection")) as HTMLButtonElement;
		fireEvent.click(testBtn);
		await vi.waitFor(() => {
			const error = container.querySelector("[role='alert']");
			expect(error).not.toBeNull();
			expect(error?.textContent).toContain("Invalid");
		});
	});
});

describe("Last.fm section in ProvidersTab  -  connected state", () => {
	it("renders connected state when API key exists in localStorage", async () => {
		localStorage.setItem("listening-stats:lastfm-api-key", "existing-key");
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const status = container.querySelector("[role='status']");
		expect(status?.textContent).toContain("Connected");
	});

	it("has a Disconnect button in connected state", async () => {
		localStorage.setItem("listening-stats:lastfm-api-key", "existing-key");
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const btns = container.querySelectorAll("button.btn-destructive");
		const disconnectBtn = Array.from(btns).find((b) => b.textContent?.includes("Disconnect"));
		expect(disconnectBtn).toBeDefined();
	});

	it("removes API key and returns to idle on disconnect", async () => {
		localStorage.setItem("listening-stats:lastfm-api-key", "existing-key");
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const btns = container.querySelectorAll("button.btn-destructive");
		const disconnectBtn = Array.from(btns).find((b) => b.textContent?.includes("Disconnect")) as HTMLButtonElement;
		fireEvent.click(disconnectBtn);
		await vi.waitFor(() => {
			expect(localStorage.getItem("listening-stats:lastfm-api-key")).toBeNull();
			const input = container.querySelector("input[aria-label='Last.fm API key']");
			expect(input).not.toBeNull();
		});
	});
});

describe("SettingsModal  -  no Last.fm tab", () => {
	it("SettingsTab type does not include 'lastfm'", async () => {
		const fs = await import("node:fs");
		const source = fs.readFileSync("src/app/components/settings/SettingsModal.tsx", "utf-8");
		expect(source).not.toMatch(/"lastfm"/);
	});

	it("tab list does not render a Last.fm tab", async () => {
		const fs = await import("node:fs");
		const source = fs.readFileSync("src/app/components/settings/SettingsModal.tsx", "utf-8");
		expect(source).not.toContain("LastfmTab");
	});
});
