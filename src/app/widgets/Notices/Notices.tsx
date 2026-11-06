/**
 * One quiet notice above the dashboard, at most: a new version, the monthly
 * recap, or a note from the developer, in that order of priority. Each can
 * be dismissed; nothing here blocks the page.
 */
import { useEffect, useState } from "react";
import { V2_KEYS } from "../../../shared/constants/storage-keys";
import {
	type Announcement,
	availableUpdate,
	fetchAnnouncement,
	type ReleaseInfo,
} from "../../../shared/remote/updates";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { useSetting } from "../../hooks/useSetting";
import { useApp } from "../../state";
import "./Notices.css";

const INSTALL_LINUX =
	"curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash";
const INSTALL_WIN = "irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex";
const SNOOZE_DAYS = 3;

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function copy(text: string): void {
	const api = Spicetify.Platform?.ClipboardAPI;
	if (api?.copy) void api.copy(text);
	else void navigator.clipboard?.writeText(text);
	Spicetify.showNotification("Copied. Paste it in a terminal.");
}

function UpdateNotice({ r, onClose }: { r: ReleaseInfo; onClose: () => void }) {
	const [open, setOpen] = useState(false);
	const isWin = navigator.userAgent.includes("Windows");
	return (
		<div className="ls-notice" role="status">
			<div className="ls-notice-row">
				<p className="ls-notice-text">
					<strong>Listening Stats {r.version}</strong> is out{r.prerelease ? " (beta)" : ""}.
				</p>
				<div className="ls-notice-actions">
					<button type="button" className="ls-link" onClick={() => setOpen(!open)} aria-expanded={open}>
						{open ? "Hide details" : "What's new"}
					</button>
					<button
						type="button"
						className="ls-icon-btn"
						aria-label="Remind me later"
						data-tip="Remind me in a few days"
						onClick={onClose}
					>
						<Icon name="close" />
					</button>
				</div>
			</div>
			{open && (
				<div className="ls-notice-more">
					{r.notes ? <Markdown source={r.notes} /> : <p className="ls-muted">No notes for this release.</p>}
					<p className="ls-set-hint">To update, run this in a terminal, then restart Spotify:</p>
					<div className="ls-notice-cmd">
						<code>{isWin ? INSTALL_WIN : INSTALL_LINUX}</code>
						<button
							type="button"
							className="ls-btn-secondary"
							onClick={() => copy(isWin ? INSTALL_WIN : INSTALL_LINUX)}
						>
							Copy
						</button>
					</div>
					<a className="ls-link" href={r.url} target="_blank" rel="noreferrer noopener">
						Open the release on GitHub
					</a>
				</div>
			)}
		</div>
	);
}

export function Notices() {
	const { setPeriod, provider } = useApp();
	const [beta] = useSetting("betaUpdates");
	const [showAnn] = useSetting("showAnnouncements");
	const [update, setUpdate] = useState<ReleaseInfo | null>(null);
	const [ann, setAnn] = useState<Announcement | null>(null);
	const [, rerender] = useState(0);

	useEffect(() => {
		void availableUpdate(beta).then(setUpdate, () => setUpdate(null));
	}, [beta]);
	useEffect(() => {
		if (showAnn) void fetchAnnouncement().then(setAnn, () => setAnn(null));
	}, [showAnn]);

	const snoozed = Number(localStorage.getItem(V2_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL) ?? 0) > Date.now();
	if (update && !snoozed) {
		return (
			<UpdateNotice
				r={update}
				onClose={() => {
					localStorage.setItem(V2_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL, String(Date.now() + SNOOZE_DAYS * 86_400_000));
					rerender((n) => n + 1);
				}}
			/>
		);
	}

	const now = new Date();
	const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const recapOpen =
		now.getDate() <= 7 &&
		localStorage.getItem(V2_KEYS.RECAP_DISMISSED_MONTH) !== monthKey() &&
		provider.periods.includes("last-month");
	if (recapOpen) {
		const name = lastMonth.toLocaleString(undefined, { month: "long" });
		const dismiss = () => {
			localStorage.setItem(V2_KEYS.RECAP_DISMISSED_MONTH, monthKey());
			rerender((n) => n + 1);
		};
		return (
			<div className="ls-notice" role="status">
				<div className="ls-notice-row">
					<p className="ls-notice-text">
						<strong>{name} is done.</strong> See what you played most.
					</p>
					<div className="ls-notice-actions">
						<button
							type="button"
							className="ls-btn-primary"
							onClick={() => {
								setPeriod("last-month");
								dismiss();
							}}
						>
							Show {name}
						</button>
						<button type="button" className="ls-icon-btn" aria-label="Dismiss" onClick={dismiss}>
							<Icon name="close" />
						</button>
					</div>
				</div>
			</div>
		);
	}

	if (showAnn && ann && localStorage.getItem(V2_KEYS.DISMISSED_REMOTE_ANNOUNCEMENT_ID) !== ann.id) {
		return (
			<div className="ls-notice" role="status">
				<div className="ls-notice-row">
					<div className="ls-notice-text">
						<strong>{ann.title}</strong>
						{ann.body && <Markdown source={ann.body} />}
					</div>
					<button
						type="button"
						className="ls-icon-btn"
						aria-label="Dismiss"
						onClick={() => {
							localStorage.setItem(V2_KEYS.DISMISSED_REMOTE_ANNOUNCEMENT_ID, ann.id);
							rerender((n) => n + 1);
						}}
					>
						<Icon name="close" />
					</button>
				</div>
			</div>
		);
	}
	return null;
}
