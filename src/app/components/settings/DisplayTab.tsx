import { EVENTS } from "../../../shared/constants/events";
import { providerRegistry } from "../../../shared/stats/provider";
import { getSectionsForProvider } from "../../capabilities";
import { useSettingsSortable } from "../../hooks/useSettingsSortable";
import {
	COLUMN_IDS,
	COLUMN_LABELS,
	getPreferences,
	OVERVIEW_CARD_IDS,
	OVERVIEW_CARD_LABELS,
	type OverviewProviderKey,
	type PlayCountVariant,
	SECTION_IDS,
	setPreference,
} from "../../preferences";
import { SortableRow } from "./SortableRow";
import { SortableTile } from "./SortableTile";

const { useState, useRef, useCallback, useEffect } = Spicetify.React;

const SECTION_LABELS: Record<string, string> = {
	overview: "Overview",
	"top-genres": "Top Genres",
	"top-lists": "Top Lists",
	activity: "Activity",
	consistency: "Consistency",
	"recently-played": "Recently Played",
};

const ITEMS_OPTIONS = [3, 5, 10] as const;

interface DisplayTabProps {
	onPrefsChanged: () => void;
	onRestartTour?: () => void;
	announcementDismissKey?: string | null;
}

interface LayoutSnapshot {
	hiddenSections: string[];
	sectionOrder: string[];
	columnOrder: string[];
	overviewOrder: { local: string[]; statsfm: string[] };
}

export function DisplayTab({
	onPrefsChanged,
	onRestartTour,
	announcementDismissKey = null,
}: DisplayTabProps) {
	const [prefs, setPrefs] = useState(() => getPreferences());
	const [layoutUndo, setLayoutUndo] = useState<LayoutSnapshot | null>(null);

	const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const dispatchPrefsChanged = useCallback(() => {
		onPrefsChanged();
		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
	}, [onPrefsChanged]);

	const handleItemsPerSection = (val: number) => {
		setPreference("itemsPerSection", val);
		setPrefs({ ...prefs, itemsPerSection: val });
		dispatchPrefsChanged();
	};

	const handlePlayCountVariant = (val: PlayCountVariant) => {
		setPreference("playCountVariant", val);
		if (val === "off") {
			setPreference("playCountShowPeriodStreams", false);
		}
		setPrefs({
			...prefs,
			playCountVariant: val,
			...(val === "off" ? { playCountShowPeriodStreams: false } : {}),
		});
		dispatchPrefsChanged();
	};

	const handlePlayCountPeriodStreams = (val: boolean) => {
		setPreference("playCountShowPeriodStreams", val);
		setPrefs({ ...prefs, playCountShowPeriodStreams: val });
		dispatchPrefsChanged();
	};

	const handle24HourTime = (val: boolean) => {
		setPreference("use24HourTime", val);
		setPrefs({ ...prefs, use24HourTime: val });
		dispatchPrefsChanged();
	};

	const handleShowAnnouncementBanner = (val: boolean) => {
		if (!val) {
			setPreference("showAnnouncementBanner", false);
			setPreference("announcementBannerHiddenForDismissKey", announcementDismissKey ?? "");
		} else {
			setPreference("showAnnouncementBanner", true);
			setPreference("announcementBannerHiddenForDismissKey", "");
		}
		setPrefs(getPreferences());
		dispatchPrefsChanged();
	};

	const handleResetLayout = () => {
		setLayoutUndo({
			hiddenSections: [...prefs.hiddenSections],
			sectionOrder: [...prefs.sectionOrder],
			columnOrder: [...prefs.columnOrder],
			overviewOrder: {
				local: [...prefs.overviewOrder.local],
				statsfm: [...prefs.overviewOrder.statsfm],
			},
		});
		const resetSectionOrder = [...SECTION_IDS];
		const resetColumnOrder = [...COLUMN_IDS];
		const resetOverviewOrder = {
			local: [...OVERVIEW_CARD_IDS.local],
			statsfm: [...OVERVIEW_CARD_IDS.statsfm],
		};
		setPreference("hiddenSections", []);
		setPreference("sectionOrder", resetSectionOrder);
		setPreference("columnOrder", resetColumnOrder);
		setPreference("overviewOrder", resetOverviewOrder);
		setPrefs((p) => ({
			...p,
			hiddenSections: [],
			sectionOrder: resetSectionOrder,
			columnOrder: resetColumnOrder,
			overviewOrder: resetOverviewOrder,
		}));
		dispatchPrefsChanged();
	};

	const handleUndoResetLayout = () => {
		if (!layoutUndo) return;
		setPreference("hiddenSections", layoutUndo.hiddenSections);
		setPreference("sectionOrder", layoutUndo.sectionOrder);
		setPreference("columnOrder", layoutUndo.columnOrder);
		setPreference("overviewOrder", layoutUndo.overviewOrder);
		setPrefs((p) => ({
			...p,
			hiddenSections: layoutUndo.hiddenSections,
			sectionOrder: layoutUndo.sectionOrder,
			columnOrder: layoutUndo.columnOrder,
			overviewOrder: layoutUndo.overviewOrder,
		}));
		setLayoutUndo(null);
		dispatchPrefsChanged();
	};

	const handleToggleSection = (sectionId: string, visible: boolean) => {
		const newHidden = visible
			? prefs.hiddenSections.filter((s) => s !== sectionId)
			: [...prefs.hiddenSections, sectionId];
		setPreference("hiddenSections", newHidden);
		setPrefs({ ...prefs, hiddenSections: newHidden });
		dispatchPrefsChanged();
	};

	const handleSectionReorder = useCallback(
		(next: string[]) => {
			const untouched = prefs.sectionOrder.filter((id) => !next.includes(id));
			const merged = [...next, ...untouched];
			setPreference("sectionOrder", merged);
			setPrefs((p) => ({ ...p, sectionOrder: merged }));
			dispatchPrefsChanged();
		},
		[prefs.sectionOrder, dispatchPrefsChanged],
	);

	const [providerKey, setProviderKey] = useState<OverviewProviderKey>(() =>
		providerRegistry.getActiveId() === "statsfm" ? "statsfm" : "local",
	);
	const providerCaps = providerRegistry.getActive()?.getProviderInfo().capabilities ?? {
		hasActivityData: true,
		hasConsistencyData: false,
		hasGenreData: true,
		hasStreakData: true,
		hasSkipRate: false,
		tier: "n/a" as const,
	};
	const knownSet = new Set<string>(SECTION_IDS as readonly string[]);
	const allowedSections = new Set(getSectionsForProvider(providerCaps).map((s) => s.id));
	const sectionOrder = prefs.sectionOrder.filter(
		(id) => knownSet.has(id) && allowedSections.has(id),
	);

	const sortable = useSettingsSortable({
		order: sectionOrder,
		onReorder: handleSectionReorder,
	});

	useEffect(() => {
		const handler = () => {
			const id = providerRegistry.getActiveId();
			setProviderKey(id === "statsfm" ? "statsfm" : "local");
		};
		window.addEventListener(EVENTS.PROVIDER_CHANGED, handler);
		return () => window.removeEventListener(EVENTS.PROVIDER_CHANGED, handler);
	}, []);

	const overviewOrder = prefs.overviewOrder[providerKey];
	const overviewTop = overviewOrder.slice(0, 4);
	const overviewBottom = overviewOrder.slice(4);

	const handleOverviewTopReorder = useCallback(
		(next: string[]) => {
			const full = [...next, ...prefs.overviewOrder[providerKey].slice(4)];
			const merged = { ...prefs.overviewOrder, [providerKey]: full };
			setPreference("overviewOrder", merged);
			setPrefs((p) => ({ ...p, overviewOrder: merged }));
			dispatchPrefsChanged();
		},
		[prefs.overviewOrder, providerKey, dispatchPrefsChanged],
	);

	const overviewTopSortable = useSettingsSortable({
		order: overviewTop,
		orientation: "grid",
		onReorder: handleOverviewTopReorder,
	});

	const handleOverviewBottomReorder = useCallback(
		(next: string[]) => {
			const full = [...prefs.overviewOrder[providerKey].slice(0, 4), ...next];
			const merged = { ...prefs.overviewOrder, [providerKey]: full };
			setPreference("overviewOrder", merged);
			setPrefs((p) => ({ ...p, overviewOrder: merged }));
			dispatchPrefsChanged();
		},
		[prefs.overviewOrder, providerKey, dispatchPrefsChanged],
	);

	const overviewBottomSortable = useSettingsSortable({
		order: overviewBottom,
		orientation: "horizontal",
		onReorder: handleOverviewBottomReorder,
	});

	const handleColumnReorder = useCallback(
		(next: string[]) => {
			setPreference("columnOrder", next);
			setPrefs((p) => ({ ...p, columnOrder: next }));
			dispatchPrefsChanged();
		},
		[dispatchPrefsChanged],
	);

	const columnSortable = useSettingsSortable({
		order: prefs.columnOrder,
		orientation: "horizontal",
		onReorder: handleColumnReorder,
	});

	const topListsCoarseHidden = prefs.hiddenSections.includes("top-lists");

	const Toggle = Spicetify.ReactComponent.Toggle;

	const renderSortableTile = (
		id: string,
		labels: Record<string, string>,
		sortable: ReturnType<typeof useSettingsSortable>,
		order: string[],
	) => {
		const visible = !prefs.hiddenSections.includes(id);
		const label = labels[id] ?? id;
		const isDropTarget =
			sortable.dragState.isDragging &&
			sortable.dragState.dropSlotIndex != null &&
			order[sortable.dragState.dropSlotIndex] === id &&
			sortable.dragState.activeId !== id;
		return (
			<div
				key={id}
				ref={(el: HTMLDivElement | null) => sortable.registerItem(id, el)}
				style={
					isDropTarget
						? {
								outline: "2px solid var(--spice-button-active)",
								outlineOffset: "-2px",
								borderRadius: "6px",
							}
						: undefined
				}
			>
				<SortableTile
					id={id}
					label={label}
					tileDragProps={{ onPointerDown: sortable.onItemPointerDown(id) }}
					style={sortable.getItemStyle(id)}
				>
					{Toggle ? (
						<Toggle value={visible} onSelected={(val: boolean) => handleToggleSection(id, val)} />
					) : (
						<input
							type="checkbox"
							checked={visible}
							onChange={(e) => handleToggleSection(id, e.currentTarget.checked)}
						/>
					)}
				</SortableTile>
			</div>
		);
	};

	return (
		<div className="display-tab">
			<div className="settings-row">
				<div className="settings-label">Items per section</div>
				<div style={{ display: "flex", gap: "8px" }}>
					{ITEMS_OPTIONS.map((val) => (
						<button
							key={val}
							type="button"
							className={prefs.itemsPerSection === val ? "btn-primary" : "btn-secondary"}
							onClick={() => handleItemsPerSection(val)}
							style={{ padding: "4px 12px", minWidth: "40px" }}
						>
							{val}
						</button>
					))}
				</div>
			</div>
			{layoutUndo && (
				<div className="settings-row">
					<div className="settings-sublabel">Layout reset to defaults</div>
					<button
						type="button"
						className="btn-secondary"
						data-testid="undo-reset-layout"
						onClick={handleUndoResetLayout}
						style={{ padding: "4px 12px" }}
					>
						Undo
					</button>
				</div>
			)}

			<div className="settings-row">
				<div>
					<div className="settings-label">24-hour time</div>
					<div className="settings-sublabel">Show timestamps in 24-hour format</div>
				</div>
				{Toggle ? (
					<Toggle value={prefs.use24HourTime} onSelected={handle24HourTime} />
				) : (
					<input
						type="checkbox"
						checked={prefs.use24HourTime}
						onChange={(e) => handle24HourTime(e.currentTarget.checked)}
					/>
				)}
			</div>

			<div className="settings-row">
				<div>
					<div className="settings-label">Announcement banner</div>
					<div className="settings-sublabel">
						Show the banner when one is available (GitHub or version splash). Turning off hides it
						until the announcement changes or you turn this back on.
					</div>
				</div>
				{Toggle ? (
					<Toggle value={prefs.showAnnouncementBanner} onSelected={handleShowAnnouncementBanner} />
				) : (
					<input
						type="checkbox"
						checked={prefs.showAnnouncementBanner}
						onChange={(e) => handleShowAnnouncementBanner(e.currentTarget.checked)}
					/>
				)}
			</div>

			<div className="settings-row">
				<div>
					<div className="settings-label">Playbar play count</div>
					<div className="settings-sublabel">Widget style for now-playing track count</div>
				</div>
				<div data-testid="play-count-variant" style={{ display: "flex", gap: "8px" }}>
					{(["pill", "bubble", "minimal", "off"] as const).map((v) => (
						<button
							key={v}
							type="button"
							className={prefs.playCountVariant === v ? "btn-primary" : "btn-secondary"}
							onClick={() => handlePlayCountVariant(v)}
							style={{ padding: "4px 12px", minWidth: "40px" }}
						>
							{v === "off" ? "Off" : v.charAt(0).toUpperCase() + v.slice(1)}
						</button>
					))}
				</div>
			</div>

			{prefs.playCountVariant !== "off" && (
				<div className="settings-row" data-testid="play-count-extra-context">
					<div>
						<div className="settings-label">Extra play context</div>
						<div className="settings-sublabel">
							{providerKey === "statsfm" ? (
								<>Also show streams for your current dashboard period (stats.fm top tracks).</>
							) : (
								<>
									When this track has <strong>no qualifying plays</strong> in your database yet,
									show a <strong>New play</strong> hint on the playbar (skips excluded).
								</>
							)}
						</div>
					</div>
					{Toggle ? (
						<Toggle
							value={prefs.playCountShowPeriodStreams}
							onSelected={handlePlayCountPeriodStreams}
						/>
					) : (
						<input
							type="checkbox"
							checked={prefs.playCountShowPeriodStreams}
							onChange={(e) => handlePlayCountPeriodStreams(e.currentTarget.checked)}
						/>
					)}
				</div>
			)}



			<div className="settings-row">
				<div>
					<div className="settings-label">Layout</div>
					<div className="settings-sublabel">Reset section and card arrangement to defaults</div>
				</div>
				<button
					type="button"
					className="btn-secondary"
					data-testid="reset-layout"
					onClick={handleResetLayout}
					style={{ padding: "4px 12px" }}
				>
					Reset layout
				</button>
			</div>

			<div
				style={{ marginTop: "4px" }}
				data-drag-active={sortable.dragState.isDragging ? "true" : "false"}
			>
				<div className="settings-label" style={{ padding: "12px 0 4px" }}>
					Visible sections
				</div>
				<div
					className="settings-drop-line"
					data-active={
						sortable.dragState.isDragging && sortable.dragState.dropSlotIndex === 0
							? "true"
							: "false"
					}
				/>
				{sectionOrder.map((id, idx) => {
					const visible = !prefs.hiddenSections.includes(id);
					const label = SECTION_LABELS[id] ?? id;
					return (
						<Spicetify.React.Fragment key={id}>
							<div
								ref={(el: HTMLDivElement | null) => {
									if (el) rowRefs.current.set(id, el);
									else rowRefs.current.delete(id);
									sortable.registerItem(id, el);
								}}
							>
								<SortableRow
									id={id}
									label={label}
									dragHandleProps={{ onPointerDown: sortable.onItemPointerDown(id) }}
									style={sortable.getItemStyle(id)}
								>
									{Toggle ? (
										<Toggle
											value={visible}
											onSelected={(val: boolean) => handleToggleSection(id, val)}
										/>
									) : (
										<input
											type="checkbox"
											checked={visible}
											onChange={(e) => handleToggleSection(id, e.currentTarget.checked)}
										/>
									)}
								</SortableRow>
							</div>
							<div
								className="settings-drop-line"
								data-active={
									sortable.dragState.isDragging && sortable.dragState.dropSlotIndex === idx + 1
										? "true"
										: "false"
								}
							/>
						</Spicetify.React.Fragment>
					);
				})}
			</div>

			<div style={{ marginTop: "16px" }} key={providerKey}>
				<div className="settings-label" style={{ padding: "12px 0 4px" }}>
					Overview details
				</div>
				<div className="overview-settings-top">
					<div className="overview-settings-hero" data-testid="overview-settings-hero">
						<div className="sortable-tile-label">Total Time</div>
						<div className="overview-settings-hero-sub">Fixed</div>
					</div>
					<div className="sortable-grid sortable-grid--2x2">
						{overviewTop.map((id) =>
							renderSortableTile(id, OVERVIEW_CARD_LABELS, overviewTopSortable, overviewTop),
						)}
					</div>
				</div>
				{overviewBottom.length > 0 && (
					<div className="sortable-grid sortable-grid--1x3" data-testid="overview-bottom-row">
						{overviewBottom.map((id) =>
							renderSortableTile(id, OVERVIEW_CARD_LABELS, overviewBottomSortable, overviewBottom),
						)}
					</div>
				)}
			</div>

			<div
				data-testid="top-lists-columns-subsection"
				style={{
					marginTop: "16px",
					opacity: topListsCoarseHidden ? 0.4 : 1,
					pointerEvents: topListsCoarseHidden ? "none" : "auto",
				}}
			>
				<div className="settings-label" style={{ padding: "12px 0 4px" }}>
					Top Lists columns
				</div>
				{topListsCoarseHidden && (
					<div className="settings-sublabel" style={{ marginBottom: "4px" }}>
						Top Lists is hidden. Re-enable it above to manage individual columns.
					</div>
				)}
				<div className="sortable-grid sortable-grid--1x3">
					{prefs.columnOrder.map((id) =>
						renderSortableTile(id, COLUMN_LABELS, columnSortable, prefs.columnOrder),
					)}
				</div>
			</div>

			{onRestartTour && (
				<div className="settings-row" style={{ marginTop: "16px" }}>
					<div>
						<div className="settings-label">Guided tour</div>
						<div className="settings-sublabel">Walk through dashboard features</div>
					</div>
					<button
						type="button"
						className="btn-secondary"
						data-testid="restart-tour"
						onClick={onRestartTour}
						style={{ padding: "4px 12px" }}
					>
						Restart
					</button>
				</div>
			)}
		</div>
	);
}
