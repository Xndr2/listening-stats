interface EmptyStateProps {
	onOpenSettings: () => void;
}

export default function EmptyState({ onOpenSettings }: EmptyStateProps) {
	return (
		<div className="empty-state" role="status">
			<h2
				style={{
					fontSize: "var(--font-size-md, 14px)",
					fontWeight: 700,
					color: "var(--spice-text)",
					marginBottom: "var(--space-sm, 8px)",
				}}
			>
				No listening data yet
			</h2>
			<p
				style={{
					fontSize: "var(--font-size-md, 14px)",
					color: "var(--spice-subtext)",
					marginBottom: "var(--space-md, 16px)",
				}}
			>
				Play some tracks and check back. Make sure tracking is enabled in Settings.
			</p>
			<button className="btn-primary" onClick={onOpenSettings}>
				Open Settings
			</button>
		</div>
	);
}
