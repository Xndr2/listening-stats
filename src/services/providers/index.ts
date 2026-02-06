import { ProviderType } from "../../types/listeningstats";
import type { TrackingProvider } from "./types";
import { createSpotifyProvider } from "./spotify";
import { createLastfmProvider } from "./lastfm";
import { createLocalProvider } from "./local";

const STORAGE_KEY = "listening-stats:provider";

let activeProvider: TrackingProvider | null = null;

export function getSelectedProviderType(): ProviderType | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "local" || stored === "spotify" || stored === "lastfm") {
      return stored;
    }
  } catch { /* ignore */ }
  return null;
}

export function setSelectedProviderType(type: ProviderType): void {
  localStorage.setItem(STORAGE_KEY, type);
}

export function hasExistingData(): boolean {
  return localStorage.getItem("listening-stats:pollingData") !== null;
}

export function getActiveProvider(): TrackingProvider | null {
  return activeProvider;
}

export function activateProvider(type: ProviderType, skipInit = false): void {
  if (activeProvider) {
    if (!skipInit) activeProvider.destroy();
    activeProvider = null;
  }

  setSelectedProviderType(type);

  switch (type) {
    case "spotify":
      activeProvider = createSpotifyProvider();
      break;
    case "lastfm":
      activeProvider = createLastfmProvider();
      break;
    case "local":
      activeProvider = createLocalProvider();
      break;
  }

  if (!skipInit) {
    activeProvider.init();
  }
}

export type { TrackingProvider } from "./types";
