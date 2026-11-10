/**
 * Share a card of the current period. A native <dialog> (focus stays inside,
 * Esc closes) with a live preview on the left and every option on the right.
 * The last choices are remembered for next time.
 */
import { useEffect, useRef, useState } from "react";
import { V3_PREFIX } from "../../shared/constants/storage-keys";
import { captureError } from "../../shared/errors/capture";
import { readLastFmConfig } from "../../shared/providers/lastfm/client";
import { PERIOD_LABELS } from "../../shared/providers/periods";
import { readStatsFmConfig } from "../../shared/providers/statsfm/client";
import { supports } from "../../shared/providers/types";
import { onBackdrop } from "../components/dialog";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented/Segmented";
import { formatHour, formatListening, formatNumber, formatPercent } from "../format";
import { useSetting } from "../hooks/useSetting";
import { usePeriodQuery } from "../query/useProviderQuery";
import { Switch } from "../settings/controls";
import { useApp } from "../state";
import { type CardBackground, type CardData, type CardLayout, canvasBlob, renderCard } from "./render";
import "./Share.css";

type Content = "tracks" | "artists" | "albums" | "genres" | "stats";

interface Options {
	content: Content;
	count: number;
	layout: CardLayout;
	background: CardBackground;
	showTime: boolean;
	showCounts: boolean;
	showSource: boolean;
	title: string;
}

const KEY = `${V3_PREFIX}share-options`;
const DEFAULTS: Options = {
	content: "tracks",
	count: 5,
	layout: "story",
	background: "cover",
	showTime: true,
	showCounts: true,
	showSource: true,
	title: "",
};

function loadOptions(): Options {
	try {
		return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Options>) };
	} catch {
		return DEFAULTS;
	}
}

const HEADINGS: Record<Content, string> = {
	tracks: "My top tracks",
	artists: "My top artists",
	albums: "My top albums",
	genres: "My top genres",
	stats: "My listening",
};

/** Name for the caption: the source's username, or the Spotify display name for local data. */
function username(providerId: string, spotifyName: string | undefined): string | undefined {
	if (providerId === "statsfm") return readStatsFmConfig()?.username;
	if (providerId === "lastfm") return readLastFmConfig()?.username;
	// Platform.username is an internal account id, not something to show people.
	return spotifyName;
}

const plays = (n: number) => `${formatNumber(n)} ${n === 1 ? "play" : "plays"}`;

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const { periodId, providerId, provider } = useApp();
	const [opts, setOpts] = useState<Options>(loadOptions);
	const [caption, setCaption] = useSetting("showShareCaption");
	const [use24h] = useSetting("use24HourTime");
	const [preview, setPreview] = useState<string | null>(null);
	const [blob, setBlob] = useState<Blob | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [spotifyName, setSpotifyName] = useState<string>();
	useEffect(() => {
		const api = (Spicetify.Platform as unknown as { UserAPI?: { getUser?: () => Promise<{ displayName?: string }> } })
			?.UserAPI;
		void api
			?.getUser?.()
			.then((u) => setSpotifyName(u.displayName || undefined))
			.catch(() => {});
	}, []);
	const set = (patch: Partial<Options>) => {
		const next = { ...opts, ...patch };
		setOpts(next);
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {
			// convenience only
		}
	};

	const c = opts.content;
	const summary = usePeriodQuery("summary", 10, open);
	const hourly = usePeriodQuery("hourly", 10, open && c === "stats");
	const tracks = usePeriodQuery("topTracks", 10, open && c === "tracks");
	const artists = usePeriodQuery("topArtists", 10, open && c === "artists");
	const albums = usePeriodQuery("topAlbums", 10, open && c === "albums");
	const genres = usePeriodQuery("topGenres", 10, open && c === "genres");

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) d.showModal();
		if (!open && d.open) d.close();
	}, [open]);

	const s = summary.data;
	const counts = opts.showCounts && provider.perItemCounts();
	let items: CardData["items"] | undefined;
	if (c === "tracks")
		items = tracks.data?.map((x) => ({
			title: x.name,
			subtitle: x.artistName,
			image: x.image,
			value: counts && x.count !== undefined ? plays(x.count) : "",
		}));
	if (c === "artists")
		items = artists.data?.map((x) => ({
			title: x.name,
			subtitle: x.genres?.[0] ?? "",
			image: x.image,
			value: counts && x.count !== undefined ? plays(x.count) : "",
		}));
	if (c === "albums")
		items = albums.data?.map((x) => ({
			title: x.name,
			subtitle: x.artistName,
			image: x.image,
			value: counts && x.count !== undefined ? plays(x.count) : "",
		}));
	if (c === "genres") items = genres.data?.map((x) => ({ title: x.name, subtitle: formatPercent(x.share), value: "" }));
	const ready = c === "stats" ? !!s : !!items;

	useEffect(() => {
		if (!open || !ready) return;
		let live = true;
		const stats: CardData["stats"] =
			c === "stats" && s
				? [
						{ label: "Plays", value: formatNumber(s.plays) },
						...(s.uniqueArtists !== undefined ? [{ label: "Artists", value: formatNumber(s.uniqueArtists) }] : []),
						...(s.uniqueTracks !== undefined ? [{ label: "Tracks", value: formatNumber(s.uniqueTracks) }] : []),
						...(s.streak ? [{ label: "Streak", value: `${s.streak} days` }] : []),
						...(hourly.data?.counts.some((x) => x > 0)
							? [
									{
										label: "Peak hour",
										value: formatHour(hourly.data.counts.indexOf(Math.max(...hourly.data.counts)), use24h),
									},
								]
							: []),
						...(s.topGenre ? [{ label: "Top genre", value: s.topGenre.name }] : []),
					].slice(0, 6)
				: undefined;
		const data: CardData = {
			heading: opts.title.trim() || HEADINGS[c],
			period: PERIOD_LABELS[periodId],
			hero:
				opts.showTime || c === "stats"
					? s?.durationMs
						? formatListening(s.durationMs)
						: s
							? plays(s.plays)
							: undefined
					: undefined,
			heroLabel: s?.durationMs ? "of music" : "",
			items: (items ?? []).slice(0, opts.count),
			stats,
			textOnly: c === "genres",
			caption: caption && username(providerId, spotifyName) ? `@${username(providerId, spotifyName)}` : undefined,
			footer: opts.showSource && provider.id !== "local" ? `via ${provider.name}` : undefined,
		};
		const accent = getComputedStyle(document.documentElement).getPropertyValue("--spice-button").trim() || "#1db954";
		void renderCard(data, opts.layout, opts.background, accent)
			.then(canvasBlob)
			.then((b) => {
				if (!live) return;
				setBlob(b);
				setPreview((old) => {
					if (old) URL.revokeObjectURL(old);
					return URL.createObjectURL(b);
				});
			})
			.catch((e) => {
				void captureError(e, "app", "handled", "share");
				if (live) setStatus("Couldn't draw the card.");
			});
		return () => {
			live = false;
		};
	}, [open, ready, items, s, hourly.data, opts, c, caption, periodId, provider, providerId, use24h, spotifyName]);

	const copy = async () => {
		if (!blob) return;
		try {
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
			setStatus("Copied. Paste it anywhere.");
		} catch {
			setStatus("Copying images isn't allowed here. Save it instead.");
		}
	};

	const save = () => {
		if (!preview) return;
		const a = document.createElement("a");
		a.href = preview;
		a.download = `listening-stats-${c}-${periodId}.png`;
		a.click();
	};

	const contentOptions = (
		[
			{ value: "tracks", label: "Tracks", q: "topTracks" },
			{ value: "artists", label: "Artists", q: "topArtists" },
			{ value: "albums", label: "Albums", q: "topAlbums" },
			{ value: "genres", label: "Genres", q: "topGenres" },
			{ value: "stats", label: "Stats", q: "summary" },
		] as const
	).filter((o) => supports(provider, o.q));

	return (
		<dialog
			ref={ref}
			className="ls-share"
			onClose={onClose}
			onCancel={onClose}
			onClick={(e) => onBackdrop(e) && onClose()}
			aria-labelledby="ls-share-title"
		>
			<div className="ls-share-head">
				<h2 id="ls-share-title">Share</h2>
				<button type="button" className="ls-icon-btn" aria-label="Close" onClick={onClose}>
					<Icon name="close" />
				</button>
			</div>
			<div className="ls-share-body">
				<div className={`ls-share-preview is-${opts.layout}`}>
					{preview ? <img src={preview} alt="Preview of the share card" /> : <div className="ls-skel" />}
				</div>
				<div className="ls-share-controls">
					<label className="ls-share-field">
						<span className="ls-set-label">Title</span>
						<input
							className="ls-input"
							value={opts.title}
							placeholder={HEADINGS[c]}
							maxLength={40}
							onChange={(e) => set({ title: e.target.value })}
						/>
					</label>
					<div className="ls-share-field">
						<span className="ls-set-label">Show</span>
						<Segmented
							size="sm"
							label="Show"
							value={c}
							onChange={(v) => set({ content: v })}
							options={contentOptions.map(({ value, label }) => ({ value, label }))}
						/>
					</div>
					{c !== "stats" && (
						<div className="ls-share-field">
							<span className="ls-set-label">How many</span>
							<Segmented
								size="sm"
								label="How many"
								value={String(opts.count)}
								onChange={(v) => set({ count: Number(v) })}
								options={["3", "5", "10"].map((v) => ({ value: v, label: v }))}
							/>
						</div>
					)}
					<div className="ls-share-field">
						<span className="ls-set-label">Shape</span>
						<Segmented
							size="sm"
							label="Shape"
							value={opts.layout}
							onChange={(v) => set({ layout: v })}
							options={[
								{ value: "story", label: "Story" },
								{ value: "square", label: "Square" },
								{ value: "wide", label: "Wide" },
							]}
						/>
					</div>
					<div className="ls-share-field">
						<span className="ls-set-label">Background</span>
						<Segmented
							size="sm"
							label="Background"
							value={opts.background}
							onChange={(v) => set({ background: v })}
							options={[
								{ value: "cover", label: "From cover" },
								{ value: "dark", label: "Dark" },
								{ value: "light", label: "Light" },
								{ value: "accent", label: "Accent" },
							]}
						/>
					</div>
					<div className="ls-share-toggles">
						<div className="ls-share-toggle">
							<span>Listening time</span>
							<Switch label="Show listening time" checked={opts.showTime} onChange={(v) => set({ showTime: v })} />
						</div>
						{provider.perItemCounts() && (
							<div className="ls-share-toggle">
								<span>Play counts</span>
								<Switch label="Show play counts" checked={opts.showCounts} onChange={(v) => set({ showCounts: v })} />
							</div>
						)}
						<div className="ls-share-toggle">
							<span>Username</span>
							<Switch label="Show username" checked={caption} onChange={setCaption} />
						</div>
						{provider.id !== "local" && (
							<div className="ls-share-toggle">
								<span>Data source</span>
								<Switch label="Show data source" checked={opts.showSource} onChange={(v) => set({ showSource: v })} />
							</div>
						)}
					</div>
					<div className="ls-share-actions">
						<button type="button" className="ls-btn-primary" disabled={!blob} onClick={() => void copy()}>
							Copy image
						</button>
						<button type="button" className="ls-btn-secondary" disabled={!blob} onClick={save}>
							Save PNG
						</button>
					</div>
					{status && <p className="ls-set-msg">{status}</p>}
				</div>
			</div>
		</dialog>
	);
}
