import { EVENTS } from "../../../shared/constants/events";
import { LOCAL_PERIODS } from "../../../shared/stats/periods";
import { providerRegistry } from "../../../shared/stats/provider";
import { statsCache } from "../../../shared/stats/stats-cache";
import { db } from "../../../shared/storage/db";
import { importFileEvents, type ParseResult, parseJsonEvents, parseV1Csv } from "../../../shared/storage/import";
import { downloadFile } from "../../utils";

const { useState, useRef } = Spicetify.React;

interface Props {
	onRefresh: () => void;
}

type ImportPhase = "idle" | "importing" | "complete";

interface ImportProgress {
	current: number;
	total: number;
}

interface ImportSummary {
	imported: number;
	skipped: number;
	errors: number;
	errorDetails: string[];
}

export function DataTab({ onRefresh }: Props) {
	const [confirmWipe, setConfirmWipe] = useState(false);
	const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
	const [importProgress, setImportProgress] = useState<ImportProgress>({
		current: 0,
		total: 0,
	});
	const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleRefresh = () => {
		statsCache.invalidate();
		onRefresh();
		Spicetify.showNotification("Stats refreshed");
	};

	const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Reset file input so the same file can be re-selected
		if (fileInputRef.current) fileInputRef.current.value = "";

		const isCSV = file.name.endsWith(".csv");
		const isJSON = file.name.endsWith(".json");

		if (!isCSV && !isJSON) {
			Spicetify.showNotification("Unsupported file type. Use .csv or .json.", true);
			return;
		}

		// A decade of heavy listening exports well under this; larger files would freeze the renderer
		const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
		if (file.size > MAX_IMPORT_BYTES) {
			Spicetify.showNotification("Import failed: file larger than 100 MB", true);
			return;
		}

		setImportPhase("importing");
		setImportProgress({ current: 0, total: 0 });

		try {
			const text = await file.text();

			// Parse based on file type
			let parseResult: ParseResult;
			if (isCSV) {
				parseResult = await parseV1Csv(text);
			} else {
				parseResult = await parseJsonEvents(text);
			}

			if (parseResult.events.length === 0 && parseResult.errors === 0) {
				Spicetify.showNotification("Import failed: file contains no events", true);
				setImportPhase("idle");
				return;
			}

			setImportProgress({ current: 0, total: parseResult.events.length });

			// Yield to UI thread periodically during import for large files
			const CHUNK_SIZE = 500;
			let totalImported = 0;
			let totalSkipped = 0;
			let totalErrors = parseResult.errors;
			let allErrorDetails = [...parseResult.errorDetails];

			for (let i = 0; i < parseResult.events.length; i += CHUNK_SIZE) {
				const chunk = parseResult.events.slice(i, i + CHUNK_SIZE);
				const result = await importFileEvents(chunk);
				totalImported += result.imported;
				totalSkipped += result.skipped;
				totalErrors += result.errors;
				allErrorDetails = allErrorDetails.concat(result.errorDetails);

				setImportProgress({
					current: Math.min(i + CHUNK_SIZE, parseResult.events.length),
					total: parseResult.events.length,
				});
				// Yield to UI thread
				await new Promise((r) => setTimeout(r, 0));
			}

			statsCache.invalidate();
			window.dispatchEvent(new CustomEvent(EVENTS.PLAY_RECORDED));

			setImportSummary({
				imported: totalImported,
				skipped: totalSkipped,
				errors: totalErrors,
				errorDetails: allErrorDetails.slice(0, 10),
			});
			setImportPhase("complete");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown import error";
			Spicetify.showNotification(message, true);
			setImportPhase("idle");
			console.error("[DataTab] Import error:", err);
		}
	};

	const handleDismissResults = () => {
		setImportPhase("idle");
		setImportSummary(null);
	};

	const handleExportJson = async () => {
		try {
			const activeProvider = providerRegistry.getActive();
			const allTimePeriod =
				activeProvider?.getSupportedPeriods().find((p) => p.id.endsWith("all-time") || p.label === "All Time") ??
				LOCAL_PERIODS[4];
			const stats = await activeProvider?.calculateStats(allTimePeriod);
			if (!stats) {
				Spicetify.showNotification("No active provider", true);
				return;
			}
			downloadFile(JSON.stringify(stats, null, 2), "listening-stats.json", "application/json");
		} catch (err) {
			Spicetify.showNotification("Export failed. Check console.", true);
			console.error("[DataTab] Export JSON error:", err);
		}
	};

	const handleExportCsv = async () => {
		try {
			const activeProvider = providerRegistry.getActive();
			const allTimePeriod =
				activeProvider?.getSupportedPeriods().find((p) => p.id.endsWith("all-time") || p.label === "All Time") ??
				LOCAL_PERIODS[4];
			const stats = await activeProvider?.calculateStats(allTimePeriod);
			if (!stats) {
				Spicetify.showNotification("No active provider", true);
				return;
			}
			const header = "Rank,Track,Artist,Album,Plays,Duration\n";
			const rows = stats.topTracks
				.map(
					(t) =>
						`${t.rank},"${t.trackName.replace(/"/g, '""')}","${t.artistName.replace(/"/g, '""')}","${t.albumName.replace(/"/g, '""')}",${t.count},${t.durationMs}`,
				)
				.join("\n");
			downloadFile(header + rows, "listening-stats.csv", "text/csv");
		} catch (err) {
			Spicetify.showNotification("Export failed. Check console.", true);
			console.error("[DataTab] Export CSV error:", err);
		}
	};

	const handleTestWrite = async () => {
		try {
			const testEvent = {
				trackUri: "spotify:track:test",
				trackName: "Test Track",
				artistName: "Test Artist",
				artistUri: "spotify:artist:test",
				albumName: "Test Album",
				albumUri: "spotify:album:test",
				durationMs: 30000,
				playedMs: 30000,
				startedAt: Date.now(),
				endedAt: Date.now(),
				type: "play" as const,
			};
			const id = await db.playEvents.add(testEvent);
			await db.playEvents.delete(id);
			Spicetify.showNotification("Write test passed");
		} catch (err) {
			Spicetify.showNotification("Write test failed. Check console.", true);
			console.error("[DataTab] Test write error:", err);
		}
	};

	// Only remove this app's keys — clear() would wipe storage for the whole
	// Spotify origin, including Spotify's own settings and other extensions.
	const removePrefixedKeys = (storage: Storage) => {
		for (let i = storage.length - 1; i >= 0; i--) {
			const key = storage.key(i);
			if (key?.startsWith("listening-stats:")) storage.removeItem(key);
		}
	};

	const handleWipeConfirm = async () => {
		try {
			await db.delete();
			statsCache.invalidate();
			// Legacy cache DB from the removed Last.fm world-charts backend
			indexedDB.deleteDatabase("listening-stats-lastfm-cache");
			removePrefixedKeys(localStorage);
			removePrefixedKeys(sessionStorage);
			Spicetify.showNotification("All data wiped");
			setConfirmWipe(false);
			window.location.reload();
		} catch (err) {
			Spicetify.showNotification("Wipe failed. Check console.", true);
			console.error("[DataTab] Wipe error:", err);
		}
	};

	return (
		<div>
			<div
				className="settings-row"
				style={{
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "12px",
				}}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept=".csv,.json"
					style={{ display: "none" }}
					onChange={handleFileSelected}
					aria-label="Import play history file"
				/>

				{importPhase === "idle" && (
					<div
						style={{
							display: "flex",
							width: "100%",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<div>
							<div className="settings-label">Import play history</div>
							<div className="settings-sublabel">Accepts .csv or .json from a v1 export</div>
						</div>
						<button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
							Import Data
						</button>
					</div>
				)}

				{importPhase === "importing" && (
					<div className="import-progress">
						<span className="import-progress-label">
							Importing... {importProgress.current} / {importProgress.total}
						</span>
						<progress className="import-progress-bar" value={importProgress.current} max={importProgress.total} />
					</div>
				)}

				{importPhase === "complete" && importSummary && (
					<div className="import-result-card">
						<div className="import-result-row">
							<span className="import-result-count import-result-count--success">{importSummary.imported}</span>
							<span className="import-result-label">imported</span>
						</div>
						<div className="import-result-row">
							<span className="import-result-count import-result-count--neutral">{importSummary.skipped}</span>
							<span className="import-result-label">skipped as duplicates</span>
						</div>
						{importSummary.errors > 0 && (
							<div className="import-result-row">
								<span className="import-result-count import-result-count--error">{importSummary.errors}</span>
								<span className="import-result-label">errors</span>
							</div>
						)}
						{importSummary.errors > 0 && importSummary.errorDetails.length > 0 && (
							<div className="import-result-errors">
								{importSummary.errorDetails.slice(0, 3).map((detail, i) => (
									<div
										key={i}
										style={{
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											maxWidth: "100%",
										}}
									>
										{detail.length > 80 ? `${detail.slice(0, 80)}\u2026` : detail}
									</div>
								))}
							</div>
						)}
						<div className="import-result-actions">
							<button type="button" className="btn-secondary" onClick={handleDismissResults}>
								Dismiss Results
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Refresh Stats */}
			<div className="settings-row">
				<div className="settings-label">Refresh statistics cache</div>
				<button type="button" className="btn-primary" onClick={handleRefresh}>
					Refresh Stats
				</button>
			</div>

			{/* Export JSON */}
			<div className="settings-row">
				<div className="settings-label">Export data as JSON</div>
				<button type="button" className="btn-primary" onClick={handleExportJson}>
					Export JSON
				</button>
			</div>

			{/* Export CSV */}
			<div className="settings-row">
				<div className="settings-label">Export top tracks as CSV</div>
				<button type="button" className="btn-primary" onClick={handleExportCsv}>
					Export CSV
				</button>
			</div>

			{/* Test Write */}
			<div className="settings-row">
				<div>
					<div className="settings-label">Test IndexedDB write</div>
					<div className="settings-sublabel">Verify database write access</div>
				</div>
				<button type="button" className="btn-primary" onClick={handleTestWrite}>
					Test Write
				</button>
			</div>

			{/* Wipe All Data */}
			<div
				className="settings-row"
				style={{
					flexDirection: "column",
					alignItems: "flex-start",
					gap: "12px",
				}}
			>
				{!confirmWipe ? (
					<button type="button" className="btn-destructive" onClick={() => setConfirmWipe(true)}>
						Wipe All Data
					</button>
				) : (
					<div style={{ width: "100%" }}>
						<p
							style={{
								fontSize: "var(--font-size-sm, 14px)",
								color: "var(--spice-text)",
								marginBottom: "12px",
							}}
						>
							This permanently deletes all play history and cannot be undone. Are you sure?
						</p>
						<div style={{ display: "flex", gap: "8px" }}>
							<button type="button" className="btn-destructive" onClick={handleWipeConfirm}>
								Delete Everything
							</button>
							<button type="button" className="btn-primary" onClick={() => setConfirmWipe(false)}>
								Keep My Data
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
