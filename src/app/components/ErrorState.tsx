interface ErrorStateProps {
	sectionName: string;
	onRetry: () => void;
}

export default function ErrorState({ sectionName, onRetry }: ErrorStateProps) {
	return (
		<div className="error-state" role="status">
			<p
				style={{
					fontSize: "var(--font-size-sm, 14px)",
					color: "var(--spice-subtext)",
				}}
			>
				Failed to load {sectionName}.
			</p>
			<button className="btn-primary" onClick={onRetry} style={{ marginTop: "8px" }}>
				Retry Load
			</button>
		</div>
	);
}
