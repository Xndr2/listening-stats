const { useRef, useEffect, useState } = Spicetify.React;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface DailyCount {
	date: string;
	count: number;
}

interface CalendarHeatmapProps {
	dailyPlayCounts: DailyCount[];
	shrink?: boolean;
}

interface CellData {
	date: Date;
	count: number;
}

function buildGrid(dailyPlayCounts: DailyCount[]): {
	cells: (CellData | null)[][];
	monthLabels: { col: number; label: string }[];
} {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const countMap = new Map<string, number>();
	for (const d of dailyPlayCounts) {
		countMap.set(d.date, d.count);
	}

	const startDate = new Date(today);
	startDate.setDate(startDate.getDate() - 52 * 7 - startDate.getDay());

	const allDays: (CellData | null)[] = [];
	const cursor = new Date(startDate);
	while (cursor <= today) {
		const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
		allDays.push({ date: new Date(cursor), count: countMap.get(key) ?? 0 });
		cursor.setDate(cursor.getDate() + 1);
	}

	// Pad leading nulls so first day aligns to correct row (day of week)
	const firstDow = allDays[0]?.date.getDay() ?? 0;
	for (let i = 0; i < firstDow; i++) allDays.unshift(null);

	// Pad trailing nulls to fill last week
	while (allDays.length % 7 !== 0) allDays.push(null);

	// Build columns (weeks): each column is 7 cells (Sun=0..Sat=6)
	const numWeeks = allDays.length / 7;
	const cells: (CellData | null)[][] = [];
	for (let w = 0; w < numWeeks; w++) {
		cells.push(allDays.slice(w * 7, w * 7 + 7));
	}

	// Month labels at week boundaries
	const monthLabels: { col: number; label: string }[] = [];
	let lastMonth = -1;
	for (let w = 0; w < cells.length; w++) {
		const firstCell = cells[w].find((c) => c !== null);
		if (firstCell && firstCell.date.getDate() <= 7) {
			const month = firstCell.date.getMonth();
			if (month !== lastMonth) {
				monthLabels.push({ col: w, label: MONTHS[month] });
				lastMonth = month;
			}
		}
	}

	return { cells, monthLabels };
}

function cellColor(count: number, max: number): string {
	if (count <= 0) return "rgba(var(--spice-rgb-misc), 0.05)";
	const t = Math.min(1, count / max);
	const a = 0.15 + t * 0.85;
	return `rgba(var(--spice-rgb-button), ${a.toFixed(2)})`;
}

export function CalendarHeatmap({ dailyPlayCounts, shrink }: CalendarHeatmapProps) {
	const { cells, monthLabels } = buildGrid(dailyPlayCounts);
	const numWeeks = cells.length;
	const max = Math.max(
		...cells
			.flat()
			.filter((c): c is CellData => c !== null)
			.map((c) => c.count),
		1,
	);

	const wrapRef = useRef<HTMLDivElement>(null);
	const [cellSize, setCellSize] = useState(16);
	const [cellGap, setCellGap] = useState(3);

	useEffect(() => {
		if (!shrink || !wrapRef.current) {
			setCellSize(16);
			setCellGap(3);
			return;
		}
		const MIN_CELL = 3;
		const ob = new ResizeObserver((entries) => {
			const cw = entries[0].contentRect.width;
			if (cw <= 0) return;
			const cols = Math.max(1, numWeeks);
			const gap = Math.max(1, Math.min(3, Math.floor(cw / cols / 5)));
			const size = Math.max(MIN_CELL, Math.min(16, Math.floor((cw - cols * gap) / cols)));
			setCellSize(size);
			setCellGap(gap);
		});
		ob.observe(wrapRef.current);
		return () => ob.disconnect();
	}, [shrink, numWeeks]);

	const colWidth = shrink ? `${cellSize}px` : "16px";
	const gap = shrink ? cellGap : 3;
	const gridCols = `repeat(${numWeeks}, ${colWidth})`;

	return (
		<div className={`heatmap-container${shrink ? " heatmap-shrink" : ""}`}>
			<div className="heatmap-scroll-wrap" ref={wrapRef}>
				<div className="heatmap-scroll-inner">
					<div className="heatmap-month-labels" style={{ gridTemplateColumns: gridCols, gap: `${gap}px` }}>
						{Array.from({ length: numWeeks }).map((_, wi) => {
							const m = monthLabels.find((x) => x.col === wi);
							return <span key={wi}>{m ? m.label : ""}</span>;
						})}
					</div>
					<div className="heatmap-grid" style={{ gridTemplateColumns: gridCols, gap: `${gap}px` }}>
						{cells.map((week, wi) => (
							<div
								key={wi}
								className="heatmap-week"
								style={{ gridTemplateRows: `repeat(7, ${colWidth})`, gap: `${gap}px` }}
							>
								{week.map((cell, di) => (
									<Spicetify.ReactComponent.TooltipWrapper
										key={di}
										label={cell ? `${cell.date.toDateString()} - ${cell.count} plays` : ""}
										placement="top"
									>
										<div
											className="heatmap-cell"
											style={{
												width: colWidth,
												height: colWidth,
												background: cell ? cellColor(cell.count, max) : "transparent",
											}}
										/>
									</Spicetify.ReactComponent.TooltipWrapper>
								))}
							</div>
						))}
					</div>
				</div>
			</div>
			<div className="heatmap-legend">
				<span>Less</span>
				{[0.05, 0.25, 0.5, 0.75, 1].map((t) => (
					<span
						key={t}
						className="heatmap-legend-swatch"
						style={{
							background: t === 0.05 ? "rgba(var(--spice-rgb-misc), 0.05)" : `rgba(var(--spice-rgb-button), ${t})`,
						}}
					/>
				))}
				<span>More</span>
			</div>
		</div>
	);
}
