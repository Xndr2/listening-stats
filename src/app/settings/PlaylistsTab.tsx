import { useEffect, useState } from "react";
import { EVENTS, listen } from "../../shared/constants/events";
import { captureError } from "../../shared/errors/capture";
import {
	PLAYLIST_PERIODS,
	PLAYLIST_REFRESH,
	PLAYLIST_SIZES,
	type PlaylistRefresh,
	type PlaylistSource,
} from "../../shared/playlists/marker";
import { spotifyPlaylistApi } from "../../shared/playlists/spotify-api";
import {
	getPlaylists,
	newPlaylistId,
	type PlaylistConfig,
	savePlaylists,
	updatePlaylist,
} from "../../shared/playlists/store";
import { adopt, autoName, type BuildStatus, build, managedElsewhere, release } from "../../shared/playlists/sync";
import { PERIOD_LABELS } from "../../shared/providers/periods";
import { isConnected } from "../../shared/providers/registry";
import { Select } from "../components/Select/Select";
import { openUri } from "../spotify";
import { ChoiceRow, Row, Section, Switch } from "./controls";

const REFRESH_LABEL: Record<PlaylistRefresh, string> = {
	daily: "Every day",
	weekly: "Every week",
	manual: "Only when I ask",
};
const SOURCE_LABEL: Record<PlaylistSource, string> = { local: "This device", statsfm: "stats.fm" };

function lastBuiltText(c: PlaylistConfig): string {
	if (!c.lastBuilt) return "Not created yet";
	const d = new Date(
		Number(c.lastBuilt.slice(0, 4)),
		Number(c.lastBuilt.slice(4, 6)) - 1,
		Number(c.lastBuilt.slice(6, 8)),
	);
	const days = Math.round((new Date().setHours(0, 0, 0, 0) - d.getTime()) / 86_400_000);
	return days <= 0 ? "Updated today" : days === 1 ? "Updated yesterday" : `Updated ${days} days ago`;
}

function statusText(r: BuildStatus): string {
	switch (r.status) {
		case "built":
			return r.changed ? `Updated with ${r.tracks} tracks.` : "Already up to date.";
		case "error":
			return `Couldn't update: ${r.message}`;
		default:
			return r.reason === "no-tracks"
				? "Nothing to add yet for this period. It fills in once you've listened a bit."
				: r.reason === "elsewhere"
					? "Another device keeps this one up to date."
					: "Nothing to do right now.";
	}
}

function Editor({ value, onChange }: { value: PlaylistConfig; onChange: (patch: Partial<PlaylistConfig>) => void }) {
	const sources = (["local", "statsfm"] as const).filter((s) => s === "local" || isConnected(s));
	return (
		<>
			{sources.length > 1 && (
				<ChoiceRow
					label="Based on"
					value={value.source}
					onChange={(source) => onChange({ source })}
					options={sources.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
				/>
			)}
			<Row
				label="Period"
				control={
					<Select
						label="Period"
						value={value.period}
						onChange={(period) => onChange({ period })}
						options={PLAYLIST_PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
					/>
				}
			/>
			<ChoiceRow
				label="Tracks"
				value={String(value.size)}
				onChange={(v) => onChange({ size: Number(v) })}
				options={PLAYLIST_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
			/>
			<ChoiceRow
				label="Update"
				value={value.refresh}
				onChange={(refresh) => onChange({ refresh })}
				options={PLAYLIST_REFRESH.map((r) => ({ value: r, label: REFRESH_LABEL[r] }))}
			/>
		</>
	);
}

function PlaylistCard({ c }: { c: PlaylistConfig }) {
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const elsewhere = managedElsewhere(c);
	const run = async (opts: { force?: boolean; takeOver?: boolean }) => {
		const api = spotifyPlaylistApi();
		if (!api) return setMsg("This Spotify version doesn't let apps edit playlists.");
		setBusy(true);
		const r = await build(api, c.id, { force: true, ...opts });
		if (r.status === "error") void captureError(new Error(r.message), "app", "handled", "playlists");
		setMsg(statusText(r));
		setBusy(false);
	};
	return (
		<div className="ls-pl-card">
			<div className="ls-pl-head">
				<div>
					<p className="ls-set-label">{c.name || autoName(c)}</p>
					<p className="ls-set-hint">
						Top {c.size} · {PERIOD_LABELS[c.period]} · {SOURCE_LABEL[c.source]} ·{" "}
						{REFRESH_LABEL[c.refresh].toLowerCase()} · {elsewhere ? "updated from another device" : lastBuiltText(c)}
					</p>
				</div>
				<div className="ls-set-buttons">
					{c.uri && (
						<button type="button" className="ls-btn-secondary" onClick={() => openUri(c.uri as string)}>
							Open
						</button>
					)}
					{elsewhere ? (
						<button
							type="button"
							className="ls-btn-secondary"
							disabled={busy}
							onClick={() => void run({ takeOver: true })}
						>
							Update from here instead
						</button>
					) : (
						<button type="button" className="ls-btn-primary" disabled={busy} onClick={() => void run({})}>
							{busy ? "Updating…" : c.uri ? "Update now" : "Create"}
						</button>
					)}
				</div>
			</div>
			{!elsewhere && (
				<div className="ls-set-rows">
					<Editor
						value={c}
						onChange={(patch) => {
							updatePlaylist(c.id, { ...patch, edited: true });
							setMsg("Saved. The playlist changes at its next update, or press Update now.");
						}}
					/>
					<Row
						label="Visible on your profile"
						control={
							<Switch
								label="Visible on your profile"
								checked={c.isPublic}
								onChange={(isPublic) => {
									updatePlaylist(c.id, { isPublic });
									if (c.uri)
										void spotifyPlaylistApi()
											?.setPublic(c.uri, isPublic)
											.catch(() => {});
								}}
							/>
						}
					/>
				</div>
			)}
			<div className="ls-pl-foot">
				{msg && <span className="ls-set-msg">{msg}</span>}
				<button
					type="button"
					className="ls-link"
					onClick={() => {
						const api = spotifyPlaylistApi();
						if (api) void release(api, c.id);
						else savePlaylists(getPlaylists().filter((p) => p.id !== c.id));
					}}
				>
					Stop updating this playlist
				</button>
			</div>
		</div>
	);
}

export function PlaylistsTab() {
	const [list, setList] = useState(getPlaylists);
	const [draft, setDraft] = useState<PlaylistConfig | null>(null);
	useEffect(() => listen(EVENTS.PLAYLISTS_CHANGED, () => setList(getPlaylists())), []);
	useEffect(() => {
		// Pick up playlists made on other devices or before a reinstall.
		const api = spotifyPlaylistApi();
		if (api) void adopt(api).catch((e) => captureError(e, "app", "handled", "playlists"));
	}, []);
	const available = !!spotifyPlaylistApi();

	return (
		<>
			<Section
				title="Auto playlists"
				description="Playlists of your top tracks that keep themselves up to date. They live in your Spotify library, so they're on all your devices. Listening Stats finds them again after a reinstall."
			>
				{!available && <p className="ls-set-msg is-err">This Spotify version doesn't let apps edit playlists.</p>}
				{list.length === 0 && !draft && <p className="ls-muted">No auto playlists yet.</p>}
				{list.map((c) => (
					<PlaylistCard key={c.id} c={c} />
				))}
			</Section>
			{draft ? (
				<Section title="New playlist">
					<Editor value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
					<div className="ls-set-buttons ls-pl-actions">
						<button type="button" className="ls-btn-secondary" onClick={() => setDraft(null)}>
							Cancel
						</button>
						<button
							type="button"
							className="ls-btn-primary"
							disabled={!available}
							onClick={() => {
								savePlaylists([...getPlaylists(), draft]);
								const api = spotifyPlaylistApi();
								if (api) void build(api, draft.id, { force: true });
								setDraft(null);
							}}
						>
							Create playlist
						</button>
					</div>
				</Section>
			) : (
				<div>
					<button
						type="button"
						className="ls-btn-primary"
						disabled={!available}
						onClick={() =>
							setDraft({
								id: newPlaylistId(),
								uri: null,
								name: "",
								autoName: true,
								source: "local",
								period: "this-month",
								size: 20,
								refresh: "daily",
								isPublic: false,
								lastBuilt: "",
								owner: "",
								edited: false,
							})
						}
					>
						Add a playlist
					</button>
				</div>
			)}
		</>
	);
}
