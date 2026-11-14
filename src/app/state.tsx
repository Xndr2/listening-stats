/**
 * What the dashboard is looking at: provider, period, rank mode, view.
 * Provider and rank live in settings (shared with v2); the period is
 * remembered per provider.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EVENTS, listen } from "../shared/constants/events";
import { addBreadcrumb } from "../shared/errors/log";
import { readLastFmConfig } from "../shared/providers/lastfm/client";
import {
	fromV2PeriodId,
	PERIOD_IDS,
	type PeriodId,
	type PeriodWindow,
	periodWindow,
} from "../shared/providers/periods";
import { activeProviderId, PROVIDERS } from "../shared/providers/registry";
import { readStatsFmConfig } from "../shared/providers/statsfm/client";
import type { Provider } from "../shared/providers/types";
import type { ProviderId, RankMode } from "../shared/settings/registry";
import { useSetting } from "./hooks/useSetting";

export type View = "dashboard" | "world";

interface AppState {
	provider: Provider;
	providerId: ProviderId;
	setProvider(id: ProviderId): void;
	periodId: PeriodId;
	window: PeriodWindow;
	setPeriod(id: PeriodId): void;
	rank: RankMode;
	setRank(r: RankMode): void;
	view: View;
	setView(v: View): void;
	/** Settings is a modal over whichever view is showing. */
	settingsOpen: boolean;
	setSettingsOpen(open: boolean): void;
	/** Changes whenever a different set of data should be shown; part of query keys. */
	scope: string;
	/** Provider plus connected account ("statsfm@name"); prefix of every query key. */
	source: string;
}

const Ctx = createContext<AppState | null>(null);

function sourceKey(): string {
	const id = activeProviderId();
	const account =
		id === "statsfm" ? readStatsFmConfig()?.username : id === "lastfm" ? readLastFmConfig()?.username : "";
	return account ? `${id}@${account.toLowerCase()}` : id;
}

function resolvePeriod(saved: string | undefined, provider: Provider): PeriodId {
	const id = (PERIOD_IDS as readonly string[]).includes(saved ?? "")
		? (saved as PeriodId)
		: fromV2PeriodId(saved ?? "");
	return id && provider.periods.includes(id) ? id : "this-week";
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
	const [_chosen, setChosen] = useSetting("activeProvider");
	const [periods, setPeriods] = useSetting("periodByProvider");
	const [rankSetting, setRankSetting] = useSetting("rankMode");
	const [weekStart] = useSetting("weekStart");
	const [view, setViewState] = useState<View>("dashboard");
	const [settingsOpen, setSettingsOpenState] = useState(false);
	const setSettingsOpen = useCallback((open: boolean) => {
		if (open) addBreadcrumb("settings:open");
		setSettingsOpenState(open);
	}, []);
	// Re-check connection when provider settings change (connect/disconnect).
	const [providerId, setProviderId] = useState<ProviderId>(activeProviderId);
	// Switching accounts must not show the previous account's cached results,
	// so the account name is part of every query key.
	const [source, setSource] = useState(sourceKey);
	useEffect(
		() =>
			listen(EVENTS.SETTINGS_CHANGED, () => {
				setProviderId(activeProviderId());
				setSource(sourceKey());
			}),
		[],
	);

	const provider = PROVIDERS[providerId];
	const periodId = resolvePeriod(periods[providerId], provider);
	const rank: RankMode = provider.rankByMinutes() ? rankSetting : "streams";

	// The window is recomputed once a minute so "today" rolls over at midnight
	// without a reload, but stays stable between renders.
	const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
	useEffect(() => {
		const t = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 60_000);
		return () => clearInterval(t);
	}, []);
	const win = useMemo(() => periodWindow(periodId, minute * 60_000 + 59_999, weekStart), [periodId, minute, weekStart]);

	const setProvider = useCallback(
		(id: ProviderId) => {
			addBreadcrumb(`provider:${id}`);
			setChosen(id);
		},
		[setChosen],
	);
	const setPeriod = useCallback(
		(id: PeriodId) => {
			addBreadcrumb(`period:${id}`);
			setPeriods({ ...periods, [providerId]: id });
		},
		[periods, providerId, setPeriods],
	);
	const setRank = useCallback(
		(r: RankMode) => {
			addBreadcrumb(`rank:${r}`);
			setRankSetting(r);
		},
		[setRankSetting],
	);
	const setView = useCallback((v: View) => {
		addBreadcrumb(`view:${v}`);
		setViewState(v);
	}, []);

	const value = useMemo<AppState>(
		() => ({
			provider,
			providerId,
			setProvider,
			periodId,
			window: win,
			setPeriod,
			rank,
			setRank,
			view,
			setView,
			settingsOpen,
			setSettingsOpen,
			scope: `${source}:${periodId}:${win.start}`,
			source,
		}),
		[
			provider,
			providerId,
			setProvider,
			periodId,
			win,
			setPeriod,
			rank,
			setRank,
			view,
			setView,
			source,
			settingsOpen,
			setSettingsOpen,
		],
	);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
	const v = useContext(Ctx);
	if (!v) throw new Error("useApp outside AppStateProvider");
	return v;
}
