import { applyPlaylistVisibility, buildTopSongsPlaylist } from "../../../shared/playlist/builder";
import {
	getPlaylistConfig,
	getPlaylistPeriods,
	getPlaylistState,
	PLAYLIST_TRACK_COUNTS,
	type PlaylistProviderId,
	setPlaylistConfig,
} from "../../../shared/playlist/config";
import { OptionGroup, SettingRow, SettingsGroup, SettingToggle } from "./controls";

const { useState } = Spicetify.React;

const PROVIDER_OPTIONS: { value: PlaylistProviderId; label: string }[] = [
	{ value: "local", label: "Local" },
	{ value: "statsfm", label: "stats.fm" },
];

const COUNT_OPTIONS = PLAYLIST_TRACK_COUNTS.map((n) => ({ value: n, label: String(n) }));

function notifyBuildResult(result: Awaited<ReturnType<typeof buildTopSongsPlaylist>>): void {
	if (result.status === "built") {
		Spicetify.showNotification(`Playlist updated with your top ${result.trackCount} tracks`);
	} else if (result.status === "skipped" && result.reason === "no-tracks") {
		Spicetify.showNotification("No tracks with Spotify links found for this period yet", true);
	} else if (result.status === "error") {
		Spicetify.showNotification(`Playlist update failed: ${result.message}`, true);
	}
}

export function PlaylistTab() {
	const [config, setConfig] = useState(() => getPlaylistConfig());
	const [building, setBuilding] = useState(false);

	const runBuild = async () => {
		if (building) return;
		setBuilding(true);
		try {
			notifyBuildResult(await buildTopSongsPlaylist());
		} finally {
			setBuilding(false);
		}
	};

	const handleEnabled = (val: boolean) => {
		setConfig(setPlaylistConfig({ enabled: val }));
		// Build right away on enable so the playlist appears without waiting for the next day
		if (val) void runBuild();
	};

	const handleTrackCount = (val: number) => {
		setConfig(setPlaylistConfig({ trackCount: val }));
	};

	const handleProvider = (val: PlaylistProviderId) => {
		const periods = getPlaylistPeriods(val);
		const current = getPlaylistConfig().periodId;
		const periodId = periods.some((p) => p.id === current) ? current : periods[0].id;
		setConfig(setPlaylistConfig({ providerId: val, periodId }));
	};

	const handlePeriod = (val: string) => {
		setConfig(setPlaylistConfig({ periodId: val }));
	};

	const handlePublic = (val: boolean) => {
		setConfig(setPlaylistConfig({ isPublic: val }));
		// Flip the existing playlist right away instead of waiting for the next build
		void applyPlaylistVisibility(val);
	};

	const periodOptions = getPlaylistPeriods(config.providerId).map((p) => ({ value: p.id, label: p.label }));
	const playlistUri = getPlaylistState().playlistUri;

	return (
		<div>
			<SettingsGroup title="Auto playlist">
				<SettingRow
					label="Daily top songs playlist"
					sublabel="Creates a playlist from your top tracks and refreshes it once per day"
					testId="playlist-enabled"
				>
					<SettingToggle value={config.enabled} onChange={handleEnabled} />
				</SettingRow>
				<SettingRow
					label="Public playlist"
					sublabel="Private by default; turn on to make it visible on your profile"
					testId="playlist-public"
				>
					<SettingToggle value={config.isPublic} onChange={handlePublic} />
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Contents">
				<SettingRow label="Songs">
					<OptionGroup options={COUNT_OPTIONS} value={config.trackCount} onChange={handleTrackCount} />
				</SettingRow>
				<SettingRow label="Source" sublabel="Last.fm can't be used: it doesn't expose Spotify track links">
					<OptionGroup
						options={PROVIDER_OPTIONS}
						value={config.providerId}
						onChange={handleProvider}
						testId="playlist-provider"
					/>
				</SettingRow>
				<SettingRow label="Period" sublabel='"Today" is not offered - too little history to fill a playlist' stacked>
					<OptionGroup
						options={periodOptions}
						value={config.periodId}
						onChange={handlePeriod}
						testId="playlist-period"
					/>
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Actions">
				<SettingRow
					label="Update now"
					sublabel={
						config.enabled
							? "Setting changes apply on the next daily refresh, or immediately with this button"
							: "Enable the playlist above first"
					}
				>
					<button
						type="button"
						className="btn-secondary"
						disabled={!config.enabled || building}
						onClick={() => void runBuild()}
						style={{ padding: "4px 12px" }}
						data-testid="playlist-update-now"
					>
						{building ? "Updating…" : "Update"}
					</button>
				</SettingRow>
				{playlistUri && (
					<SettingRow label="Open playlist">
						<button
							type="button"
							className="btn-secondary"
							onClick={() => Spicetify.Platform.History.push(`/playlist/${playlistUri.split(":").pop()}`)}
							style={{ padding: "4px 12px" }}
						>
							Open
						</button>
					</SettingRow>
				)}
			</SettingsGroup>
		</div>
	);
}
