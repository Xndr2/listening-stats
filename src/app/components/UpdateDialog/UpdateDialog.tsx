/**
 * The new-version popup: a modal <dialog> with the scrollable changelog, the
 * one-line install command, and how to run it. It auto-opens on the dashboard
 * when an update is available (snoozed for a few days after a close), and the
 * About page opens it by firing OPEN_UPDATE_EVENT. Stacked over the settings
 * dialog when opened from there, so closing it reveals whatever was behind.
 */
import { useEffect, useRef, useState } from "react";
import { V2_KEYS } from "../../../shared/constants/storage-keys";
import { availableUpdate, type ReleaseInfo } from "../../../shared/remote/updates";
import { useSetting } from "../../hooks/useSetting";
import { onBackdrop } from "../dialog";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";
import "./UpdateDialog.css";

export const OPEN_UPDATE_EVENT = "ls:open-update";

const INSTALL_LINUX = "curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash";
const INSTALL_WIN = "irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex";
const SNOOZE_DAYS = 3;

function copy(text: string): void {
	const api = Spicetify.Platform?.ClipboardAPI;
	if (api?.copy) void api.copy(text);
	else void navigator.clipboard?.writeText(text);
	Spicetify.showNotification("Copied. Paste it in a terminal.");
}

export function UpdateDialog() {
	const [beta] = useSetting("betaUpdates");
	const ref = useRef<HTMLDialogElement>(null);
	const [r, setR] = useState<ReleaseInfo | null>(null);
	const [open, setOpen] = useState(false);
	const cmd = navigator.userAgent.includes("Windows") ? INSTALL_WIN : INSTALL_LINUX;

	useEffect(() => {
		void availableUpdate(beta).then(setR, () => setR(null));
	}, [beta]);

	// Auto-open once per load unless the user snoozed it recently.
	const autoOpened = useRef(false);
	useEffect(() => {
		if (!r || autoOpened.current) return;
		autoOpened.current = true;
		if (Number(localStorage.getItem(V2_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL) ?? 0) <= Date.now()) setOpen(true);
	}, [r]);

	useEffect(() => {
		const onEvent = () => setOpen(true);
		window.addEventListener(OPEN_UPDATE_EVENT, onEvent);
		return () => window.removeEventListener(OPEN_UPDATE_EVENT, onEvent);
	}, []);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) d.showModal();
		if (!open && d.open) d.close();
	}, [open]);

	const close = () => {
		// Snooze only the auto-popup; opening it from Settings ignores this.
		localStorage.setItem(V2_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL, String(Date.now() + SNOOZE_DAYS * 86_400_000));
		setOpen(false);
	};

	return (
		<dialog
			ref={ref}
			className="ls-update"
			onClose={close}
			onCancel={close}
			onClick={(e) => onBackdrop(e) && close()}
			aria-labelledby="ls-update-title"
		>
			{r && (
				<>
					<div className="ls-update-head">
						<h2 id="ls-update-title">
							Listening Stats {r.version} is out{r.prerelease ? " (beta)" : ""}
						</h2>
						<button type="button" className="ls-icon-btn" aria-label="Close" onClick={close}>
							<Icon name="close" />
						</button>
					</div>
					<div className="ls-update-notes">
						{r.notes ? <Markdown source={r.notes} /> : <p className="ls-muted">No notes for this release.</p>}
					</div>
					<div className="ls-update-foot">
						<p className="ls-set-hint">To update, run this in a terminal, then restart Spotify:</p>
						<div className="ls-update-cmd">
							<code>{cmd}</code>
							<button type="button" className="ls-btn-secondary" onClick={() => copy(cmd)}>
								Copy
							</button>
						</div>
						<a className="ls-link" href={r.url} target="_blank" rel="noreferrer noopener">
							Open the release on GitHub
						</a>
					</div>
				</>
			)}
		</dialog>
	);
}
