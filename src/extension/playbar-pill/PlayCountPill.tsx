/**
 * "Played 12 times" next to the song in Spotify's player bar, from the
 * active data source. Lives in the extension so it works on every page.
 */
import { EVENTS, listen } from "../../shared/constants/events";
import { PERIOD_LABELS, type PeriodId, periodWindow } from "../../shared/providers/periods";
import { activeProviderId, PROVIDERS } from "../../shared/providers/registry";
import { getSetting, onSettingChange } from "../../shared/settings/registry";

interface Counts {
	total: number | null;
	period: number | null;
	periodLabel: string;
}

const cache = new Map<string, { at: number; value: Counts }>();
const TTL = 5 * 60_000;

function currentTrack() {
	const item = Spicetify.Player.data?.item;
	if (!item?.uri?.startsWith("spotify:track:")) return null;
	return { uri: item.uri, name: item.name, artistName: item.metadata?.artist_name ?? "" };
}

async function load(track: { uri: string; name: string; artistName: string }): Promise<Counts | null> {
	const id = activeProviderId();
	const p = PROVIDERS[id];
	if (!p.playCount) return null;
	const showPeriod = getSetting("playCountShowPeriod");
	const saved = getSetting("periodByProvider")[id] as PeriodId | undefined;
	const periodId: PeriodId = saved && saved !== "all-time" && p.periods.includes(saved) ? saved : "this-month";
	const key = `${id}:${track.uri}:${showPeriod ? periodId : ""}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < TTL) return hit.value;
	const [total, period] = await Promise.all([
		p.playCount({ track }).catch(() => null),
		showPeriod
			? p.playCount({ track, window: periodWindow(periodId, Date.now(), getSetting("weekStart")) }).catch(() => null)
			: null,
	]);
	const value = { total, period, periodLabel: PERIOD_LABELS[periodId].toLowerCase() };
	cache.set(key, { at: Date.now(), value });
	return value;
}

function label(c: Counts): string {
	if (c.total === 0) return "First time";
	const total = `${c.total} ${c.total === 1 ? "play" : "plays"}`;
	return c.period !== null ? `${total} · ${c.period} ${c.periodLabel}` : total;
}

export function PlayCountPill() {
	// Read at render time: extension.js runs before Spicetify.React exists, so the
	// extension bundle must never import from "react" at module level.
	const { useEffect, useState } = Spicetify.React;
	const [variant, setVariant] = useState(() => getSetting("playCountVariant"));
	const [counts, setCounts] = useState<Counts | null>(null);
	const [tick, setTick] = useState(0);

	useEffect(() => onSettingChange("playCountVariant", setVariant), []);
	useEffect(() => {
		const bump = () => setTick((n) => n + 1);
		Spicetify.Player.addEventListener("songchange", bump);
		// At startup the player may not know the current track yet, and a paused
		// player sends no songchange; retry until it does.
		const wait = setInterval(() => {
			if (currentTrack()) {
				clearInterval(wait);
				bump();
			}
		}, 1000);
		setTimeout(() => clearInterval(wait), 60_000);
		const offPlay = listen(EVENTS.PLAY_RECORDED, () => {
			cache.clear();
			bump();
		});
		const offSettings = listen(EVENTS.SETTINGS_CHANGED, () => {
			cache.clear();
			bump();
		});
		return () => {
			clearInterval(wait);
			Spicetify.Player.removeEventListener("songchange", bump);
			offPlay();
			offSettings();
		};
	}, []);

	// `tick` is the trigger: it changes on song change and when data or settings change.
	useEffect(() => {
		let live = true;
		const track = currentTrack();
		setCounts(null);
		if (!track || variant === "off") return;
		void load(track).then((c) => {
			if (live) setCounts(c);
		});
		return () => {
			live = false;
		};
	}, [tick, variant]);

	if (variant === "off" || !counts || counts.total === null) return null;
	const text = label(counts);
	return (
		<span className={`ls-pill ls-pill-${variant}`} title={`Listening Stats: ${text}`}>
			{variant === "bubble" ? (counts.total === 0 ? "New" : counts.total) : text}
		</span>
	);
}
