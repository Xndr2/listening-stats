import { EVENTS } from "../../shared/constants/events";
import { providerRegistry } from "../../shared/stats/provider";
import type { StatsResult } from "../../shared/types/stats";
import type { RecapSource } from "../recap";
import { dismissRecap, getRecapSource, isRecapDismissed, loadRecapStats } from "../recap";

const { useState, useEffect, useCallback, useRef } = Spicetify.React;

export interface RecapOffer {
	source: RecapSource;
	stats: StatsResult;
}

/**
 * Monthly recap: offers a banner once per month when last month has plays, and
 * serves the Settings > Display "Preview recap" event.
 */
export function useRecapOffer(initialized: boolean, stats: StatsResult | null) {
	const [recapOffer, setRecapOffer] = useState<RecapOffer | null>(null);
	const [showRecap, setShowRecap] = useState(false);
	const recapCheckedRef = useRef(false);

	useEffect(() => {
		// Wait for the dashboard's own load to finish (stats non-null) so the recap
		// computation hits the provider's stats cache instead of racing the initial
		// API burst - a concurrent duplicate load can trip stats.fm rate limits.
		if (!initialized || !stats || recapCheckedRef.current) return;
		recapCheckedRef.current = true;
		const source = getRecapSource(providerRegistry.getActiveId() ?? "local");
		if (isRecapDismissed(source.monthKey)) return;
		const provider = providerRegistry.getActive();
		if (!provider) return;
		loadRecapStats(provider, source)
			.then((recapStats) => {
				if (recapStats) setRecapOffer({ source, stats: recapStats });
			})
			.catch(() => {});
	}, [initialized, stats]);

	// Settings > Display "Preview recap" hook - always recomputes and opens the modal.
	useEffect(() => {
		const handler = () => {
			const source = getRecapSource(providerRegistry.getActiveId() ?? "local");
			const provider = providerRegistry.getActive();
			if (!provider) return;
			loadRecapStats(provider, source)
				.then((recapStats) => {
					if (recapStats) {
						setRecapOffer({ source, stats: recapStats });
						setShowRecap(true);
					} else {
						Spicetify.showNotification("No plays recorded for last month yet.");
					}
				})
				.catch(() => Spicetify.showNotification("Could not load recap stats.", true));
		};
		window.addEventListener(EVENTS.OPEN_RECAP, handler);
		return () => window.removeEventListener(EVENTS.OPEN_RECAP, handler);
	}, []);

	const dismissOffer = useCallback(() => {
		if (recapOffer) dismissRecap(recapOffer.source.monthKey);
		setRecapOffer(null);
	}, [recapOffer]);

	return { recapOffer, showRecap, setShowRecap, dismissOffer };
}
