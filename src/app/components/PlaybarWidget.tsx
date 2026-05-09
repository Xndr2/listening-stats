import { db } from "../../shared/storage/db";
import { EVENTS } from "../../shared/constants/events";
import { getPreferences } from "../preferences";
import { PlayCountPill } from "./PlayCountPill";

const { React } = Spicetify;
const { useState, useEffect, useCallback } = React;

interface TrackPlayInfo {
	count: number;
	firstPlayedAt: number | null;
}

function useNowPlayingCount(): TrackPlayInfo | null {
	const [info, setInfo] = useState<TrackPlayInfo | null>(null);
	const [trackUri, setTrackUri] = useState<string | null>(
		() => Spicetify.Player.data?.item?.uri ?? null,
	);

	const lookupCount = useCallback(async (uri: string) => {
		try {
			const events = await db.playEvents.where("trackUri").equals(uri).sortBy("startedAt");
			setInfo({ count: events.length, firstPlayedAt: events[0]?.startedAt ?? null });
		} catch {
			setInfo(null);
		}
	}, []);

	useEffect(() => {
		if (trackUri) {
			lookupCount(trackUri);
		} else {
			setInfo(null);
		}
	}, [trackUri, lookupCount]);

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

	return info;
}

export function PlaybarWidget() {
	const info = useNowPlayingCount();
	const [, setPrefsVersion] = useState(0);

	useEffect(() => {
		const handler = () => setPrefsVersion((v) => v + 1);
		window.addEventListener(EVENTS.PREFS_CHANGED, handler);
		return () => window.removeEventListener(EVENTS.PREFS_CHANGED, handler);
	}, []);

	const prefs = getPreferences();

	if (!info || info.count <= 1) return null;

	return React.createElement("div", { className: "play-count-widget-anchor" },
		React.createElement(PlayCountPill, {
			count: info.count,
			variant: prefs.playCountVariant,
			firstPlayedAt: info.firstPlayedAt,
		}),
	);
}
