import { cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../shared/api/lastfm-client", () => ({
	lastfmGetUserInfo: vi.fn(),
}));

vi.mock("../shared/stats/lastfm-provider", () => {
	const mockProvider = {
		init: vi.fn().mockResolvedValue(undefined),
		getProviderInfo: () => ({
			id: "lastfm",
			name: "Last.fm",
			description: "Use your Last.fm account",
			capabilities: {
				hasActivityData: true,
				hasGenreData: true,
				hasStreakData: true,
				hasSkipRate: false,
				tier: "free" as const,
			},
		}),
		getSupportedPeriods: () => [],
		calculateStats: vi.fn(),
		destroy: vi.fn(),
	};
	return { lastfmProvider: mockProvider };
});

vi.mock("../shared/api/statsfm-client", () => ({
	validateUsername: vi.fn(),
}));

vi.mock("../shared/stats/statsfm-provider", () => ({
	statsfmProvider: { init: vi.fn().mockResolvedValue(undefined) },
}));

import { lastfmGetUserInfo } from "../shared/api/lastfm-client";
import { LS_KEYS } from "../shared/constants/storage-keys";
import { lastfmProvider } from "../shared/stats/lastfm-provider";
import { localProvider } from "../shared/stats/local-provider";
import { providerRegistry } from "../shared/stats/provider";

const getInfoMock = vi.mocked(lastfmGetUserInfo);

beforeEach(() => {
	localStorage.clear();
	getInfoMock.mockReset();
	providerRegistry._resetForTesting();
	providerRegistry.register(localProvider);
	providerRegistry.register(lastfmProvider);
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

function getLastfmSection(container: HTMLElement): HTMLElement | null {
	const headings = container.querySelectorAll("h3");
	for (const h of headings) {
		if (h.textContent === "Last.fm Account") {
			const el = h.nextElementSibling;
			if (el instanceof HTMLElement) return el;
		}
	}
	return null;
}

describe("Last.fm section in ProvidersTab  -  idle state", () => {
	it("renders username input field", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm username']");
		expect(input).not.toBeNull();
	});

	it("renders API key input field", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const input = container.querySelector("input[aria-label='Last.fm provider API key']");
		expect(input).not.toBeNull();
	});

	it("renders Connect Account button in idle Last.fm section", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container);
		expect(lfmSection).not.toBeNull();
		const connectBtn = lfmSection!.querySelector("button.btn-primary");
		expect(connectBtn).not.toBeNull();
		expect(connectBtn?.textContent).toBe("Connect Account");
	});

	it("disables Connect Account when inputs are empty", async () => {
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container);
		const connectBtn = lfmSection!.querySelector("button.btn-primary") as HTMLButtonElement;
		expect(connectBtn.disabled).toBe(true);
	});
});

describe("Last.fm section in ProvidersTab  -  connection flow", () => {
	it("shows connected state on valid connection", async () => {
		getInfoMock.mockResolvedValue({ username: "testuser", totalScrobbles: 1000, registered: "2020-01-01" });
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm username']")!, {
			target: { value: "testuser" },
		});
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm provider API key']")!, {
			target: { value: "valid-key" },
		});
		fireEvent.click(lfmSection.querySelector("button.btn-primary")!);
		await vi.waitFor(() => {
			const config = localStorage.getItem(LS_KEYS.LASTFM_CONFIG);
			expect(config).not.toBeNull();
			expect(JSON.parse(config!).username).toBe("testuser");
		});
	});

	it("saves config to localStorage on success", async () => {
		getInfoMock.mockResolvedValue({ username: "testuser", totalScrobbles: 1000, registered: "2020-01-01" });
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm username']")!, {
			target: { value: "testuser" },
		});
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm provider API key']")!, {
			target: { value: "valid-key" },
		});
		fireEvent.click(lfmSection.querySelector("button.btn-primary")!);
		await vi.waitFor(() => {
			const configStr = localStorage.getItem(LS_KEYS.LASTFM_CONFIG);
			expect(configStr).not.toBeNull();
			const config = JSON.parse(configStr!);
			expect(config.apiKey).toBe("valid-key");
			expect(config.username).toBe("testuser");
		});
	});

	it("shows error on failed connection", async () => {
		getInfoMock.mockRejectedValue(new Error("Invalid Last.fm API key"));
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm username']")!, {
			target: { value: "testuser" },
		});
		fireEvent.change(lfmSection.querySelector("input[aria-label='Last.fm provider API key']")!, {
			target: { value: "bad-key" },
		});
		fireEvent.click(lfmSection.querySelector("button.btn-primary")!);
		await vi.waitFor(() => {
			const error = container.querySelector("[role='alert']");
			expect(error).not.toBeNull();
		});
	});
});

describe("Last.fm section in ProvidersTab  -  connected state", () => {
	function renderConnected() {
		localStorage.setItem(LS_KEYS.LASTFM_CONFIG, JSON.stringify({ apiKey: "existing-key", username: "testuser" }));
	}

	it("renders connected state when config exists in localStorage", async () => {
		renderConnected();
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		const sublabel = lfmSection.querySelector(".settings-sublabel");
		expect(sublabel?.textContent).toContain("Last.fm API key is configured");
	});

	it("has a Disconnect button in connected state", async () => {
		renderConnected();
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		const disconnectBtn = lfmSection.querySelector("button.btn-destructive");
		expect(disconnectBtn).not.toBeNull();
		expect(disconnectBtn?.textContent).toBe("Disconnect");
	});

	it("removes config and returns to idle on disconnect", async () => {
		renderConnected();
		const { ProvidersTab } = await import("../app/components/settings/ProvidersTab");
		const { container } = render(React.createElement(ProvidersTab));
		const lfmSection = getLastfmSection(container)!;
		const disconnectBtn = lfmSection.querySelector("button.btn-destructive") as HTMLButtonElement;
		fireEvent.click(disconnectBtn);
		await vi.waitFor(() => {
			expect(localStorage.getItem(LS_KEYS.LASTFM_CONFIG)).toBeNull();
			const usernameInput = container.querySelector("input[aria-label='Last.fm username']");
			expect(usernameInput).not.toBeNull();
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
