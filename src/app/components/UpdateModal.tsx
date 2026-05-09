import { GITHUB_REPO_WEB_URL } from "../../shared/constants/github-repo";
import {
	INSTALL_COMMAND_BASH,
	INSTALL_COMMAND_BASH_PRERELEASE,
	INSTALL_COMMAND_POWERSHELL,
	INSTALL_COMMAND_POWERSHELL_PRERELEASE,
} from "../../shared/constants/install-commands";
import { fetchChangelogMarkdown } from "../../shared/update/changelog-fetch";
import { markdownLiteToHtml } from "../../shared/update/markdown-lite";
import type { UpdateCheckResult } from "../../shared/update/update-check";
import { snoozeUpdatePrompt } from "../../shared/update/update-check";
import { CloseIcon } from "../icons";

const { useState, useEffect, useCallback, useRef } = Spicetify.React;

interface UpdateModalProps {
	open: boolean;
	onClose: () => void;
	updateInfo: UpdateCheckResult | null;
	appVersion: string;
	receiveBetaUpdates: boolean;
	onReceiveBetaUpdatesChange: (value: boolean) => void;
}

async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		/* fall through */
	}
	try {
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.style.position = "fixed";
		ta.style.left = "-9999px";
		document.body.appendChild(ta);
		ta.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(ta);
		return ok;
	} catch {
		return false;
	}
}

export function UpdateModal({
	open,
	onClose,
	updateInfo,
	appVersion,
	receiveBetaUpdates,
	onReceiveBetaUpdatesChange,
}: UpdateModalProps) {
	const Toggle = Spicetify.ReactComponent?.Toggle;
	const [changelogMd, setChangelogMd] = useState<string | null>(null);
	const [changelogErr, setChangelogErr] = useState<string | null>(null);
	const [copiedWhich, setCopiedWhich] = useState<null | "bash" | "powershell">(null);
	const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const bashCmd = receiveBetaUpdates ? INSTALL_COMMAND_BASH_PRERELEASE : INSTALL_COMMAND_BASH;
	const psCmd = receiveBetaUpdates ? INSTALL_COMMAND_POWERSHELL_PRERELEASE : INSTALL_COMMAND_POWERSHELL;

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setChangelogMd(null);
		setChangelogErr(null);
		setCopiedWhich(null);
		fetchChangelogMarkdown().then((md) => {
			if (cancelled) return;
			if (md === null) setChangelogErr("Could not load changelog.");
			else setChangelogMd(md);
		});
		return () => {
			cancelled = true;
		};
	}, [open]);

	useEffect(() => {
		return () => {
			if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
		};
	}, []);

	useEffect(() => {
		setCopiedWhich(null);
		if (copiedTimerRef.current !== null) {
			window.clearTimeout(copiedTimerRef.current);
			copiedTimerRef.current = null;
		}
	}, [receiveBetaUpdates]);

	const handleLater = useCallback(() => {
		snoozeUpdatePrompt(24);
		onClose();
	}, [onClose]);

	const handleCopy = useCallback(async (which: "bash" | "powershell") => {
		const text = which === "bash" ? bashCmd : psCmd;
		const ok = await copyToClipboard(text);
		if (ok) {
			if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
			setCopiedWhich(which);
			copiedTimerRef.current = window.setTimeout(() => {
				setCopiedWhich(null);
				copiedTimerRef.current = null;
			}, 2500);
			Spicetify.showNotification(which === "bash" ? "Copied (macOS / Linux)." : "Copied (Windows).");
		} else {
			Spicetify.showNotification("Could not copy.", true);
		}
	}, [bashCmd, psCmd]);

	const { createPortal } = Spicetify.ReactDOM;

	if (!open) return null;

	const changelogHtml =
		changelogMd !== null ? markdownLiteToHtml(changelogMd.slice(0, 120_000)) : "";

	const metaMissing = updateInfo != null && updateInfo.remoteTag === null;
	const statusLine =
		updateInfo == null
			? "Could not compare versions."
			: metaMissing
				? `No release metadata (this build is v${appVersion}).`
				: updateInfo.updateAvailable
					? `Update available: ${updateInfo.remoteVersion} (you have ${updateInfo.localVersion}).`
					: `Up to date (${updateInfo.localVersion}).`;

	return createPortal(
		<div
			className="settings-overlay update-overlay"
			onClick={(e) => {
				if ((e.target as HTMLElement).classList.contains("settings-overlay")) onClose();
			}}
		>
			<div className="settings-modal update-modal" role="dialog" aria-modal="true">
				<div className="settings-modal-header">
					<h2 className="settings-modal-title">Updates</h2>
					<button
						type="button"
						className="settings-btn"
						onClick={onClose}
						aria-label="Close"
						dangerouslySetInnerHTML={{ __html: CloseIcon }}
					/>
				</div>

				<p className="update-modal-status">{statusLine}</p>
				{updateInfo?.updateAvailable && updateInfo.prerelease ? (
					<p className="update-modal-note">That release is a GitHub pre-release.</p>
				) : null}

				<div className="update-modal-actions update-modal-actions-top">
					{updateInfo?.updateAvailable ? (
						<button type="button" className="btn-secondary" onClick={handleLater}>
							Remind me later
						</button>
					) : null}
					<button type="button" className="btn-secondary" onClick={onClose}>
						Close
					</button>
				</div>

				<div className="settings-row update-modal-pref-row">
					<div>
						<div className="settings-label">Prereleases</div>
						<div className="settings-sublabel">Include prereleases when checking for updates.</div>
					</div>
					{Toggle ? (
						<Toggle value={receiveBetaUpdates} onSelected={onReceiveBetaUpdatesChange} />
					) : (
						<input
							type="checkbox"
							checked={receiveBetaUpdates}
							onChange={(e: Event) =>
								onReceiveBetaUpdatesChange((e.target as HTMLInputElement).checked)
							}
						/>
					)}
				</div>

				<p className="update-modal-note update-modal-install-short">
					{receiveBetaUpdates
						? "Commands install the newest GitHub release that includes the zip (may be a pre-release). Bash needs jq or python3."
						: "Quit Spotify, paste one command, then restart Spotify."}
				</p>

				<div className="settings-about-command-block">
					<div className="settings-about-command-head">
						<span className="settings-about-command-label">macOS / Linux</span>
						<button
							type="button"
							className="btn-secondary settings-about-copy-btn"
							onClick={() => void handleCopy("bash")}
						>
							{copiedWhich === "bash" ? "Copied" : "Copy"}
						</button>
					</div>
					<pre className="settings-about-command-pre" tabIndex={0}>
						{bashCmd}
					</pre>
				</div>

				<div className="settings-about-command-block">
					<div className="settings-about-command-head">
						<span className="settings-about-command-label">Windows</span>
						<button
							type="button"
							className="btn-secondary settings-about-copy-btn"
							onClick={() => void handleCopy("powershell")}
						>
							{copiedWhich === "powershell" ? "Copied" : "Copy"}
						</button>
					</div>
					<pre className="settings-about-command-pre" tabIndex={0}>
						{psCmd}
					</pre>
				</div>

				<p className="settings-about-hint update-modal-repo-hint">
					<a
						className="settings-inline-link"
						href={GITHUB_REPO_WEB_URL}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					{" · "}
					<a
						className="settings-inline-link"
						href={`${GITHUB_REPO_WEB_URL}/releases`}
						target="_blank"
						rel="noopener noreferrer"
					>
						Releases
					</a>
				</p>

				<h3 className="update-modal-changelog-title">Changelog</h3>
				{changelogErr ? <p className="update-modal-changelog-error">{changelogErr}</p> : null}
				<div
					className="update-modal-changelog markdown-lite"
					dangerouslySetInnerHTML={{ __html: changelogHtml }}
				/>
			</div>
		</div>,
		document.body,
	);
}
