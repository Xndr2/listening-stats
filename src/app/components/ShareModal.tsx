import { LS_KEYS } from "../../shared/constants/storage-keys";
import { hydrateShareCardAssets } from "../../shared/share/hydrate-share-assets";
import { providerRegistry } from "../../shared/stats/provider";
import type { Period, StatsResult, TopArtist, TopGenre, TopTrack } from "../../shared/types/stats";
import { normalizeSpotifyImageUrl } from "../../shared/util/spotify-image-url";
import { formatHour, formatNumber } from "../format";
import { CloseIcon } from "../icons";

const { useState, useCallback, useEffect, useMemo } = Spicetify.React;

export type ShareVariant = "top5" | "time" | "genre" | "streak" | "throwback" | "wrapped";
type ShareSize = "square" | "story";

interface ShareModalProps {
	stats: StatsResult;
	activePeriod: Period;
	onClose: () => void;
	initialVariant?: ShareVariant;
}

interface ShareRenderOptions {
	followTheme?: boolean;
	showUsername?: boolean;
	showPeriodLabel?: boolean;
	activeProviderId?: string;
	periodDayCount?: number;
}

const VARIANTS: { id: ShareVariant; label: string }[] = [
	{ id: "top5", label: "Top 5" },
	{ id: "time", label: "Total time" },
	{ id: "genre", label: "Genre" },
	{ id: "streak", label: "Streak" },
	{ id: "throwback", label: "Throwback" },
	{ id: "wrapped", label: "Wrapped" },
];

const SIZES: { id: ShareSize; label: string }[] = [
	{ id: "square", label: "Square" },
	{ id: "story", label: "Story" },
];

const TARGET_DIMENSIONS: Record<ShareSize, { width: number; height: number }> = {
	square: { width: 1080, height: 1080 },
	story: { width: 1080, height: 1920 },
};

function getShareCaptionHandle(): string {
	try {
		const raw = localStorage.getItem(LS_KEYS.STATSFM_CONFIG);
		if (raw) {
			const config = JSON.parse(raw) as { username?: string };
			const u = config?.username;
			if (u && String(u).trim()) return String(u).trim();
		}
	} catch {
		/* ignore */
	}
	const u = Spicetify.User?.username;
	if (u && String(u).trim()) return String(u).trim();
	return "";
}

export function ShareModal({ stats, activePeriod, onClose, initialVariant }: ShareModalProps) {
	const [variant, setVariant] = useState<ShareVariant>(initialVariant ?? "top5");
	const [size, setSize] = useState<ShareSize>("square");
	const [followTheme, setFollowTheme] = useState(false);
	const [showUsername, setShowUsername] = useState(true);
	const [showPeriodLabel, setShowPeriodLabel] = useState(true);
	const [busy, setBusy] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string>("");
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	const Toggle = Spicetify.ReactComponent.Toggle;
	const username = getShareCaptionHandle();
	const periodLabel = activePeriod.label;
	const periodBoundaries = activePeriod.getBoundaries();
	const periodDayCount = Math.max(1, Math.round((periodBoundaries.end - periodBoundaries.start) / 86_400_000));
	const activeProviderId = providerRegistry.getActiveId() ?? "local";
	const caps = providerRegistry.getActive()?.getProviderInfo().capabilities;
	const availableVariants = useMemo(() => {
		return VARIANTS.filter((v) => {
			if (v.id === "genre") {
				if (activeProviderId === "local") return false;
				if (!caps?.hasGenreData) return false;
			}
			if (v.id === "streak" && !caps?.hasStreakData) return false;
			return true;
		});
	}, [caps, activeProviderId]);

	useEffect(() => {
		if (!availableVariants.some((v) => v.id === variant)) {
			setVariant(availableVariants[0]?.id ?? "top5");
		}
	}, [availableVariants, variant]);

	useEffect(() => {
		let canceled = false;
		let currentUrl = "";
		const renderPreview = async () => {
			setPreviewLoading(true);
			setPreviewError(null);
			try {
				const blob = await renderShareCardBlob(stats, variant, size, periodLabel, username, {
					followTheme,
					showUsername,
					showPeriodLabel,
					activeProviderId,
					periodDayCount,
				});
				if (canceled) return;
				currentUrl = URL.createObjectURL(blob);
				setPreviewUrl(currentUrl);
			} catch {
				if (!canceled) setPreviewError("Could not render preview");
			} finally {
				if (!canceled) setPreviewLoading(false);
			}
		};
		renderPreview();
		return () => {
			canceled = true;
			if (currentUrl) URL.revokeObjectURL(currentUrl);
		};
	}, [
		stats,
		variant,
		size,
		periodLabel,
		username,
		followTheme,
		showUsername,
		showPeriodLabel,
		activeProviderId,
		periodDayCount,
	]);

	const handleVariantChange = (v: ShareVariant) => setVariant(v);

	const handleOverlayClick = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).classList.contains("share-overlay")) {
				onClose();
			}
		},
		[onClose],
	);

	const handleDownload = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		try {
			await exportShareCardPng(stats, variant, size, periodLabel, username, {
				followTheme,
				showUsername,
				showPeriodLabel,
				activeProviderId,
				periodDayCount,
			});
			Spicetify.showNotification("Share card downloaded!");
		} catch {
			Spicetify.showNotification("Could not export share card.", true);
		} finally {
			setBusy(false);
		}
	}, [
		stats,
		variant,
		size,
		periodLabel,
		username,
		followTheme,
		showUsername,
		showPeriodLabel,
		activeProviderId,
		periodDayCount,
		busy,
	]);

	const handleCopy = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		try {
			await copyShareCardToClipboard(stats, variant, size, periodLabel, username, {
				followTheme,
				showUsername,
				showPeriodLabel,
				activeProviderId,
				periodDayCount,
			});
			Spicetify.showNotification("Copied to clipboard!");
		} catch {
			Spicetify.showNotification("Could not copy share card.", true);
		} finally {
			setBusy(false);
		}
	}, [
		stats,
		variant,
		size,
		periodLabel,
		username,
		followTheme,
		showUsername,
		showPeriodLabel,
		activeProviderId,
		periodDayCount,
		busy,
	]);

	return Spicetify.ReactDOM.createPortal(
		<div className="share-overlay" onClick={handleOverlayClick}>
			<div className="share-modal">
				<div className="share-modal-header">
					<h2 className="share-modal-title">Share Cards</h2>
					<button
						type="button"
						className="share-modal-close stats-header-icon-btn"
						onClick={onClose}
						aria-label="Close share modal"
						dangerouslySetInnerHTML={{ __html: CloseIcon }}
					/>
				</div>

				<div className="share-control-group">
					<div className="share-control-label">Card type</div>
					<div className="share-tabs-row">
						{availableVariants.map((v) => (
							<button
								type="button"
								key={v.id}
								className={`share-variant-tab${variant === v.id ? " active" : ""}`}
								onClick={() => handleVariantChange(v.id)}
							>
								{v.label}
							</button>
						))}
					</div>
				</div>

				<div className="share-control-group">
					<div className="share-control-label">Layout</div>
					<div className="share-tabs-row">
						{SIZES.map((s) => (
							<button
								type="button"
								key={s.id}
								className={`share-size-tab${size === s.id ? " active" : ""}`}
								onClick={() => setSize(s.id)}
							>
								{s.label}
							</button>
						))}
					</div>
				</div>

				<div className="share-control-row">
					<span style={{ fontSize: 12, color: "var(--spice-text)" }}>Follow theme</span>
					<Toggle value={followTheme} onSelected={setFollowTheme} />
				</div>

				<div className="share-preview-container">
					{previewLoading && <div className="share-preview-status">Rendering preview…</div>}
					{previewError && <div className="share-preview-status">{previewError}</div>}
					{!!previewUrl && !previewLoading && (
						<img
							src={previewUrl}
							alt="Share card preview"
							className="share-preview-image"
							data-testid="share-card-preview-image"
						/>
					)}
				</div>

				<div className="share-actions">
					<button
						type="button"
						className="btn-primary share-action-btn"
						data-testid="share-copy-btn"
						onClick={handleCopy}
						disabled={busy}
					>
						{busy ? "Working…" : "Copy image"}
					</button>
					<button
						type="button"
						className="btn-primary share-action-btn"
						data-testid="share-download-btn"
						onClick={handleDownload}
						disabled={busy}
					>
						{busy ? "Working…" : "Save PNG"}
					</button>
				</div>

				<div className="share-control-row" style={{ marginTop: 8 }}>
					<span style={{ fontSize: 12, color: "var(--spice-text)" }}>Show @username</span>
					<Toggle value={showUsername} onSelected={setShowUsername} />
				</div>
				<div className="share-control-row">
					<span style={{ fontSize: 12, color: "var(--spice-text)" }}>Show period label</span>
					<Toggle value={showPeriodLabel} onSelected={setShowPeriodLabel} />
				</div>
			</div>
		</div>,
		document.body,
	);
}

function getPreviewWidth(_variant: ShareVariant, size: ShareSize): number {
	if (size === "story") return 270;
	return 320;
}

function getAspectRatio(size: ShareSize): string {
	if (size === "story") return "9 / 16";
	return "1 / 1";
}

interface ShareCardPreviewProps {
	variant: ShareVariant;
	size: ShareSize;
	stats: StatsResult;
	periodLabel: string;
	username: string;
}

function _ShareCardPreview({ variant, size, stats, periodLabel, username }: ShareCardPreviewProps) {
	const w = getPreviewWidth(variant, size);
	const aspect = getAspectRatio(size);
	const captionText = username ? `@${username} · ${periodLabel}` : periodLabel;

	return (
		<div
			data-testid="share-card"
			style={{
				width: w,
				aspectRatio: aspect,
				position: "relative",
				overflow: "hidden",
				borderRadius: 12,
				color: "#fff",
				flexShrink: 0,
				background: "linear-gradient(160deg, #0c160e 0%, #122318 50%, #0a1d12 100%)",
				boxShadow: "0 12px 40px rgba(0,0,0,.5)",
				fontFamily: "inherit",
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(80% 60% at 100% 0%, rgba(30,215,96,.35), transparent 60%), radial-gradient(70% 70% at 0% 100%, rgba(30,215,96,.15), transparent 60%)",
					pointerEvents: "none",
				}}
			/>
			<div
				data-testid="share-watermark"
				style={{
					position: "absolute",
					top: 14,
					left: 18,
					right: 18,
					display: "flex",
					alignItems: "center",
					gap: 6,
					fontSize: 10,
					fontWeight: 600,
					letterSpacing: ".08em",
					textTransform: "uppercase",
					color: "rgba(255,255,255,.6)",
				}}
			>
				<span
					style={{
						width: 14,
						height: 14,
						borderRadius: "50%",
						background: "var(--spice-button, #1ed760)",
						display: "inline-block",
						flexShrink: 0,
					}}
				/>
				<span>Listening Stats · Spicetify</span>
			</div>
			<div
				data-testid="share-footer"
				style={{
					position: "absolute",
					bottom: 14,
					left: 18,
					fontSize: 10,
					color: "rgba(255,255,255,.5)",
				}}
			>
				{captionText}
			</div>
			<div
				style={{
					position: "absolute",
					inset: "56px 22px 56px",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-start",
					overflow: "hidden",
				}}
			>
				{variant === "top5" && <ShareTop5 stats={stats} />}
				{variant === "time" && <ShareTime stats={stats} periodLabel={periodLabel} />}
				{variant === "genre" && <ShareGenre stats={stats} />}
				{variant === "streak" && <ShareStreak stats={stats} />}
				{variant === "throwback" && <ShareThrowback stats={stats} />}
				{variant === "wrapped" && <ShareWrapped stats={stats} size={size} periodLabel={periodLabel} />}
			</div>
		</div>
	);
}

const TILE_GRADS = [
	["#1a472a", "#2d6a4f"],
	["#2d3a4a", "#4a6b8a"],
	["#3a2d4a", "#6a4b8a"],
	["#4a2d3a", "#8a4b6a"],
	["#2d4a3a", "#4b8a6a"],
	["#4a3a2d", "#8a6a4b"],
	["#3a4a2d", "#6a8a4b"],
	["#2d4a4a", "#4b8a8a"],
];

function tileGrad(seed: string): string {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
	}
	const pair = TILE_GRADS[Math.abs(hash) % TILE_GRADS.length];
	return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function Tile({ seed, sz, rounded = 4, imageUrl }: { seed: string; sz: number; rounded?: number; imageUrl?: string }) {
	const art = normalizeSpotifyImageUrl(imageUrl);
	const bg = art ? `url(${art}) center/cover no-repeat, ${tileGrad(seed)}` : tileGrad(seed);
	return (
		<div
			data-testid="share-tile"
			style={{
				width: sz,
				height: sz,
				borderRadius: rounded,
				background: bg,
				flexShrink: 0,
			}}
		/>
	);
}

function ShareWrapped({ stats, size, periodLabel }: { stats: StatsResult; size: ShareSize; periodLabel: string }) {
	const isStory = size === "story";
	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const streak = stats.streak ?? 0;
	const peakLabel = formatHour(stats.peakHour, false);
	const tracks = stats.topTracks.slice(0, isStory ? 4 : 3);
	const artists = stats.topArtists.slice(0, isStory ? 4 : 3);
	const genres = stats.topGenres.slice(0, isStory ? 3 : 2);
	const genreMaxCount = genres[0]?.count || 1;
	const genreTotal = genres.reduce((s, x) => s + x.count, 0);
	const head = periodLabel.trim().length > 0 ? `${periodLabel} · Wrapped` : "Wrapped";

	return (
		<div>
			<div style={KICKER_STYLE}>{head}</div>
			<div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
				<span
					style={{
						fontSize: isStory ? 48 : 36,
						fontWeight: 900,
						color: "var(--spice-button, #1ed760)",
						letterSpacing: "-.04em",
						lineHeight: 0.95,
					}}
				>
					{totalHours}
				</span>
				<span style={{ fontSize: isStory ? 20 : 16, fontWeight: 700 }}>hours</span>
			</div>
			<div
				style={{
					marginTop: 8,
					fontSize: isStory ? 11 : 9,
					color: "rgba(255,255,255,.65)",
					lineHeight: 1.35,
				}}
			>
				{stats.totalPlays > 0
					? `${formatNumber(stats.totalPlays)} plays · ${stats.uniqueArtistCount} artists · peak ${peakLabel}`
					: ""}
				{streak > 0 ? ` · ${streak}-day streak` : ""}
			</div>

			{tracks.length > 0 && (
				<div style={{ marginTop: isStory ? 12 : 8 }}>
					<div style={{ ...KICKER_STYLE, fontSize: isStory ? 11 : 9, marginBottom: 6 }}>Top tracks</div>
					<ol
						style={{
							listStyle: "none",
							margin: 0,
							padding: 0,
							display: "flex",
							flexDirection: "column",
							gap: isStory ? 6 : 4,
						}}
					>
						{tracks.map((t, i) => (
							<li
								key={t.trackUri}
								data-testid="share-wrapped-track"
								style={{ display: "flex", alignItems: "center", gap: isStory ? 8 : 6 }}
							>
								<span
									style={{
										fontSize: isStory ? 16 : 14,
										fontWeight: 800,
										color: "var(--spice-button, #1ed760)",
										width: isStory ? 18 : 16,
										textAlign: "right",
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{i + 1}
								</span>
								<Tile seed={t.trackUri} sz={isStory ? 26 : 22} imageUrl={t.albumArt} />
								<div style={{ minWidth: 0, flex: 1 }}>
									<div
										style={{
											fontSize: isStory ? 11 : 10,
											fontWeight: 600,
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{t.trackName}
									</div>
									<div
										style={{
											fontSize: isStory ? 9 : 8,
											color: "rgba(255,255,255,.55)",
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{t.artistName}
									</div>
								</div>
							</li>
						))}
					</ol>
				</div>
			)}

			{artists.length > 0 && (
				<div style={{ marginTop: isStory ? 12 : 8 }}>
					<div style={{ ...KICKER_STYLE, fontSize: isStory ? 11 : 9, marginBottom: 6 }}>Top artists</div>
					<ol
						style={{
							listStyle: "none",
							margin: 0,
							padding: 0,
							display: "flex",
							flexDirection: "column",
							gap: isStory ? 6 : 4,
						}}
					>
						{artists.map((a, i) => (
							<li
								key={a.artistUri || `artist-${i}`}
								data-testid="share-wrapped-artist"
								style={{ display: "flex", alignItems: "center", gap: isStory ? 8 : 6 }}
							>
								<span
									style={{
										fontSize: isStory ? 16 : 14,
										fontWeight: 800,
										color: "var(--spice-button, #1ed760)",
										width: isStory ? 18 : 16,
										textAlign: "right",
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{i + 1}
								</span>
								<Tile seed={a.artistUri} sz={isStory ? 26 : 22} rounded={6} imageUrl={a.imageUrl ?? undefined} />
								<div style={{ minWidth: 0, flex: 1 }}>
									<div
										style={{
											fontSize: isStory ? 11 : 10,
											fontWeight: 600,
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										{a.artistName}
									</div>
									<div style={{ fontSize: isStory ? 9 : 8, color: "rgba(255,255,255,.55)" }}>
										{a.count > 0 ? (a.count === 1 ? "1 play" : `${a.count} plays`) : ""}
									</div>
								</div>
							</li>
						))}
					</ol>
				</div>
			)}

			{genres.length > 0 && (
				<div style={{ marginTop: isStory ? 12 : 8 }}>
					<div style={{ ...KICKER_STYLE, fontSize: isStory ? 11 : 9, marginBottom: 6 }}>Top genres</div>
					<div style={{ display: "flex", flexDirection: "column", gap: isStory ? 6 : 4 }}>
						{genres.map((g, i) => {
							const pct = genreTotal > 0 ? g.count / genreTotal : 0;
							return (
								<div
									key={g.genre}
									data-testid="share-wrapped-genre"
									style={{ display: "flex", alignItems: "center", gap: 10 }}
								>
									<span
										style={{
											flex: "0 0 auto",
											fontSize: 12,
											color: "#fff",
											fontWeight: 600,
											width: 96,
										}}
									>
										{g.genre}
									</span>
									<div
										style={{
											flex: 1,
											height: 8,
											background: "rgba(255,255,255,.1)",
											borderRadius: 4,
											overflow: "hidden",
										}}
									>
										<div
											style={{
												height: "100%",
												width: `${(g.count / genreMaxCount) * 100}%`,
												background: "var(--spice-button, #1ed760)",
												opacity: 1 - i * 0.18,
											}}
										/>
									</div>
									<span
										style={{
											fontSize: 11,
											color: "rgba(255,255,255,.6)",
											fontVariantNumeric: "tabular-nums",
										}}
									>
										{Math.round(pct * 100)}%
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

const KICKER_STYLE: React.CSSProperties = {
	fontSize: 11,
	color: "rgba(255,255,255,.6)",
	textTransform: "uppercase",
	letterSpacing: ".1em",
	fontWeight: 700,
	marginBottom: 10,
};

function ShareTop5({ stats }: { stats: StatsResult }) {
	const tracks = stats.topTracks.slice(0, 5);
	return (
		<div>
			<div style={KICKER_STYLE}>My top 5</div>
			<ol
				style={{
					listStyle: "none",
					margin: 0,
					padding: 0,
					display: "flex",
					flexDirection: "column",
					gap: 8,
				}}
			>
				{tracks.map((t, i) => (
					<li key={t.trackUri} data-testid="share-top5-item" style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<span
							style={{
								fontSize: 18,
								fontWeight: 800,
								color: "var(--spice-button, #1ed760)",
								width: 18,
								textAlign: "right",
								fontVariantNumeric: "tabular-nums",
							}}
						>
							{i + 1}
						</span>
						<Tile seed={t.trackUri} sz={28} imageUrl={t.albumArt} />
						<div style={{ minWidth: 0, flex: 1 }}>
							<div
								style={{
									fontSize: 12,
									fontWeight: 600,
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								{t.trackName}
							</div>
							<div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>{t.artistName}</div>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}

function ShareTime({ stats, periodLabel }: { stats: StatsResult; periodLabel: string }) {
	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const topArtist = stats.topArtists[0]?.artistName ?? "";
	const head = periodLabel.trim().length > 0 ? `${periodLabel} · I listened` : "Listening time";

	return (
		<div>
			<div style={KICKER_STYLE}>{head}</div>
			<div data-testid="share-time-hero" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
				<span
					style={{
						fontSize: 80,
						fontWeight: 900,
						color: "var(--spice-button, #1ed760)",
						lineHeight: 0.9,
						letterSpacing: "-.04em",
					}}
				>
					{totalHours}
				</span>
				<span style={{ fontSize: 32, fontWeight: 700 }}>hours</span>
			</div>
			{topArtist && (
				<div style={{ marginTop: 14, fontSize: 13, color: "rgba(255,255,255,.7)", lineHeight: 1.5 }}>
					Mostly to <strong style={{ color: "var(--spice-button, #1ed760)" }}>{topArtist}</strong>.
				</div>
			)}
		</div>
	);
}

function ShareGenre({ stats }: { stats: StatsResult }) {
	const top = stats.topGenres.slice(0, 4);
	if (top.length === 0) return null;
	const maxCount = top[0].count || 1;
	const totalCount = top.reduce((s, g) => s + g.count, 0);
	const topPct = totalCount > 0 ? Math.round((maxCount / totalCount) * 100) : 0;

	if (totalCount === 0) return null;

	return (
		<div>
			<div style={KICKER_STYLE}>
				I was {topPct}% {top[0].genre}
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
				{top.map((g, i) => {
					const pct = totalCount > 0 ? g.count / totalCount : 0;
					return (
						<div key={g.genre} data-testid="share-genre-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
							<span
								style={{
									flex: "0 0 auto",
									fontSize: 12,
									color: "#fff",
									fontWeight: 600,
									width: 96,
								}}
							>
								{g.genre}
							</span>
							<div
								style={{
									flex: 1,
									height: 8,
									background: "rgba(255,255,255,.1)",
									borderRadius: 4,
									overflow: "hidden",
								}}
							>
								<div
									style={{
										height: "100%",
										width: `${(g.count / maxCount) * 100}%`,
										background: "var(--spice-button, #1ed760)",
										opacity: 1 - i * 0.18,
									}}
								/>
							</div>
							<span
								style={{
									fontSize: 11,
									color: "rgba(255,255,255,.6)",
									fontVariantNumeric: "tabular-nums",
								}}
							>
								{Math.round(pct * 100)}%
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ShareStreak({ stats }: { stats: StatsResult }) {
	const streak = stats.streak ?? 0;
	if (streak === 0) return null;
	const data = (stats.dailyPlayCounts ?? []).slice(-56);
	const max = Math.max(1, ...data.map((d) => d.count));

	return (
		<div style={{ overflow: "hidden" }}>
			<div data-testid="share-streak-kicker" style={KICKER_STYLE}>
				{streak}-day streak
			</div>
			<div
				data-testid="share-streak-grid"
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(8, 1fr)",
					gap: 3,
					marginBottom: 14,
					maxWidth: "100%",
				}}
			>
				{Array.from({ length: 8 }).map((_, wi) => (
					<div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
						{Array.from({ length: 7 }).map((_, di) => {
							const idx = wi * 7 + di;
							const count = data[idx]?.count ?? 0;
							const t = Math.min(1, count / max);
							return (
								<div
									key={di}
									style={{
										aspectRatio: "1 / 1",
										borderRadius: 2,
										background: `rgba(30,215,96,${(0.08 + t * 0.92).toFixed(2)})`,
									}}
								/>
							);
						})}
					</div>
				))}
			</div>
			{streak > 0 && (
				<div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", lineHeight: 1.4, marginTop: 4 }}>
					Listened every day for <strong style={{ color: "#fff" }}>{streak} days</strong>.
				</div>
			)}
		</div>
	);
}

function ShareThrowback({ stats }: { stats: StatsResult }) {
	const track = stats.topTracks[0];
	if (!track || track.count === 0) return null;

	return (
		<div data-testid="share-throwback-body">
			<div style={KICKER_STYLE}>Most-played</div>
			<Tile seed={track.trackUri} sz={140} rounded={8} imageUrl={track.albumArt} />
			<div style={{ marginTop: 14 }}>
				<div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{track.trackName}</div>
				<div style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}>
					{track.artistName} · {track.count === 1 ? "1 play" : `${track.count} plays`}
				</div>
			</div>
		</div>
	);
}

// Canvas 2D export for share images (no DOM snapshot dependency).

/** System-ui stack for rendered cards */
const CV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const CV_ACCENT: [number, number, number] = [30, 215, 96];
const CV_PAD = 72;
const CV_BG_A = "#0c160e";
const CV_BG_B = "#122318";
const CV_BG_C = "#0a1d12";

interface SharePalette {
	accent: [number, number, number];
	bgA: string;
	bgB: string;
	bgC: string;
	text: string;
	mutedText: string;
	dimText: string;
	chunkBg: string;
	chunkBorder: string;
	/** Optional themed sentence-case tokens when following Spicetify CSS vars */
	specKickerMuted?: string;
	specFooterCaption?: string;
	specWatermarkTitle?: string;
	specWatermarkCaption?: string;
	specWrappedMetaMuted?: string;
	specWrappedFootnoteMuted?: string;
	specChunkCapsLabelMuted?: string;
	specGenrePctMuted?: string;
	specMutedBody?: string;
}

function cvRgb(c: [number, number, number], a = 1): string {
	return a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function parseCssColorToRgb(value: string | null | undefined): [number, number, number] | null {
	if (!value) return null;
	const v = value.trim();
	const rgbMatch = v.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
	const hex = v.replace("#", "");
	if (/^[\da-f]{6}$/i.test(hex)) {
		return [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16),
		];
	}
	return null;
}

function getSharePalette(followTheme: boolean): SharePalette {
	if (!followTheme) {
		return {
			accent: CV_ACCENT,
			bgA: CV_BG_A,
			bgB: CV_BG_B,
			bgC: CV_BG_C,
			text: "#ffffff",
			mutedText: "rgba(255,255,255,0.7)",
			dimText: "rgba(255,255,255,0.55)",
			chunkBg: "rgba(255,255,255,0.04)",
			chunkBorder: "rgba(255,255,255,0.08)",
			specKickerMuted: "rgba(255,255,255,0.6)",
			specFooterCaption: "rgba(255,255,255,0.5)",
			specWatermarkTitle: "rgba(255,255,255,0.6)",
			specWatermarkCaption: "rgba(255,255,255,0.55)",
			specWrappedMetaMuted: "rgba(255,255,255,0.62)",
			specWrappedFootnoteMuted: "rgba(255,255,255,0.45)",
			specChunkCapsLabelMuted: "rgba(255,255,255,0.55)",
			specGenrePctMuted: "rgba(255,255,255,0.65)",
			specMutedBody: "rgba(255,255,255,0.6)",
		};
	}
	const style = getComputedStyle(document.documentElement);
	const accent =
		parseCssColorToRgb(style.getPropertyValue("--spice-button")) ??
		parseCssColorToRgb(style.getPropertyValue("--spice-text")) ??
		CV_ACCENT;
	const base = parseCssColorToRgb(style.getPropertyValue("--spice-main")) ?? [12, 22, 14];
	const text = parseCssColorToRgb(style.getPropertyValue("--spice-text")) ?? [255, 255, 255];
	const tMuted = cvRgb(text, 0.62);
	const tDim = cvRgb(text, 0.56);
	return {
		accent,
		bgA: `rgb(${Math.max(0, base[0] - 10)}, ${Math.max(0, base[1] - 10)}, ${Math.max(0, base[2] - 10)})`,
		bgB: `rgb(${base[0]}, ${base[1]}, ${base[2]})`,
		bgC: `rgb(${Math.max(0, base[0] - 6)}, ${Math.max(0, base[1] - 6)}, ${Math.max(0, base[2] - 6)})`,
		text: cvRgb(text),
		mutedText: cvRgb(text, 0.72),
		dimText: tDim,
		chunkBg: cvRgb(text, 0.06),
		chunkBorder: cvRgb(text, 0.14),
		specKickerMuted: tMuted,
		specFooterCaption: cvRgb(text, 0.5),
		specWatermarkTitle: tMuted,
		specWatermarkCaption: cvRgb(text, 0.55),
		specWrappedMetaMuted: tMuted,
		specWrappedFootnoteMuted: cvRgb(text, 0.45),
		specChunkCapsLabelMuted: cvRgb(text, 0.55),
		specGenrePctMuted: cvRgb(text, 0.65),
		specMutedBody: cvRgb(text, 0.6),
	};
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
	const resolved = normalizeSpotifyImageUrl(url);
	if (!resolved) return Promise.resolve(null);
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		setTimeout(() => resolve(null), 5000);
		img.src = resolved;
	});
}

function cvRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function cvFillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	cvRoundRect(ctx, x, y, w, h, r);
	ctx.fill();
}

function cvTruncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (maxWidth <= 8) return "…";
	if (ctx.measureText(text).width <= maxWidth) return text;
	let t = text;
	while (t.length > 0 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
	return `${t}…`;
}

/** Minimum gutter between horizontally adjacent text/image columns. */
const CV_GAP = 20;

async function cvDrawArt(
	ctx: CanvasRenderingContext2D,
	url: string | undefined | null,
	x: number,
	y: number,
	size: number,
	radius: number,
): Promise<boolean> {
	if (!url) return false;
	const img = await loadImage(url);
	if (!img) return false;
	ctx.save();
	cvRoundRect(ctx, x, y, size, size, radius);
	ctx.clip();
	ctx.drawImage(img, x, y, size, size);
	ctx.restore();
	return true;
}

function cvPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number) {
	ctx.fillStyle = "rgba(255,255,255,0.06)";
	cvFillRoundRect(ctx, x, y, size, size, radius);
	ctx.fillStyle = "rgba(255,255,255,0.2)";
	ctx.font = `${Math.round(size * 0.4)}px ${CV_FONT}`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("♫", x + size / 2, y + size / 2);
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
}

/** Uppercase muted chunk labels (e.g. "GENRE LEADERS") with tracking */
function cvMutedCapsHeading(
	ctx: CanvasRenderingContext2D,
	phrase: string,
	x: number,
	y: number,
	fontPx: number,
	color: string,
) {
	const prev = ctx.letterSpacing;
	ctx.fillStyle = color;
	ctx.font = `700 ${fontPx}px ${CV_FONT}`;
	ctx.letterSpacing = "0.08em";
	ctx.fillText(phrase.toUpperCase(), x, y);
	ctx.letterSpacing = prev;
}

function cvKicker(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	palette: SharePalette,
	titleCase = false,
	fontPx = 36,
): number {
	ctx.fillStyle = palette.specKickerMuted ?? palette.mutedText;
	const prev = ctx.letterSpacing;
	ctx.letterSpacing = "0.1em";
	ctx.font = `700 ${fontPx}px ${CV_FONT}`;
	ctx.fillText(titleCase ? text : text.toUpperCase(), x, y);
	ctx.letterSpacing = prev;
	return y + fontPx + 18;
}

/** 12-hour label for peak hour meta lines */
function formatShareSpecPeakHour(hour: number): string {
	const h = ((Math.floor(hour) % 24) + 24) % 24;
	const v = h % 12 || 12;
	const ap = h < 12 || h === 24 ? "AM" : "PM";
	return `${v} ${ap}`;
}

function formatShareHeatmapBestDay(dateStr: string): string {
	const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return dateStr;
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const mi = Number(m[2]);
	const di = Number(m[3]);
	if (mi < 1 || mi > 12) return dateStr;
	return `${months[mi - 1]} ${di}`;
}

/** Diagonal gradient fill across palette backgrounds */
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, palette: SharePalette) {
	const cssAngleDeg = 160;
	const ang = cssAngleDeg * (Math.PI / 180);
	const ux = Math.sin(ang);
	const uy = -Math.cos(ang);
	const half = Math.hypot(w, h) / 2;
	const cx = w / 2;
	const cy = h / 2;
	const gx0 = cx - ux * half;
	const gy0 = cy - uy * half;
	const gx1 = cx + ux * half;
	const gy1 = cy + uy * half;
	const bg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
	bg.addColorStop(0, palette.bgA);
	bg.addColorStop(0.5, palette.bgB);
	bg.addColorStop(1, palette.bgC);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, w, h);

	const g1 = ctx.createRadialGradient(w, 0, 0, w, 0, w * 0.8);
	g1.addColorStop(0, cvRgb(palette.accent, 0.35));
	g1.addColorStop(1, cvRgb(palette.accent, 0));
	ctx.fillStyle = g1;
	ctx.fillRect(0, 0, w, h);

	const g2 = ctx.createRadialGradient(0, h, 0, 0, h, h * 0.7);
	g2.addColorStop(0, cvRgb(palette.accent, 0.15));
	g2.addColorStop(1, cvRgb(palette.accent, 0));
	ctx.fillStyle = g2;
	ctx.fillRect(0, 0, w, h);
}

function drawWatermarkBar(ctx: CanvasRenderingContext2D, w: number, captionText: string, palette: SharePalette) {
	const cx = CV_PAD;
	const cy = 52;

	ctx.fillStyle = cvRgb(palette.accent);
	ctx.beginPath();
	ctx.arc(cx + 18, cy + 18, 18, 0, Math.PI * 2);
	ctx.fill();

	const prevLs = ctx.letterSpacing;
	ctx.fillStyle = palette.specWatermarkTitle ?? palette.dimText;
	ctx.font = `600 ${28}px ${CV_FONT}`;
	ctx.letterSpacing = "0.04em";
	ctx.textBaseline = "middle";
	ctx.fillText("LISTENING STATS · SPICETIFY", cx + 48, cy + 18);
	ctx.letterSpacing = prevLs;

	if (captionText) {
		ctx.fillStyle = palette.specWatermarkCaption ?? palette.dimText;
		ctx.font = `500 ${26}px ${CV_FONT}`;
		const titleWid = ctx.measureText("LISTENING STATS · SPICETIFY").width;
		const titleEnd = cx + 48 + titleWid;
		const captionRight = w - CV_PAD;
		const capMax = Math.max(60, captionRight - titleEnd - 28);
		const capShow = cvTruncate(ctx, captionText, capMax);
		ctx.textAlign = "right";
		ctx.fillText(capShow, captionRight, cy + 18);
		ctx.textAlign = "left";
	}
	ctx.textBaseline = "alphabetic";
}

function drawFooterBar(
	ctx: CanvasRenderingContext2D,
	_w: number,
	h: number,
	captionText: string,
	palette: SharePalette,
) {
	ctx.fillStyle = palette.specFooterCaption ?? palette.dimText;
	ctx.font = `${28}px ${CV_FONT}`;
	ctx.fillText(captionText, CV_PAD, h - 52);
}

function estimateContentHeight(variant: ShareVariant, size: ShareSize): number {
	if (variant === "time") return size === "story" ? 1320 : 420;
	if (variant === "genre") return size === "story" ? 1280 : 560;
	if (variant === "throwback") return size === "story" ? 1180 : 780;
	if (variant === "top5") return size === "story" ? 1460 : 720;
	if (variant === "streak") return size === "story" ? 1180 : 560;
	if (variant === "wrapped") return size === "story" ? 1380 : 620;
	return size === "story" ? 620 : 560;
}

// ── Per-variant content drawers ──

interface Top5CanvasOptions {
	listTitle?: string;
	includeStoryInsight?: boolean;
	/** Square Wrapped: smaller rows so lists + footer fit in 1080×1080. */
	wrappedSquareTight?: boolean;
	/** Story Wrapped: slightly denser rows so tracks + artists + genres fit in 1080×1920. */
	wrappedStoryTight?: boolean;
}

async function drawTop5Content(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
	options?: Top5CanvasOptions,
): Promise<number> {
	const isStory = size === "story";
	const listTitle = options?.listTitle ?? "My top 5";
	const includeStoryInsight = options?.includeStoryInsight !== false;
	const storyTight = options?.wrappedStoryTight === true && isStory;
	const tightSq = options?.wrappedSquareTight === true && !isStory;
	y = cvKicker(ctx, listTitle, x, y, palette);
	y += isStory ? (storyTight ? 36 : 48) : tightSq ? 24 : 32;
	const tracks = stats.topTracks.slice(0, 5);
	if (tracks.length === 0) return y;

	const rankW = tightSq ? 44 : storyTight ? 48 : 56;
	const tileSz = isStory ? (storyTight ? 102 : 124) : tightSq ? 68 : 96;
	const gapArt = CV_GAP + 8;
	const cntPx = isStory ? (storyTight ? 28 : 32) : tightSq ? 22 : 28;
	const playsLblPx = storyTight ? 16 : tightSq ? 15 : 18;

	const allZeroPlays = tracks.every((t) => t.count === 0);
	ctx.font = `700 ${cntPx}px ${CV_FONT}`;
	let playNumMax = 0;
	for (const t of tracks) if (t.count > 0) playNumMax = Math.max(playNumMax, ctx.measureText(`${t.count}`).width);

	ctx.font = `600 ${playsLblPx}px ${CV_FONT}`;
	const defaultLetterSpacing = ctx.letterSpacing;
	ctx.letterSpacing = "0.06em";
	const playsLblW = allZeroPlays ? 0 : ctx.measureText("PLAYS").width;
	ctx.letterSpacing = defaultLetterSpacing;

	const playsReserve = Math.ceil(playNumMax + 14 + playsLblW + CV_PAD / 2);
	const textX = x + rankW + gapArt + tileSz + gapArt;
	const textAvail = Math.max(72, x + w - playsReserve - CV_GAP - textX);
	const titleBase = (ryLocal: number) => ryLocal + Math.round(tileSz * 0.38);
	const artistBase = (ryLocal: number) => ryLocal + Math.round(tileSz * 0.78);
	const rowGap = isStory ? (storyTight ? 22 : 36) : tightSq ? 12 : 24;
	const rankNumPx = isStory ? (storyTight ? 52 : 64) : tightSq ? 48 : 64;
	const titlePx = isStory ? (storyTight ? 38 : 44) : tightSq ? 30 : 40;
	const artistPx = isStory ? (storyTight ? 26 : 30) : tightSq ? 22 : 28;
	const artRadius = isStory ? (storyTight ? 8 : 10) : tightSq ? 6 : 8;

	for (let i = 0; i < tracks.length; i++) {
		const t = tracks[i];
		const ry = y + i * (tileSz + rowGap);
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `800 ${rankNumPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${i + 1}`, x + rankW, ry + tileSz / 2 + 18);
		ctx.textAlign = "left";

		const artX = x + rankW + gapArt;
		if (!(await cvDrawArt(ctx, t.albumArt, artX, ry, tileSz, artRadius)))
			cvPlaceholder(ctx, artX, ry, tileSz, artRadius);

		ctx.fillStyle = palette.text;
		ctx.font = `600 ${titlePx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.trackName, textAvail), textX, titleBase(ry));
		ctx.fillStyle = palette.dimText;
		ctx.font = `${artistPx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.artistName, textAvail), textX, artistBase(ry));

		const playsEdge = x + w;
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${cntPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(t.count > 0 ? `${t.count}` : "", playsEdge, titleBase(ry));
		ctx.fillStyle = palette.dimText;
		ctx.font = `600 ${playsLblPx}px ${CV_FONT}`;
		ctx.letterSpacing = "0.06em";
		if (t.count > 0) ctx.fillText("PLAYS", playsEdge, artistBase(ry));
		ctx.letterSpacing = defaultLetterSpacing;
		ctx.textAlign = "left";
	}
	y += tracks.length * (tileSz + rowGap);

	if (isStory && stats.totalPlays > 0 && includeStoryInsight) {
		const totalFive = tracks.reduce((s, t) => s + t.count, 0);
		const sharePct = Math.round((totalFive / stats.totalPlays) * 100);
		const chunkH = 224;
		cvChunkBg(ctx, x - 8, y + 48, w + 16, chunkH, palette);
		const cx = x + 24;
		const cy = y + 48;
		cvMutedCapsHeading(ctx, "Top 5 share", cx, cy + 44, 24, palette.specChunkCapsLabelMuted ?? palette.dimText);
		ctx.font = `${28}px ${CV_FONT}`;
		const playsLineW = ctx.measureText(`${formatNumber(totalFive)} plays`).width;
		ctx.font = `${22}px ${CV_FONT}`;
		const totalLineW = ctx.measureText(`of ${formatNumber(stats.totalPlays)} total`).width;
		const rightBlk = Math.max(playsLineW, totalLineW);
		const innerRight = x + w - 16;
		const leftMaxW = Math.max(120, innerRight - rightBlk - CV_GAP - cx);
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${36}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, `${sharePct}% of all plays`, leftMaxW), cx, cy + 114);
		ctx.fillStyle = palette.mutedText;
		ctx.font = `${28}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${formatNumber(totalFive)} plays`, x + w - 16, cy + 104);
		ctx.fillStyle = palette.dimText;
		ctx.font = `${22}px ${CV_FONT}`;
		ctx.fillText(`of ${formatNumber(stats.totalPlays)} total`, x + w - 16, cy + 144);
		ctx.textAlign = "left";
		y += 48 + chunkH;
	}
	return y;
}

async function drawTimeContent(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	periodLabel: string,
	periodDayCount: number,
	x: number,
	y: number,
	w: number,
) {
	const head = periodLabel.trim().length > 0 ? `${periodLabel} · I listened` : "Listening time";
	y = cvKicker(ctx, head, x, y, palette, true, size === "story" ? 34 : 30);
	const isStory = size === "story";
	y += isStory ? 80 : 32;

	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const heroNumPx = isStory ? 380 : 300;
	const hoursWordPx = isStory ? 96 : 72;
	const numBaseline = y + Math.floor(heroNumPx * 0.78);

	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	ctx.font = `900 ${heroNumPx}px ${CV_FONT}`;
	ctx.fillStyle = cvRgb(palette.accent);
	ctx.fillText(`${totalHours}`, x, numBaseline);

	ctx.fillStyle = palette.text;
	ctx.font = `700 ${hoursWordPx}px ${CV_FONT}`;
	const hoursBaseline = numBaseline + Math.floor(hoursWordPx * 1.05) + (isStory ? 28 : 22);
	ctx.fillText("hours", x, hoursBaseline);

	y = hoursBaseline + Math.floor(hoursWordPx * 0.35) + (isStory ? 48 : 40);

	const topArtist = stats.topArtists[0]?.artistName ?? "";
	if (topArtist) {
		ctx.fillStyle = palette.mutedText;
		ctx.font = `${40}px ${CV_FONT}`;
		const prefix = "Mostly to ";
		const prefixW = ctx.measureText(prefix).width;
		ctx.fillText(prefix, x, y);
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `bold ${40}px ${CV_FONT}`;
		const artistMaxW = Math.max(40, x + w - (x + prefixW));
		ctx.fillText(cvTruncate(ctx, `${topArtist}.`, artistMaxW), x + prefixW, y);
		y += 72;
	}

	if (!isStory) return;

	const daysCount = Math.max(1, periodDayCount ?? stats.listeningDays ?? 28);
	const daysEquiv = Math.round(totalHours / 24);
	const minsPerDay = Math.round((totalHours * 60) / daysCount);

	const midGap = 24;
	const colW = (w - midGap) / 2;
	const chunkY = y + 64;
	const chunkH = 220;
	const mutedBody = palette.specMutedBody ?? palette.mutedText;
	const capsLabel = palette.specChunkCapsLabelMuted ?? palette.dimText;
	const inset = 32;

	cvChunkBg(ctx, x, chunkY, colW, chunkH, palette);
	cvChunkBg(ctx, x + colW + midGap, chunkY, colW, chunkH, palette);

	cvMutedCapsHeading(ctx, "Equivalent to", x + inset, chunkY + 44, 24, capsLabel);
	ctx.fillStyle = palette.text;
	ctx.font = `800 ${56}px ${CV_FONT}`;
	ctx.fillText(`${daysEquiv} days`, x + inset, chunkY + 116);
	ctx.fillStyle = mutedBody;
	ctx.font = `${26}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, "of nonstop play", colW - 2 * inset), x + inset, chunkY + 162);

	const rightX = x + colW + midGap + inset;
	cvMutedCapsHeading(ctx, "Daily average", rightX, chunkY + 44, 24, capsLabel);
	ctx.fillStyle = palette.text;
	ctx.font = `800 ${56}px ${CV_FONT}`;
	ctx.fillText(`${minsPerDay} min`, rightX, chunkY + 116);
	ctx.fillStyle = mutedBody;
	ctx.font = `${26}px ${CV_FONT}`;
	ctx.fillText(
		stats.totalPlays > 0 ? cvTruncate(ctx, `across ${formatNumber(stats.totalPlays)} plays`, colW - 2 * inset) : "",
		rightX,
		chunkY + 162,
	);

	if (stats.topArtists.length === 0) return;

	const chunkTop = chunkY + chunkH + 28;
	const rowsPod = Math.min(3, stats.topArtists.length);
	const rowStride = 64 + 18;
	const podiumH = 108 + rowsPod * rowStride;
	cvChunkBg(ctx, x - 8, chunkTop, w + 16, podiumH, palette);
	const innerLeft = x + 24;
	const podiumTitleMuted = palette.specKickerMuted ?? palette.mutedText;
	cvMutedCapsHeading(ctx, "Top artists", innerLeft + 8, chunkTop + 40, 26, podiumTitleMuted);

	let ry = chunkTop + 40 + 30 + 24;
	for (let i = 0; i < rowsPod; i++) {
		const a = stats.topArtists[i];
		const rankRight = innerLeft + 36;
		const avatar = 64;
		const avatarX = innerLeft + 36 + 22;
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `800 ${38}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${i + 1}`, rankRight, ry + 42);
		ctx.textAlign = "left";
		if (!(await cvDrawArt(ctx, a.imageUrl ?? undefined, avatarX, ry, avatar, avatar / 2)))
			cvPlaceholder(ctx, avatarX, ry, avatar, avatar / 2);
		const nameX = avatarX + avatar + 22;
		const playsLbl = a.count > 0 ? `${formatNumber(a.count)} ${a.count === 1 ? "play" : "plays"}` : "";
		ctx.font = `${28}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillStyle = palette.dimText;
		const playsW = ctx.measureText(playsLbl).width + 24;
		ctx.textAlign = "left";
		const nameWMax = Math.max(80, x + w - nameX - playsW);
		ctx.fillStyle = palette.text;
		ctx.font = `600 ${36}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, a.artistName, nameWMax), nameX, ry + 42);
		ctx.fillStyle = palette.dimText;
		ctx.font = `${28}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(playsLbl, x + w - 24, ry + 42);
		ctx.textAlign = "left";
		ry += rowStride;
	}
}

async function drawGenreContent(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
) {
	const limit = size === "story" ? 6 : 5;
	const top = stats.topGenres.slice(0, limit);
	if (top.length === 0) return;

	const maxCount = top[0].count || 1;
	const totalCount = top.reduce((s, g) => s + g.count, 0);
	const topPct = totalCount > 0 ? Math.round((maxCount / totalCount) * 100) : 0;

	if (totalCount === 0) return;
	y = cvKicker(ctx, `I was ${topPct}% ${top[0].genre}`, x, y, palette);
	const isStory = size === "story";
	y += isStory ? 54 : 40;
	const barH = isStory ? 36 : 32;
	const rowGap = isStory ? 36 : 28;
	const labelWPref = isStory ? 320 : 300;
	const pctReserve = isStory ? 120 : 100;
	const minBarW = isStory ? 72 : 64;
	const genreLblFontPx = isStory ? 40 : 36;
	const labelCap = Math.max(160, Math.min(labelWPref, w - pctReserve - minBarW - CV_GAP - 28));
	const genrePctColor = palette.specGenrePctMuted ?? palette.mutedText;

	for (let i = 0; i < top.length; i++) {
		const g = top[i];
		const ry = y + i * (barH + rowGap);
		const pct = totalCount > 0 ? g.count / totalCount : 0;

		ctx.fillStyle = palette.text;
		ctx.font = `600 ${genreLblFontPx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, g.genre, labelCap), x, ry + barH - 4);

		const barX = x + labelCap + CV_GAP;
		const barW = Math.max(minBarW, w - pctReserve - (barX - x) - CV_GAP);
		ctx.fillStyle = "rgba(255,255,255,0.1)";
		cvFillRoundRect(ctx, barX, ry, barW, barH, barH / 2);
		ctx.fillStyle = cvRgb(palette.accent, 1 - i * 0.13);
		cvFillRoundRect(ctx, barX, ry, barW * (g.count / maxCount), barH, barH / 2);

		ctx.fillStyle = genrePctColor;
		ctx.font = `600 ${isStory ? 34 : 32}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${Math.round(pct * 100)}%`, x + w, ry + barH - 4);
		ctx.textAlign = "left";
	}
	y += top.length * (barH + rowGap);

	if (!isStory || stats.topTracks.length === 0) return;

	y += 72;
	const leaders = top.slice(0, 3);
	const rowStride = isStory ? 100 : 92;
	const leaderH = 70 + leaders.length * rowStride;
	cvChunkBg(ctx, x - 8, y, w + 16, leaderH, palette);
	const podiumTitleMuted = palette.specKickerMuted ?? palette.mutedText;
	cvMutedCapsHeading(ctx, "Genre leaders", x + 24, y + 48, 26, podiumTitleMuted);
	let ly = y + 100;
	let genreColW = 200;
	ctx.font = `700 24px ${CV_FONT}`;
	for (const lg of leaders) {
		genreColW = Math.max(genreColW, Math.ceil(ctx.measureText(lg.genre.toUpperCase()).width) + 24);
	}
	const innerRight = x + w - 20;
	genreColW = Math.min(genreColW, Math.floor(w * 0.42));
	const art = 64;
	const textStart = x + 24 + art + CV_GAP;
	const txtMax = Math.max(100, innerRight - genreColW - CV_GAP - textStart);
	const titleBaseline = (rowY: number) => rowY + 30;
	const artistBaseline = (rowY: number) => rowY + 62;
	const genreBaseline = (rowY: number) => rowY + 44;

	for (let i = 0; i < leaders.length; i++) {
		const g = leaders[i];
		const t = stats.topTracks[i];
		if (!t) break;
		if (!(await cvDrawArt(ctx, t.albumArt, x + 24, ly, art, 8))) cvPlaceholder(ctx, x + 24, ly, art, 8);
		ctx.fillStyle = palette.text;
		ctx.font = `600 ${32}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.trackName, txtMax), textStart, titleBaseline(ly));
		ctx.fillStyle = palette.dimText;
		ctx.font = `${24}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.artistName, txtMax), textStart, artistBaseline(ly));
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `700 ${24}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(g.genre.toUpperCase(), innerRight, genreBaseline(ly));
		ctx.textAlign = "left";
		ly += rowStride;
	}
}

async function drawStreakContent(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
) {
	const streak = stats.streak ?? 0;
	if (streak === 0) return;
	const isStory = size === "story";
	y = cvKicker(ctx, `${streak}-day streak`, x, y, palette, false, isStory ? 40 : 36);
	y += isStory ? 54 : 32;

	const cols = isStory ? 12 : 8;
	const rows = 7;
	const gap = 12;
	const data = (stats.dailyPlayCounts ?? []).slice(-(cols * rows));
	const max = Math.max(1, ...data.map((d) => d.count), 1);
	const cellSize = Math.floor((w - gap * (cols - 1)) / cols);

	for (let wi = 0; wi < cols; wi++) {
		for (let di = 0; di < rows; di++) {
			const idx = wi * rows + di;
			const count = data[idx]?.count ?? 0;
			const t = Math.min(1, count / max);
			ctx.fillStyle = cvRgb(palette.accent, 0.08 + t * 0.92);
			cvFillRoundRect(ctx, x + wi * (cellSize + gap), y + di * (cellSize + gap), cellSize, cellSize, 6);
		}
	}
	y += rows * (cellSize + gap) + (isStory ? 48 : 24);

	ctx.fillStyle = palette.mutedText;
	ctx.font = `${isStory ? 40 : 34}px ${CV_FONT}`;
	const prefix = "Listened every day for ";
	ctx.fillText(prefix, x, y);
	const pw = ctx.measureText(prefix).width;
	ctx.fillStyle = palette.text;
	ctx.font = `bold ${isStory ? 40 : 34}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, `${streak} days.`, Math.max(24, x + w - x - pw)), x + pw, y);

	if (!isStory || data.length === 0) return;

	y += 80;
	const totalMins = data.reduce((s, d) => s + d.count * 3, 0);
	const avgMins = data.length ? Math.round(totalMins / data.length) : 0;
	const firstDay = data[0];
	if (!firstDay) return;
	const bestDay = data.reduce((best, cur) => (cur.count > best.count ? cur : best), firstDay);

	const midGap = 24;
	const colW = (w - midGap) / 2;
	const chunkH = 218;
	cvChunkBg(ctx, x, y, colW, chunkH, palette);
	cvChunkBg(ctx, x + colW + midGap, y, colW, chunkH, palette);
	const capCol = palette.specChunkCapsLabelMuted ?? palette.dimText;
	const mutedBody = palette.specMutedBody ?? palette.mutedText;

	cvMutedCapsHeading(ctx, "Daily average", x + 28, y + 44, 24, capCol);
	ctx.fillStyle = palette.text;
	ctx.font = `800 ${56}px ${CV_FONT}`;
	ctx.fillText(`${avgMins} min`, x + 28, y + 116);
	ctx.fillStyle = mutedBody;
	ctx.font = `${26}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, `over the last ${data.length} days`, colW - 56), x + 28, y + 162);

	cvMutedCapsHeading(ctx, "Longest streak", x + colW + midGap + 28, y + 44, 24, capCol);
	ctx.fillStyle = cvRgb(palette.accent);
	ctx.font = `800 ${56}px ${CV_FONT}`;
	ctx.fillText(`${streak} days`, x + colW + midGap + 28, y + 116);
	ctx.fillStyle = mutedBody;
	ctx.font = `${26}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, "your best run this year", colW - 56), x + colW + midGap + 28, y + 162);

	y += chunkH + 28;
	cvChunkBg(ctx, x - 8, y, w + 16, 176, palette);
	cvMutedCapsHeading(ctx, "Best day", x + 28, y + 52, 24, capCol);
	ctx.fillStyle = palette.text;
	ctx.font = `700 ${36}px ${CV_FONT}`;
	const bestDayStr = formatShareHeatmapBestDay(bestDay.date);
	const playsLbl = `${bestDay.count} ${bestDay.count === 1 ? "play" : "plays"}`;
	ctx.font = `800 ${36}px ${CV_FONT}`;
	const playsW = ctx.measureText(playsLbl).width + CV_GAP;
	ctx.font = `700 ${36}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, bestDayStr, Math.max(80, w - 28 - playsW)), x + 28, y + 112);
	ctx.fillStyle = cvRgb(palette.accent);
	ctx.font = `800 ${36}px ${CV_FONT}`;
	ctx.textAlign = "right";
	ctx.fillText(playsLbl, x + w - 16, y + 114);
	ctx.textAlign = "left";
}

async function drawThrowbackContent(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
	canvasWidth: number,
) {
	const track = stats.topTracks[0];
	if (!track) return;
	const isStory = size === "story";

	y = cvKicker(ctx, "Most-played", x, y, palette);
	y += 28;

	const artPx = isStory ? 940 : 500;
	const artX = Math.floor((canvasWidth - artPx) / 2);
	if (!(await cvDrawArt(ctx, track.albumArt, artX, y, artPx, isStory ? 20 : 20)))
		cvPlaceholder(ctx, artX, y, artPx, isStory ? 20 : 20);
	y += artPx + (isStory ? 96 : 72);

	ctx.textAlign = "left";
	ctx.fillStyle = palette.text;
	ctx.font = `800 ${isStory ? 96 : 64}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, track.trackName, w), x, y);

	y += isStory ? 110 : 70;
	ctx.fillStyle = palette.mutedText;
	ctx.font = `${isStory ? 44 : 32}px ${CV_FONT}`;
	const playPhrase = track.count > 0 ? (track.count === 1 ? "1 play" : `${track.count} plays`) : "";
	ctx.fillText(cvTruncate(ctx, playPhrase ? `${track.artistName} · ${playPhrase}` : track.artistName, w), x, y);

	if (!isStory || stats.totalPlays <= 0) return;

	y += 76;
	const chunkH = 200;
	cvChunkBg(ctx, x - 8, y, w + 16, chunkH, palette);
	const chunkLeft = x - 8;
	const innerW = w + 16;
	const colW = innerW / 3;
	const ty = y + 54;
	const sharePct = Math.round((track.count / stats.totalPlays) * 100);

	const capMuted = palette.specChunkCapsLabelMuted ?? palette.dimText;
	const prevLs = ctx.letterSpacing;
	ctx.fillStyle = capMuted;
	ctx.font = `700 ${22}px ${CV_FONT}`;
	ctx.letterSpacing = "0.08em";
	ctx.textAlign = "center";
	ctx.fillText("PLAYS", chunkLeft + colW * 0.5, ty);
	ctx.fillText("SHARE", chunkLeft + colW * 1.5, ty);
	ctx.fillText("RANK", chunkLeft + colW * 2.5, ty);
	ctx.letterSpacing = prevLs;

	ctx.fillStyle = cvRgb(palette.accent);
	ctx.font = `800 ${52}px ${CV_FONT}`;
	ctx.fillText(`${track.count}`, chunkLeft + colW * 0.5, ty + 86);

	ctx.fillStyle = palette.text;
	ctx.fillText(`${sharePct}%`, chunkLeft + colW * 1.5, ty + 86);
	ctx.fillText("#1", chunkLeft + colW * 2.5, ty + 86);

	ctx.textAlign = "left";
	ctx.strokeStyle = palette.chunkBorder;
	ctx.lineWidth = 2;
	ctx.beginPath();
	const sep1 = chunkLeft + colW;
	const sep2 = chunkLeft + 2 * colW;
	ctx.moveTo(sep1, y + 28);
	ctx.lineTo(sep1, y + chunkH - 28);
	ctx.moveTo(sep2, y + 28);
	ctx.lineTo(sep2, y + chunkH - 28);
	ctx.stroke();
}

type WrappedListLayout = {
	rankW: number;
	tileSz: number;
	rowGap: number;
	rankNumPx: number;
	titlePx: number;
	subPx: number;
	cntPx: number;
	playsLblPx: number;
	artRadius: number;
};

async function drawWrappedCompactTrackRows(
	ctx: CanvasRenderingContext2D,
	tracks: TopTrack[],
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
	layout: WrappedListLayout,
): Promise<number> {
	if (tracks.length === 0) return y;
	y = cvKicker(ctx, "Top tracks", x, y, palette, false, layout.tileSz <= 52 ? 18 : 22);
	y += layout.tileSz <= 52 ? 14 : 18;
	const { rankW, tileSz, rowGap, rankNumPx, titlePx, subPx, cntPx, playsLblPx, artRadius } = layout;
	const gapArt = 10;
	ctx.font = `700 ${cntPx}px ${CV_FONT}`;
	let playNumMax = 0;
	for (const t of tracks) if (t.count > 0) playNumMax = Math.max(playNumMax, ctx.measureText(`${t.count}`).width);
	ctx.font = `600 ${playsLblPx}px ${CV_FONT}`;
	const defaultLetterSpacing = ctx.letterSpacing;
	ctx.letterSpacing = "0.06em";
	const playsLblW = ctx.measureText("PLAYS").width;
	ctx.letterSpacing = defaultLetterSpacing;
	const playsReserve = Math.ceil(playNumMax + 10 + playsLblW + CV_PAD / 2);
	const textX = x + rankW + gapArt + tileSz + gapArt;
	const textAvail = Math.max(48, x + w - playsReserve - CV_GAP - textX);
	const titleBase = (ry: number) => ry + Math.round(tileSz * 0.34);
	const artistBase = (ry: number) => ry + Math.round(tileSz * 0.72);

	for (let i = 0; i < tracks.length; i++) {
		const t = tracks[i];
		const ry = y + i * (tileSz + rowGap);
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `800 ${rankNumPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${i + 1}`, x + rankW, ry + tileSz / 2 + Math.round(rankNumPx * 0.12));
		ctx.textAlign = "left";
		const artX = x + rankW + gapArt;
		if (!(await cvDrawArt(ctx, t.albumArt, artX, ry, tileSz, artRadius)))
			cvPlaceholder(ctx, artX, ry, tileSz, artRadius);
		ctx.fillStyle = palette.text;
		ctx.font = `600 ${titlePx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.trackName, textAvail), textX, titleBase(ry));
		ctx.fillStyle = palette.dimText;
		ctx.font = `${subPx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, t.artistName, textAvail), textX, artistBase(ry));
		const playsEdge = x + w;
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${cntPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		if (t.count > 0) ctx.fillText(`${t.count}`, playsEdge, titleBase(ry));
		ctx.fillStyle = palette.dimText;
		ctx.font = `600 ${playsLblPx}px ${CV_FONT}`;
		ctx.letterSpacing = "0.06em";
		if (t.count > 0) ctx.fillText("PLAYS", playsEdge, artistBase(ry));
		ctx.letterSpacing = defaultLetterSpacing;
		ctx.textAlign = "left";
	}
	return y + tracks.length * (tileSz + rowGap);
}

async function drawWrappedCompactArtistRows(
	ctx: CanvasRenderingContext2D,
	artists: TopArtist[],
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
	layout: WrappedListLayout,
): Promise<number> {
	if (artists.length === 0) return y;
	y = cvKicker(ctx, "Top artists", x, y, palette, false, layout.tileSz <= 52 ? 18 : 22);
	y += layout.tileSz <= 52 ? 14 : 18;
	const { rankW, tileSz, rowGap, rankNumPx, titlePx, subPx, artRadius } = layout;
	const gapArt = 10;
	const textX = x + rankW + gapArt + tileSz + gapArt;
	const textAvail = Math.max(48, x + w - CV_GAP - textX);
	const titleBase = (ry: number) => ry + Math.round(tileSz * 0.34);
	const subBase = (ry: number) => ry + Math.round(tileSz * 0.72);

	for (let i = 0; i < artists.length; i++) {
		const a = artists[i];
		const ry = y + i * (tileSz + rowGap);
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.font = `800 ${rankNumPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${i + 1}`, x + rankW, ry + tileSz / 2 + Math.round(rankNumPx * 0.12));
		ctx.textAlign = "left";
		const artX = x + rankW + gapArt;
		if (!(await cvDrawArt(ctx, a.imageUrl ?? undefined, artX, ry, tileSz, artRadius)))
			cvPlaceholder(ctx, artX, ry, tileSz, artRadius);
		ctx.fillStyle = palette.text;
		ctx.font = `600 ${titlePx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, a.artistName, textAvail), textX, titleBase(ry));
		ctx.fillStyle = palette.dimText;
		ctx.font = `${subPx}px ${CV_FONT}`;
		const sub = a.count > 0 ? (a.count === 1 ? "1 play" : `${formatNumber(a.count)} plays`) : "";
		ctx.fillText(cvTruncate(ctx, sub, textAvail), textX, subBase(ry));
	}
	return y + artists.length * (tileSz + rowGap);
}

async function drawWrappedCompactGenreRows(
	ctx: CanvasRenderingContext2D,
	top: TopGenre[],
	palette: SharePalette,
	x: number,
	y: number,
	w: number,
	opts: { barH: number; rowGap: number; labelMax: number; labelPx: number; pctPx: number },
): Promise<number> {
	if (top.length === 0) return y;
	const maxCount = top[0].count || 1;
	const totalCount = top.reduce((s, g) => s + g.count, 0);
	if (totalCount === 0) return y;
	y = cvKicker(ctx, "Top genres", x, y, palette, false, opts.labelPx + 4);
	y += opts.rowGap > 12 ? 16 : 12;
	const { barH, rowGap, labelMax, labelPx, pctPx } = opts;
	const genrePctColor = palette.specGenrePctMuted ?? palette.dimText;
	const pctReserve = 72;

	for (let i = 0; i < top.length; i++) {
		const g = top[i];
		const ry = y + i * (barH + rowGap);
		const pct = totalCount > 0 ? g.count / totalCount : 0;
		ctx.fillStyle = palette.text;
		ctx.font = `600 ${labelPx}px ${CV_FONT}`;
		ctx.fillText(cvTruncate(ctx, g.genre, labelMax), x, ry + barH - 3);
		const barX = x + labelMax + CV_GAP;
		const barW = Math.max(48, w - pctReserve - (barX - x) - CV_GAP);
		ctx.fillStyle = "rgba(255,255,255,0.1)";
		cvFillRoundRect(ctx, barX, ry, barW, barH, barH / 2);
		ctx.fillStyle = cvRgb(palette.accent, 1 - i * 0.15);
		cvFillRoundRect(ctx, barX, ry, barW * (g.count / maxCount), barH, barH / 2);
		ctx.fillStyle = genrePctColor;
		ctx.font = `600 ${pctPx}px ${CV_FONT}`;
		ctx.textAlign = "right";
		ctx.fillText(`${Math.round(pct * 100)}%`, x + w, ry + barH - 3);
		ctx.textAlign = "left";
	}
	return y + top.length * (barH + rowGap);
}

async function drawWrappedContent(
	ctx: CanvasRenderingContext2D,
	stats: StatsResult,
	size: ShareSize,
	palette: SharePalette,
	periodLabel: string,
	x: number,
	y: number,
	w: number,
	allowStreak: boolean,
	_captionText: string,
): Promise<void> {
	const isStory = size === "story";
	const head = periodLabel.trim().length > 0 ? `${periodLabel} · Wrapped` : "Wrapped";
	const totalHours = Math.floor(stats.totalDuration / 3_600_000);
	const peakLbl = formatShareSpecPeakHour(stats.peakHour);
	const streak = allowStreak ? (stats.streak ?? 0) : 0;
	let meta =
		stats.totalPlays > 0
			? `${formatNumber(stats.totalPlays)} plays · ${stats.uniqueArtistCount} artists · peak ${peakLbl}`
			: "";
	if (streak > 0 && stats.totalPlays > 0) meta += ` · ${streak}-day streak`;

	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";

	/* ── Kicker ── */
	y = cvKicker(ctx, head, x, y, palette, true, isStory ? 26 : 20);
	y += isStory ? 16 : 12;

	/* ── Hero: story = stacked; square = hours beside number to save vertical space ── */
	if (isStory) {
		const heroNumPx = 188;
		const hoursWordPx = 48;
		const numBaseline = y + Math.floor(heroNumPx * 0.78);
		ctx.font = `900 ${heroNumPx}px ${CV_FONT}`;
		ctx.fillStyle = cvRgb(palette.accent);
		ctx.fillText(`${totalHours}`, x, numBaseline);
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${hoursWordPx}px ${CV_FONT}`;
		const hoursBaseline = numBaseline + Math.floor(hoursWordPx * 1.02) + 18;
		ctx.fillText("hours", x, hoursBaseline);
		y = hoursBaseline + Math.floor(hoursWordPx * 0.28) + 28;
	} else {
		const numPx = 112;
		const wordPx = 32;
		ctx.font = `900 ${numPx}px ${CV_FONT}`;
		ctx.fillStyle = cvRgb(palette.accent);
		const numW = ctx.measureText(`${totalHours}`).width;
		const baseline = y + Math.floor(numPx * 0.78);
		ctx.fillText(`${totalHours}`, x, baseline);
		ctx.fillStyle = palette.text;
		ctx.font = `700 ${wordPx}px ${CV_FONT}`;
		ctx.fillText("hours", x + numW + 14, baseline);
		y = baseline + Math.floor(Math.max(numPx, wordPx) * 0.22) + 18;
	}

	ctx.fillStyle = palette.mutedText;
	const metaPx = isStory ? 26 : 19;
	ctx.font = `${metaPx}px ${CV_FONT}`;
	ctx.fillText(cvTruncate(ctx, meta, w), x, y);
	y += isStory ? 34 : 24;

	/* ── Lists: tighter caps on square so footer band stays clear ── */
	const trackSlice = isStory ? stats.topTracks.slice(0, 4) : stats.topTracks.slice(0, 3);
	const artistSlice = isStory ? stats.topArtists.slice(0, 4) : stats.topArtists.slice(0, 3);
	const genreSlice = isStory ? stats.topGenres.slice(0, 3) : stats.topGenres.slice(0, 2);

	const storyLayout: WrappedListLayout = {
		rankW: 44,
		tileSz: 70,
		rowGap: 10,
		rankNumPx: 42,
		titlePx: 30,
		subPx: 22,
		cntPx: 24,
		playsLblPx: 15,
		artRadius: 8,
	};
	const squareLayout: WrappedListLayout = {
		rankW: 32,
		tileSz: 46,
		rowGap: 7,
		rankNumPx: 26,
		titlePx: 18,
		subPx: 15,
		cntPx: 17,
		playsLblPx: 12,
		artRadius: 6,
	};
	const listLayout = isStory ? storyLayout : squareLayout;

	y = await drawWrappedCompactTrackRows(ctx, trackSlice, palette, x, y, w, listLayout);
	y += isStory ? 16 : 12;
	y = await drawWrappedCompactArtistRows(ctx, artistSlice, palette, x, y, w, listLayout);

	if (genreSlice.length > 0) {
		y += isStory ? 16 : 10;
		y = await drawWrappedCompactGenreRows(
			ctx,
			genreSlice,
			palette,
			x,
			y,
			w,
			isStory
				? { barH: 22, rowGap: 12, labelMax: 220, labelPx: 26, pctPx: 24 }
				: { barH: 16, rowGap: 8, labelMax: 160, labelPx: 18, pctPx: 17 },
		);
	}
}

function cvChunkBg(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, palette: SharePalette) {
	ctx.fillStyle = palette.chunkBg;
	cvFillRoundRect(ctx, x, y, w, h, 20);
	ctx.strokeStyle = palette.chunkBorder;
	ctx.lineWidth = 2;
	cvRoundRect(ctx, x, y, w, h, 20);
	ctx.stroke();
}

// ── Main canvas renderer ──

export async function renderShareCardCanvas(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<HTMLCanvasElement> {
	const dim = TARGET_DIMENSIONS[size];
	const w = dim.width;
	const h = dim.height;

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context unavailable");
	await hydrateShareCardAssets(stats);
	const palette = getSharePalette(!!options?.followTheme);
	const providerId = options?.activeProviderId ?? "local";
	const allowStreak = providerId === "local";
	const safeVariant = !allowStreak && variant === "streak" ? "top5" : variant;

	const captionParts: string[] = [];
	if (options?.showUsername !== false && username) captionParts.push(`@${username}`);
	if (options?.showPeriodLabel !== false) captionParts.push(periodLabel);
	const captionText = captionParts.length > 0 ? captionParts.join(" · ") : "";

	drawBackground(ctx, w, h, palette);
	drawWatermarkBar(ctx, w, captionText, palette);

	const periodDays = Math.max(1, options?.periodDayCount ?? stats.listeningDays ?? 28);

	const contentX = CV_PAD;
	const contentTop = safeVariant === "wrapped" ? 168 : 180;
	const contentBottom =
		safeVariant === "wrapped" && size === "square" ? 108 : safeVariant === "wrapped" && size === "story" ? 96 : 140;
	const wrapFooterReserve = safeVariant === "wrapped" ? (size === "story" ? 96 : 92) : 72;
	const availableHeight = h - contentTop - contentBottom;
	const estimatedHeight = estimateContentHeight(safeVariant, size);
	const extraSpace = Math.max(0, availableHeight - estimatedHeight);
	const topBias = safeVariant === "wrapped" ? 0.06 : 0.35;
	const contentY = contentTop + Math.floor(extraSpace * topBias);
	const contentW = w - CV_PAD * 2;

	switch (safeVariant) {
		case "top5":
			await drawTop5Content(ctx, stats, size, palette, contentX, contentY, contentW);
			break;
		case "time":
			await drawTimeContent(ctx, stats, size, palette, periodLabel, periodDays, contentX, contentY, contentW);
			break;
		case "genre":
			await drawGenreContent(ctx, stats, size, palette, contentX, contentY, contentW);
			break;
		case "streak":
			await drawStreakContent(ctx, stats, size, palette, contentX, contentY, contentW);
			break;
		case "throwback":
			await drawThrowbackContent(ctx, stats, size, palette, contentX, contentY, contentW, w);
			break;
		case "wrapped": {
			const clipTop = Math.max(0, contentTop - 24);
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, clipTop, w, h - wrapFooterReserve - clipTop);
			ctx.clip();
			await drawWrappedContent(
				ctx,
				stats,
				size,
				palette,
				periodLabel,
				contentX,
				contentY,
				contentW,
				allowStreak,
				captionText,
			);
			ctx.restore();
			break;
		}
	}

	drawFooterBar(ctx, w, h, captionText, palette);

	return canvas;
}

// ── Export functions ──

export async function renderShareCardBlob(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<Blob> {
	const canvas = await renderShareCardCanvas(stats, variant, size, periodLabel, username, options);
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("PNG blob creation failed"));
				return;
			}
			resolve(blob);
		}, "image/png");
	});
}

export async function exportShareCardPng(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<void> {
	const blob = await renderShareCardBlob(stats, variant, size, periodLabel, username, options);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "listening-stats-share.png";
	a.click();
	URL.revokeObjectURL(url);
}

export async function copyShareCardToClipboard(
	stats: StatsResult,
	variant: ShareVariant,
	size: ShareSize,
	periodLabel: string,
	username: string,
	options?: ShareRenderOptions,
): Promise<void> {
	const blob = await renderShareCardBlob(stats, variant, size, periodLabel, username, options);
	if (!navigator.clipboard?.write) {
		throw new Error("Clipboard API not available");
	}
	await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function shareOrDownload(blob: Blob): Promise<"shared" | "copied" | "downloaded"> {
	if (navigator.share) {
		try {
			const file = new File([blob], "listening-stats.png", { type: "image/png" });
			await navigator.share({ files: [file] });
			return "shared";
		} catch {
			/* fall through */
		}
	}
	try {
		await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
		return "copied";
	} catch {
		/* fall through */
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "listening-stats.png";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return "downloaded";
}
