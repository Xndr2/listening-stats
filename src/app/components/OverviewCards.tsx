import type { ProviderCapabilities } from "../../shared/stats/provider";

export function filterOverviewCards(
	allCards: Array<{ label: string; value: string; tooltip: string; localOnly?: boolean }>,
	capabilities: ProviderCapabilities,
): Array<{ label: string; value: string; tooltip: string; localOnly?: boolean }> {
	const isLocal = capabilities.tier === "n/a";
	return allCards.filter((c) => isLocal || !c.localOnly);
}
