/**
 * One quiet notice above the dashboard, at most: the monthly recap or a note
 * from the developer, in that order. Each can be dismissed; nothing here
 * blocks the page. (A new version shows as its own popup, see UpdateDialog.)
 */
import { useEffect, useState } from "react";
import { V2_KEYS } from "../../../shared/constants/storage-keys";
import { type Announcement, fetchAnnouncement } from "../../../shared/remote/updates";
import { Icon } from "../../components/Icon";
import { Markdown } from "../../components/Markdown";
import { useSetting } from "../../hooks/useSetting";
import { useApp } from "../../state";
import "./Notices.css";

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function Notices() {
	const { setPeriod, provider } = useApp();
	const [showAnn] = useSetting("showAnnouncements");
	const [ann, setAnn] = useState<Announcement | null>(null);
	const [, rerender] = useState(0);

	useEffect(() => {
		if (showAnn) void fetchAnnouncement().then(setAnn, () => setAnn(null));
	}, [showAnn]);

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
