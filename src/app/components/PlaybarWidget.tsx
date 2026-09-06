import { fetchLastfmLifetimeTrackPlaycount, readLastfmUsername } from "../../shared/api/lastfm-track-plays";
import {
	fetchStatsFmLifetimeTrackStreams,
	fetchStatsFmPeriodTrackStreams,
	readStatsFmUsername,
} from "../../shared/api/statsfm-track-plays";
import { EVENTS } from "../../shared/constants/events";
import { STATSFM_PERIODS } from "../../shared/stats/periods";
import { providerRegistry } from "../../shared/stats/provider";
import { restorePeriodForProvider } from "../../shared/stats/provider-periods-storage";
import { db } from "../../shared/storage/db";
import { getPreferences } from "../preferences";
import { PlayCountPill } from "./PlayCountPill";

const { React } = Spicetify;
const { useState, useEffect, useCallback, useRef } = React;

interface TrackPlayInfo {
	count: number;
	firstPlayedAt: number | null;
	periodStreams?: number | null;
	periodLabel?: string | null;
}

function useNowPlayingCount(): TrackPlayInfo | null {
	const [info, setInfo] = useState<TrackPlayInfo | null>(null);
	const [trackUri, setTrackUri] = useState<string | null>(() => Spicetify.Player.data?.item?.uri ?? null);
	const [reloadKey, setReloadKey] = useState(0);
	// Generation guard: a slow stats.fm response for the previous track must not
	// overwrite the count of the track the user has already switched to.
	const generationRef = useRef(0);

	const lookupCount = useCallback(async (uri: string) => {
		const generation = ++generationRef.current;
		const commit = (value: TrackPlayInfo | null) => {
			if (generationRef.current === generation) setInfo(value);
		};
		try {
			const prefs = getPreferences();
			const events = await db.playEvents
				.where("trackUri")
				.equals(uri)
				.filter((e) => e.type !== "skip")
				.sortBy("startedAt");
			const localCount = events.length;
			const localFirst = events[0]?.startedAt ?? null;

			if (providerRegistry.getActiveId() === "statsfm") {
				const user = readStatsFmUsername();
				if (user) {
					const lifetime = await fetchStatsFmLifetimeTrackStreams(user, uri);
					let periodStreams: number | null = null;
					let periodLabel: string | null = null;
					if (prefs.playCountShowPeriodStreams) {
						const supported = providerRegistry.getActive()?.getSupportedPeriods() ?? STATSFM_PERIODS;
						if (supported.length > 0) {
							const period = restorePeriodForProvider("statsfm", supported);
							periodLabel = period.label;
							periodStreams = await fetchStatsFmPeriodTrackStreams(user, uri, period.id);
						}
					}
					const count = lifetime ?? localCount;
					const firstPlayedAt = lifetime != null ? null : localFirst;
					commit({ count, firstPlayedAt, periodStreams, periodLabel });
					return;
				}
			}

			if (providerRegistry.getActiveId() === "lastfm") {
				const username = readLastfmUsername();
				if (username) {
					const item = Spicetify.Player.data?.item;
					const trackName = item?.name as string | undefined;
					const metadata = item?.metadata as Record<string, unknown> | undefined;
					const artistName = metadata?.artist_name as string | undefined;
					if (trackName && artistName) {
						const lifetime = await fetchLastfmLifetimeTrackPlaycount(artistName, trackName);
						const count = lifetime ?? localCount;
						const firstPlayedAt = lifetime != null ? null : localFirst;
						commit({ count, firstPlayedAt, periodStreams: null, periodLabel: null });
						return;
					}
				}
			}

			commit({
				count: localCount,
				firstPlayedAt: localFirst,
				periodStreams: undefined,
				periodLabel: undefined,
			});
		} catch {
			commit(null);
		}
	}, []);

	useEffect(() => {
		if (trackUri) {
			lookupCount(trackUri);
		} else {
			// Invalidate in-flight lookups so they cannot resurrect a stale count.
			generationRef.current++;
			setInfo(null);
		}
	}, [trackUri, lookupCount, reloadKey]);

	useEffect(() => {
		const onSongChange = () => {
			const uri = Spicetify.Player.data?.item?.uri ?? null;
			setTrackUri(uri);
		};
		Spicetify.Player.addEventListener("songchange", onSongChange);
		return () => Spicetify.Player.removeEventListener("songchange", onSongChange);
	}, []);

	useEffect(() => {
		const onPlayRecorded = () => {
			if (trackUri) lookupCount(trackUri);
		};
		window.addEventListener(EVENTS.PLAY_RECORDED, onPlayRecorded);
		return () => window.removeEventListener(EVENTS.PLAY_RECORDED, onPlayRecorded);
	}, [trackUri, lookupCount]);

	useEffect(() => {
		const onProvider = () => setReloadKey((n) => n + 1);
		window.addEventListener(EVENTS.PROVIDER_CHANGED, onProvider);
		return () => window.removeEventListener(EVENTS.PROVIDER_CHANGED, onProvider);
	}, []);

	useEffect(() => {
		const onPeriod = () => setReloadKey((n) => n + 1);
		window.addEventListener(EVENTS.DASHBOARD_PERIOD_CHANGED, onPeriod);
		return () => window.removeEventListener(EVENTS.DASHBOARD_PERIOD_CHANGED, onPeriod);
	}, []);

	useEffect(() => {
		const onPrefs = () => setReloadKey((n) => n + 1);
		window.addEventListener(EVENTS.PREFS_CHANGED, onPrefs);
		return () => window.removeEventListener(EVENTS.PREFS_CHANGED, onPrefs);
	}, []);

	return info;
}

export function PlaybarWidget() {
	const info = useNowPlayingCount();

	const prefs = getPreferences();

	if (prefs.playCountVariant === "off") return null;
	if (!info) return null;

	const showFirstListen = prefs.playCountShowPeriodStreams && info.count < 1;
	if (info.count < 1 && !showFirstListen) return null;

	return React.createElement(
		"div",
		{ className: "play-count-widget-anchor" },
		React.createElement(PlayCountPill, {
			count: info.count,
			variant: prefs.playCountVariant,
			firstPlayedAt: info.firstPlayedAt,
			periodStreams: info.periodStreams ?? undefined,
			periodLabel: info.periodLabel ?? undefined,
			showFirstListen,
		}),
	);
}
