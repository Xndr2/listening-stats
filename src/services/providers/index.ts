import { ProviderType } from "../../types/listeningstats";
import type { TrackingProvider } from "./types";
import { createLastfmProvider } from "./lastfm";
import { createLocalProvider } from "./local";
import { createStatsfmProvider } from "./statsfm";

const STORAGE_KEY = "listening-stats:provider";

let activeProvider: TrackingProvider | null = null;

export function getSelectedProviderType(): ProviderType | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "local" || stored === "lastfm" || stored === "statsfm") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setSelectedProviderType(type: ProviderType): void {
  localStorage.setItem(STORAGE_KEY, type);
}

export function hasExistingData(): boolean {
  return localStorage.getItem("listening-stats:pollingData") !== null;
}

export function clearProviderSelection(): void {
  if (activeProvider) {
    activeProvider.destroy();
    activeProvider = null;
  }
  localStorage.removeItem(STORAGE_KEY);
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
    case "lastfm":
      activeProvider = createLastfmProvider();
      break;
    case "local":
      activeProvider = createLocalProvider();
      break;
    case "statsfm":
      activeProvider = createStatsfmProvider();
      break;
  }

  if (!skipInit) {
    activeProvider.init();
  }
}

export type { TrackingProvider } from "./types";
