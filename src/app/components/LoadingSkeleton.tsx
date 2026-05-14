import { SkeletonBlock, SkeletonCircle, SkeletonTextLine } from "./SkeletonPrimitives";

export function OverviewCardsSkeleton() {
	return (
		<div className="overview-section" aria-hidden="true">
			<SkeletonBlock className="overview-hero-cell" height="184px" />
			<div className="overview-right-block">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonBlock key={i} className="overview-card" height="60px" />
				))}
			</div>
			<div className="overview-bottom-row">
				{Array.from({ length: 3 }).map((_, i) => (
					<SkeletonBlock key={i} className="overview-card" height="60px" />
				))}
			</div>
		</div>
	);
}

export function TopListsWaveSkeleton() {
	return (
		<div
			className="top-lists-wave-skeleton"
			aria-hidden="true"
			style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}
		>
			{Array.from({ length: 3 }).map((_, col) => (
				<div
					key={col}
					style={{
						padding: "16px",
						background: "rgba(var(--spice-rgb-misc),.03)",
						borderRadius: "8px",
						border: "1px solid rgba(var(--spice-rgb-misc),.06)",
					}}
				>
					<SkeletonBlock width="80px" height="14px" style={{ marginBottom: "14px" }} />
					{Array.from({ length: 5 }).map((_, row) => (
						<div
							key={row}
							style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}
						>
							<SkeletonCircle size={20} style={{ flexShrink: 0 }} />
							<SkeletonBlock width="36px" height="36px" style={{ flexShrink: 0 }} />
							<div style={{ flex: 1 }}>
								<SkeletonBlock width="80%" height="11px" style={{ marginBottom: "6px" }} />
								<SkeletonBlock width="50%" height="9px" />
							</div>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

export function TopListSkeleton() {
	return (
		<div>
			{Array.from({ length: 5 }).map((_, i) => (
				<SkeletonBlock
					key={i}
					className="top-list-row"
					height="64px"
					style={{ marginBottom: "6px" }}
					aria-hidden="true"
				/>
			))}
		</div>
	);
}

export function WorldChartsSkeleton() {
	return (
		<div className="world-charts-skeleton" aria-hidden="true">
			{Array.from({ length: 2 }).map((_, section) => (
				<div key={section} style={{ marginBottom: "32px" }}>
					<div
						className="skeleton-shimmer"
						style={{ width: "100px", height: "12px", marginBottom: "6px", borderRadius: "4px" }}
					/>
					<div
						className="skeleton-shimmer"
						style={{ width: "140px", height: "18px", marginBottom: "16px", borderRadius: "4px" }}
					/>
					<div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px 0" }}>
						{Array.from({ length: 8 }).map((_, row) => (
							<div
								key={row}
								style={{ display: "flex", gap: "12px", alignItems: "center", padding: "6px 8px" }}
							>
								<div
									className="skeleton-shimmer"
									style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0 }}
								/>
								<div
									className="skeleton-shimmer skeleton-tile"
									style={{ width: "36px", height: "36px", borderRadius: "4px", flexShrink: 0 }}
								/>
								<div style={{ flex: 1 }}>
									<div
										className="skeleton-shimmer"
										style={{
											width: "75%",
											height: "12px",
											marginBottom: "6px",
											borderRadius: "4px",
										}}
									/>
									<div
										className="skeleton-shimmer"
										style={{ width: "50%", height: "10px", borderRadius: "4px" }}
									/>
								</div>
								<div
									className="skeleton-shimmer"
									style={{ width: "40px", height: "12px", borderRadius: "4px", flexShrink: 0 }}
								/>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

export function ActivityChartSkeleton() {
	return (
		<div className="activity-chart" aria-hidden="true">
			{Array.from({ length: 24 }).map((_, i) => (
				<div
					key={i}
					className="activity-bar skeleton-shimmer"
					style={{ height: `${20 + Math.random() * 60}%` }}
				/>
			))}
		</div>
	);
}

export function ConsistencySkeleton() {
	return (
		<div className="section-card" aria-hidden="true">
			<header className="section-heading">
				<span className="section-kicker">Patterns</span>
				<h2 className="section-title">Consistency</h2>
			</header>
			<div className="consistency-grid">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="consistency-metric">
						<SkeletonTextLine width="55%" />
						<SkeletonBlock width="45%" height="24px" style={{ marginTop: "8px" }} />
						<SkeletonTextLine width="70%" />
					</div>
				))}
			</div>
		</div>
	);
}

export function RecentlyPlayedSkeleton() {
	return (
		<div className="recently-played" aria-hidden="true">
			{Array.from({ length: 6 }).map((_, i) => (
				<div key={i} className="recently-played-item">
					<div className="recently-played-skeleton-art skeleton-shimmer" />
					<div className="recently-played-skeleton-text skeleton-shimmer" />
					<div className="recently-played-skeleton-subtext skeleton-shimmer" />
				</div>
			))}
		</div>
	);
}
