import { LS_KEYS } from "../constants/storage-keys";
import type { Period } from "../types/stats";

export function safeParseProviderPeriods(): Record<string, string> {
	try {
		const raw = localStorage.getItem(LS_KEYS.PROVIDER_PERIODS);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, string>;
		}
		return {};
	} catch {
		return {};
	}
}

export function restorePeriodForProvider(providerId: string, supported: Period[]): Period {
	const savedId = safeParseProviderPeriods()[providerId];
	if (savedId) {
		const match = supported.find((p) => p.id === savedId);
		if (match) return match;
	}
	return supported[0];
}

export function savePeriodForProvider(providerId: string, periodId: string): void {
	const map = safeParseProviderPeriods();
	map[providerId] = periodId;
	localStorage.setItem(LS_KEYS.PROVIDER_PERIODS, JSON.stringify(map));
}
