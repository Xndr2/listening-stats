import { Component } from "react";
import { APP_VERSION } from "../../../shared/constants/app";
import { captureError } from "../../../shared/errors/capture";
import type { ErrorEntry } from "../../../shared/errors/log";
import { formatReport, githubIssueUrl } from "../../../shared/errors/report";
import { isReportingConfigured, sendReport } from "../../../shared/errors/sentry";
import "./ErrorBoundary.css";

interface State {
	error: Error | null;
	entry: ErrorEntry | null;
	sent: string | null;
}

/**
 * Last line of defence for the whole page. Widgets have their own
 * boundaries, so reaching this means the shell itself broke. Spotify keeps
 * working either way; this keeps the page useful and reportable.
 */
export class ErrorBoundary extends Component<{ children?: React.ReactNode }, State> {
	state: State = { error: null, entry: null, sent: null };

	static getDerivedStateFromError(error: Error): Partial<State> {
		return { error };
	}

	componentDidCatch(error: Error) {
		void captureError(error, "app", "uncaught", "page").then((entry) => this.setState({ entry }));
	}

	private async report() {
		const { entry } = this.state;
		if (!entry) return;
		if (isReportingConfigured()) {
			const r = await sendReport(entry, { manual: true });
			this.setState({
				sent: r === "sent" ? "Report sent. Thank you." : "Couldn't send the report. Try copying it instead.",
			});
		} else {
			window.open(githubIssueUrl(entry), "_blank", "noopener");
		}
	}

	render() {
		const { error, entry, sent } = this.state;
		if (!error) return this.props.children;
		return (
			<div className="ls-crash" role="alert">
				<h1>Listening Stats ran into a problem</h1>
				<p className="ls-muted">
					Version {APP_VERSION}. Your listening history is safe; this only affects this page. Trying again usually
					works. If it keeps happening, sending a report helps get it fixed.
				</p>
				<p className="ls-crash-msg">{error.message}</p>
				<div className="ls-crash-actions">
					<button type="button" className="ls-btn-primary" onClick={() => this.setState({ error: null, sent: null })}>
						Try again
					</button>
					<button type="button" className="ls-btn-secondary" disabled={!entry} onClick={() => void this.report()}>
						{isReportingConfigured() ? "Send report" : "Report on GitHub"}
					</button>
					<button
						type="button"
						className="ls-btn-secondary"
						disabled={!entry}
						onClick={() => entry && void Spicetify.Platform?.ClipboardAPI?.copy?.(formatReport(entry))}
					>
						Copy details
					</button>
				</div>
				{sent && <p className="ls-muted">{sent}</p>}
			</div>
		);
	}
}
