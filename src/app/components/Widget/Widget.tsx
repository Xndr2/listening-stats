/**
 * Frame for one dashboard widget: title row, its own error boundary, and the
 * loading / error / refreshing states for its query. A crash or failed
 * request here never touches the widgets around it.
 */
import { Component, type ReactNode } from "react";
import { captureError } from "../../../shared/errors/capture";
import { HttpError } from "../../../shared/net/http";
import type { QueryResult } from "../../query/useQuery";
import { Icon } from "../Icon";
import "./Widget.css";

interface BoundaryProps {
	id: string;
	children: ReactNode;
}

class WidgetBoundary extends Component<BoundaryProps, { error: Error | null }> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error) {
		void captureError(error, "app", "widget", this.props.id);
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<div className="ls-widget-msg" role="alert">
				<Icon name="warning" />
				<span>This part hit a bug and stopped. It's in the error log.</span>
				<button type="button" className="ls-link" onClick={() => this.setState({ error: null })}>
					Try again
				</button>
			</div>
		);
	}
}

export function describeError(err: unknown): string {
	if (err instanceof HttpError) {
		switch (err.kind) {
			case "offline":
				return "Couldn't connect. Check your internet connection.";
			case "timeout":
				return "The server took too long to answer.";
			case "rate-limited":
				return "Too many requests for now. Try again in a minute.";
			case "circuit-open":
				return "Paused after a few failed tries. Retrying shortly.";
			case "auth":
				return `${err.message}. Check it in Settings.`;
			case "not-found":
				return `${err.message}. Check the username in Settings.`;
			default:
				return err.message;
		}
	}
	return err instanceof Error ? err.message : "Something went wrong.";
}

interface WidgetProps<T> {
	id: string;
	title?: ReactNode;
	/** Right side of the title row: controls, a "peak 6pm" note... */
	aside?: ReactNode;
	query?: QueryResult<T>;
	skeleton?: ReactNode;
	className?: string;
	children: (data: T) => ReactNode;
}

/**
 * Calls the widget's render function as its own component, so an error in it
 * is thrown inside WidgetBoundary (called directly in Widget, it would skip
 * the boundary and take the whole page down).
 */
function WidgetBody<T>({ render, data }: { render: (data: T) => ReactNode; data: T }) {
	return <>{render(data)}</>;
}

export function Widget<T>({ id, title, aside, query, skeleton, className, children }: WidgetProps<T>) {
	const hasData = query?.data !== undefined;
	const failed = query?.error !== undefined && !query.refreshing;
	return (
		<section
			className={`ls-widget ${className ?? ""}`}
			aria-labelledby={title ? `ls-w-${id}` : undefined}
			data-widget={id}
		>
			{(title || aside) && (
				<header className="ls-widget-head">
					{title && (
						<h2 id={`ls-w-${id}`} className="ls-widget-title">
							{title}
						</h2>
					)}
					{query?.refreshing && hasData && <span className="ls-widget-updating">Updating</span>}
					{aside && <div className="ls-widget-aside">{aside}</div>}
				</header>
			)}
			<WidgetBoundary id={id}>
				{hasData ? (
					<WidgetBody render={children} data={query?.data as T} />
				) : !failed ? (
					(skeleton ?? <div className="ls-skel" style={{ height: 120 }} />)
				) : null}
				{failed && (
					<div className="ls-widget-msg" role="status">
						<Icon name="warning" />
						<span>{hasData ? `Showing older data. ${describeError(query?.error)}` : describeError(query?.error)}</span>
						<button type="button" className="ls-link" onClick={query?.retry}>
							Retry
						</button>
					</div>
				)}
			</WidgetBoundary>
		</section>
	);
}

export function SkeletonLines({ rows = 5, height = 40 }: { rows?: number; height?: number }) {
	return (
		<div className="ls-skel-list" aria-hidden="true">
			{Array.from({ length: rows }, (_, i) => (
				<div key={i} className="ls-skel" style={{ height }} />
			))}
		</div>
	);
}
