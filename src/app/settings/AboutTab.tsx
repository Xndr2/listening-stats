import { useEffect, useId, useState } from "react";
import { APP_VERSION, BUYMEACOFFEE_URL, GITHUB_REPO } from "../../shared/constants/app";
import { EVENTS, listen } from "../../shared/constants/events";
import { clearErrors, deleteError, type ErrorEntry, getErrors, toEntry } from "../../shared/errors/log";
import { formatReport, githubIssueUrl } from "../../shared/errors/report";
import { isReportingConfigured, sendReport } from "../../shared/errors/sentry";
import { availableUpdate, type ReleaseInfo } from "../../shared/remote/updates";
import { Icon } from "../components/Icon";
import { OPEN_UPDATE_EVENT } from "../components/UpdateDialog/UpdateDialog";
import { formatAgo } from "../format";
import { useSetting } from "../hooks/useSetting";
import { TOUR_EVENT } from "../onboarding/Tour";
import { useApp } from "../state";
import { Row, Section, ToggleRow } from "./controls";

function copy(text: string): void {
	const api = Spicetify.Platform?.ClipboardAPI;
	if (api?.copy) void api.copy(text);
	else void navigator.clipboard?.writeText(text);
	Spicetify.showNotification("Copied");
}

function ReportForm({ entry }: { entry: ErrorEntry | null }) {
	const [note, setNote] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const id = useId();
	// A report without a logged error still carries versions and the note.
	const target = entry ?? toEntry(new Error("User report"), "app", "report", "report-button");
	const send = async () => {
		if (!isReportingConfigured()) {
			window.open(githubIssueUrl(target, note), "_blank", "noopener");
			return;
		}
		setStatus("Sending…");
		const r = await sendReport(target, { manual: true, userMessage: note });
		setStatus(
			r === "sent"
				? "Sent. Thanks, that helps."
				: r === "limit"
					? "You've sent a lot of reports today. Copy the details instead."
					: "Couldn't send it. Copy the details instead.",
		);
	};
	return (
		<div className="ls-set-form">
			<label htmlFor={id} className="ls-set-label">
				What were you doing when it went wrong? (optional)
			</label>
			<textarea
				id={id}
				className="ls-input ls-textarea"
				rows={3}
				value={note}
				onChange={(e) => setNote(e.target.value)}
			/>
			<div className="ls-set-buttons">
				<button type="button" className="ls-btn-primary" onClick={() => void send()}>
					{isReportingConfigured() ? "Send report" : "Open a GitHub issue"}
				</button>
				<button type="button" className="ls-btn-secondary" onClick={() => copy(formatReport(target, note))}>
					Copy details
				</button>
			</div>
			{status ? (
				<p className="ls-set-msg">{status}</p>
			) : (
				entry?.reportedAt && <p className="ls-set-msg">You reported this {formatAgo(entry.reportedAt)}.</p>
			)}
			<p className="ls-set-hint">
				Reports include the error, app and Spotify versions and which data source you use. Usernames, keys and track
				names are removed first.
			</p>
		</div>
	);
}

function ErrorLog() {
	const [errors, setErrors] = useState<ErrorEntry[]>([]);
	const [open, setOpen] = useState<number | null>(null);
	useEffect(() => {
		const load = () =>
			void getErrors()
				.then(setErrors)
				.catch(() => setErrors([]));
		load();
		return listen(EVENTS.ERROR_LOGGED, load);
	}, []);
	const selected = errors.find((e) => e.id === open) ?? errors[0] ?? null;
	return (
		<Section
			title="Problems"
			description={
				errors.length
					? `${errors.length} logged on this device, newest first. Pick one to include it in a report.`
					: "No errors logged. If something still looks wrong, you can report it below."
			}
		>
			{errors.length > 0 && (
				<>
					<ul className="ls-errlist">
						{errors.slice(0, 20).map((e) => (
							<li key={e.id} className="ls-erritem-row">
								<button
									type="button"
									className="ls-erritem"
									aria-pressed={selected?.id === e.id}
									onClick={() => setOpen(e.id ?? null)}
								>
									<span className="ls-erritem-msg">
										{e.name}: {e.message || "(no message)"}
									</span>
									<span className="ls-muted">
										{e.where ?? e.source} · {formatAgo(e.at)}
										{e.reportedAt && <span className="ls-pill-on ls-erritem-sent">Reported</span>}
									</span>
								</button>
								<button
									type="button"
									className="ls-icon-btn"
									aria-label={`Delete ${e.name}: ${e.message}`}
									data-tip="Delete"
									onClick={() => {
										if (e.id === undefined) return;
										if (open === e.id) setOpen(null);
										void deleteError(e.id);
									}}
								>
									<Icon name="close" />
								</button>
							</li>
						))}
					</ul>
					<button
						type="button"
						className="ls-link"
						onClick={() =>
							void clearErrors().then(() => {
								setErrors([]);
								setOpen(null);
							})
						}
					>
						Clear the log
					</button>
				</>
			)}
			<ReportForm key={selected?.id ?? "none"} entry={selected} />
		</Section>
	);
}

export function AboutTab() {
	const { setView, setSettingsOpen } = useApp();
	const [beta] = useSetting("betaUpdates");
	const [update, setUpdate] = useState<ReleaseInfo | null>(null);
	useEffect(() => {
		void availableUpdate(beta).then(setUpdate, () => setUpdate(null));
	}, [beta]);
	return (
		<>
			{update && (
				<button
					type="button"
					className="ls-btn-primary ls-update-cta"
					onClick={() => window.dispatchEvent(new Event(OPEN_UPDATE_EVENT))}
				>
					Update to Listening Stats {update.version}
				</button>
			)}
			<Section title="Listening Stats">
				<Row label="Version" control={<span className="ls-num">{APP_VERSION}</span>} />
				<ToggleRow name="betaUpdates" label="Tell me about beta versions" />
				<ToggleRow
					name="showAnnouncements"
					label="Show announcements"
					hint="Short notes from the developer, at most one at a time."
				/>
				<Row
					label="Tour"
					hint="A quick look at where things are."
					control={
						<button
							type="button"
							className="ls-btn-secondary"
							onClick={() => {
								setSettingsOpen(false);
								setView("dashboard");
								setTimeout(() => window.dispatchEvent(new Event(TOUR_EVENT)), 300);
							}}
						>
							Show me around
						</button>
					}
				/>
				<Row
					label="Help and source code"
					control={
						<a className="ls-link" href={`https://github.com/${GITHUB_REPO}`} target="_blank" rel="noreferrer noopener">
							GitHub
						</a>
					}
				/>
				<Row
					label="Support Listening Stats"
					hint="It's free and stays free. A coffee helps keep it going."
					control={
						<a className="ls-link" href={BUYMEACOFFEE_URL} target="_blank" rel="noreferrer noopener">
							Buy me a coffee
						</a>
					}
				/>
			</Section>
			<Section title="Crash reports">
				<ToggleRow
					name="autoCrashReports"
					label="Send crash reports automatically"
					hint={
						isReportingConfigured()
							? "Off by default. When on, a short report is sent when Listening Stats crashes, at most 10 a day."
							: "Not set up in this build yet. Use the report form below."
					}
				/>
			</Section>
			<ErrorLog />
		</>
	);
}
