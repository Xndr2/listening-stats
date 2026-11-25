/**
 * One quiet notice above the dashboard, at most: the Last.fm Pro change, the
 * monthly recap, or a note from the developer, in that order. Each can be dismissed; nothing here
 * blocks the page. (A new version shows as its own popup, see UpdateDialog.)
 */
import { useEffect, useState } from "react";
import { V2_KEYS, V3_KEYS } from "../../../shared/constants/storage-keys";
import { readLastFmConfig } from "../../../shared/providers/lastfm/client";
import { type Announcement, fetchAnnouncement } from "../../../shared/remote/updates";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { useSetting } from "../../hooks/useSetting";
import { useApp } from "../../state";
import "./Notices.css";

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function Notices() {
	const { setPeriod, provider, setSettingsOpen } = useApp();
	const [showAnn] = useSetting("showAnnouncements");
	const [ann, setAnn] = useState<Announcement | null>(null);
	const [, rerender] = useState(0);

	useEffect(() => {
		if (showAnn) void fetchAnnouncement().then(setAnn, () => setAnn(null));
	}, [showAnn]);

	// Shown once to anyone with Last.fm connected (including setups carried over from v2) until dismissed
	if (readLastFmConfig() && !localStorage.getItem(V3_KEYS.LASTFM_PRO_NOTICE_DISMISSED)) {
		const dismiss = () => {
			localStorage.setItem(V3_KEYS.LASTFM_PRO_NOTICE_DISMISSED, "1");
			rerender((n) => n + 1);
		};
		return (
			<div className="ls-notice" role="status">
				<div className="ls-notice-row">
					<p className="ls-notice-text">
						<strong>Last.fm now needs Pro.</strong> Since 1 December, Last.fm only accepts API keys from accounts with
						Last.fm Pro. If your account doesn't have it, Last.fm stats will stop loading. Local and stats.fm still
						work.
					</p>
					<div className="ls-notice-actions">
						<button
							type="button"
							className="ls-btn-primary"
							onClick={() => {
								setSettingsOpen(true);
								dismiss();
							}}
						>
							Open settings
						</button>
						<button type="button" className="ls-icon-btn" aria-label="Dismiss" onClick={dismiss}>
							<Icon name="close" />
						</button>
					</div>
				</div>
			</div>
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
