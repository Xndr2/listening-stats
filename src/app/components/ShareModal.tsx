import { LS_KEYS } from "../../shared/constants/storage-keys";
import { providerRegistry } from "../../shared/stats/provider";
import type { Period, StatsResult } from "../../shared/types/stats";
import { CloseIcon } from "../icons";
import type { ShareSize, ShareVariant } from "./share-cards";
import { copyShareCardToClipboard, exportShareCardPng, getAvailableVariants, renderShareCardBlob } from "./share-cards";
import { Toggle } from "./spicetify-ui";

export type { ShareRenderOptions, ShareSize, ShareVariant } from "./share-cards";
// Canvas engine lives in share-cards.ts; re-export the public surface so
// existing importers (App, tests) keep working.
export {
	copyShareCardToClipboard,
	exportShareCardPng,
	getAvailableVariants,
	loadImage,
	renderShareCardBlob,
	renderShareCardCanvas,
	shareOrDownload,
} from "./share-cards";

const { useState, useCallback, useEffect, useMemo } = Spicetify.React;

interface ShareModalProps {
	stats: StatsResult;
	activePeriod: Period;
	onClose: () => void;
	initialVariant?: ShareVariant;
	/** Restrict selectable card types (e.g. monthly recap locks to ["recap"]). */
	variantIds?: ShareVariant[];
	/** Modal heading override (default "Share Cards"). */
	title?: string;
}

const SIZES: { id: ShareSize; label: string }[] = [
	{ id: "square", label: "Square" },
	{ id: "story", label: "Story" },
];

function getStatsfmHandle(): string {
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
	return "";
}

export function ShareModal({ stats, activePeriod, onClose, initialVariant, variantIds, title }: ShareModalProps) {
	const [variant, setVariant] = useState<ShareVariant>(initialVariant ?? "top5");
	const [size, setSize] = useState<ShareSize>("square");
	const [followTheme, setFollowTheme] = useState(false);
	const [showUsername, setShowUsername] = useState(true);
	const [showPeriodLabel, setShowPeriodLabel] = useState(true);
	const [busy, setBusy] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string>("");
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	const [username, setUsername] = useState(getStatsfmHandle);
	// Fall back to the Spotify account handle via Platform.UserAPI (async,
	// feature-detected - the API is missing on some client versions).
	useEffect(() => {
		if (username) return;
		let cancelled = false;
		Spicetify.Platform.UserAPI?.getUser?.()
			.then((user) => {
				const handle = (user?.displayName ?? user?.username ?? "").trim();
				if (!cancelled && handle) setUsername(handle);
			})
			.catch(() => {
				/* keep empty caption */
			});
		return () => {
			cancelled = true;
		};
	}, [username]);
	const periodLabel = activePeriod.label;
	const periodBoundaries = activePeriod.getBoundaries();
	const periodDayCount = Math.max(1, Math.round((periodBoundaries.end - periodBoundaries.start) / 86_400_000));
	const activeProviderId = providerRegistry.getActiveId() ?? "local";
	const caps = providerRegistry.getActive()?.getProviderInfo().capabilities;
	const availableVariants = useMemo(() => getAvailableVariants(stats, caps, variantIds), [caps, stats, variantIds]);

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
					hasStreakData: caps?.hasStreakData ?? false,
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
				hasStreakData: caps?.hasStreakData ?? false,
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
				hasStreakData: caps?.hasStreakData ?? false,
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
					<h2 className="share-modal-title">{title ?? "Share Cards"}</h2>
					<button
						type="button"
						className="share-modal-close stats-header-icon-btn"
						onClick={onClose}
						aria-label="Close share modal"
						dangerouslySetInnerHTML={{ __html: CloseIcon }}
					/>
				</div>

				{availableVariants.length > 1 && (
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
				)}

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
