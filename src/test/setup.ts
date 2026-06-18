import "fake-indexeddb/auto";
import React from "react";
import ReactDOM from "react-dom";
import { afterEach, vi } from "vitest";
import { db } from "../shared/storage/db";

/** Re-install globals that tests may clear via `vi.unstubAllGlobals()` (e.g. fetch mocks). */
function installTestGlobals(): void {
	vi.stubGlobal("Spicetify", {
		React,
		ReactDOM,
		Player: {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			getProgress: vi.fn(() => 0),
			getDuration: vi.fn(() => 0),
			getRepeat: vi.fn(() => 0),
			data: { isPaused: false, item: null },
		},
		showNotification: vi.fn(),
		CosmosAsync: {
			request: vi.fn(),
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			del: vi.fn(),
		},
		Platform: {
			History: {
				push: vi.fn(),
				replace: vi.fn(),
				listen: vi.fn(),
				goBack: vi.fn(),
			},
			LibraryAPI: {
				contains: vi.fn(async (...uris: string[]) => uris.map(() => false)),
				add: vi.fn(async () => {}),
				remove: vi.fn(async () => {}),
			},
		},
		ReactComponent: {
			TooltipWrapper: ({ children }: { children: unknown }) => children,
			Toggle: vi.fn(({ value, onSelected }: { value: boolean; onSelected: (v: boolean) => void }) =>
				React.createElement("button", {
					type: "button",
					"data-checked": value,
					onClick: () => onSelected(!value),
				}),
			),
		},
		Locale: {
			formatNumber: vi.fn((n: number) => String(n)),
			formatRelativeTime: vi.fn((_ms: number) => "just now"),
		},
		URI: {
			from: vi.fn((uri: string) => {
				const parts = uri.split(":");
				return { type: parts[1], id: parts[2] };
			}),
		},
	});

	// jsdom lacks ResizeObserver
	class ResizeObserverMock {
		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);

	// jsdom lacks matchMedia; default matches: false (motion on). Override per test when needed.
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	);
}

installTestGlobals();

afterEach(async () => {
	await db.delete();
	await db.open();
	installTestGlobals();
});
