/**
 * Catches render errors so a crash in one component doesn't take down the whole
 * route with Spotify's generic "Something went wrong" page. The fallback shows
 * the actual error with a copy button so users can paste it into a bug report.
 */

const { Component } = Spicetify.React;

interface ErrorBoundaryProps {
	children?: React.ReactNode;
	/** Render nothing on error instead of the fallback card (for non-critical UI like the playbar widget). */
	silent?: boolean;
	/** Shown in the copyable report to identify the build. */
	appVersion?: string;
}

interface ErrorBoundaryState {
	error: Error | null;
	componentStack: string;
	copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = {
		error: null,
		componentStack: "",
		copied: false,
	};

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { error, copied: false };
	}

	componentDidCatch(error: Error, info: { componentStack?: string | null }) {
		this.setState({ componentStack: info?.componentStack ?? "" });
		console.error("[listening-stats] Render error:", error, info?.componentStack ?? "");
	}

	private buildReport(): string {
		const { error, componentStack } = this.state;
		return [
			`Listening Stats error report`,
			`Version: ${this.props.appVersion ?? "unknown"}`,
			`Spotify UA: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
			`Error: ${error?.message ?? "unknown"}`,
			error?.stack ? `Stack:\n${error.stack}` : "",
			componentStack ? `Component stack:\n${componentStack}` : "",
		]
			.filter(Boolean)
			.join("\n");
	}

	private handleCopy = async () => {
		const text = this.buildReport();
		try {
			await navigator.clipboard.writeText(text);
			this.setState({ copied: true });
		} catch {
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.left = "-9999px";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				document.body.removeChild(ta);
				this.setState({ copied: true });
			} catch {
				/* leave copied false */
			}
		}
	};

	private handleRetry = () => {
		this.setState({ error: null, componentStack: "", copied: false });
	};

	render() {
		const { error, copied } = this.state;
		if (!error) return this.props.children ?? null;
		if (this.props.silent) return null;

		return (
			<div
				role="alert"
				style={{
					margin: 24,
					padding: 20,
					borderRadius: 8,
					background: "var(--spice-card, rgba(255,255,255,0.06))",
					color: "var(--spice-text, #fff)",
					maxWidth: 640,
				}}
			>
				<h2 style={{ marginTop: 0, fontSize: 18 }}>Listening Stats hit an error</h2>
				<p style={{ fontSize: 14, opacity: 0.85 }}>
					The rest of Spotify is unaffected. Copy the details below and attach them to a GitHub issue so this can be
					fixed.
				</p>
				<pre
					style={{
						fontSize: 12,
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						maxHeight: 180,
						overflow: "auto",
						padding: 10,
						borderRadius: 6,
						background: "rgba(0,0,0,0.35)",
					}}
				>
					{error.message}
				</pre>
				<div style={{ display: "flex", gap: 8 }}>
					<button type="button" className="btn-primary" onClick={this.handleCopy}>
						{copied ? "Copied" : "Copy error details"}
					</button>
					<button type="button" className="btn-secondary" onClick={this.handleRetry}>
						Try again
					</button>
				</div>
			</div>
		);
	}
}
