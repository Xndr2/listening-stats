import { EVENTS } from "../../../shared/constants/events";
import { statsCache } from "../../../shared/stats/stats-cache";
import { db } from "../../../shared/storage/db";
import { importFileEvents, type ParseResult, parseHistoryCsv, parseJsonEvents } from "../../../shared/storage/import";
import { parseSpotifyZip, type SpotifyZipParseResult } from "../../../shared/storage/spotify-zip";
import { downloadFile } from "../../utils";
import { SettingRow, SettingsGroup } from "./controls";

const { useState, useRef } = Spicetify.React;

interface Props {
	onRefresh: () => void;
}

type ImportPhase = "idle" | "parsing" | "confirm-zip" | "importing" | "complete";

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
	const [pendingZip, setPendingZip] = useState<SpotifyZipParseResult | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleRefresh = () => {
		statsCache.invalidate();
		onRefresh();
		Spicetify.showNotification("Stats refreshed");
	};

	/** Chunked bulk insert with progress + UI-thread yields; finishes into the summary card. */
	const runImport = async (parseResult: ParseResult) => {
		setImportPhase("importing");
		setImportProgress({ current: 0, total: parseResult.events.length });

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
	};

	const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Reset file input so the same file can be re-selected
		if (fileInputRef.current) fileInputRef.current.value = "";

		const isCSV = file.name.endsWith(".csv");
		const isJSON = file.name.endsWith(".json");
		const isZIP = file.name.endsWith(".zip");

		if (!isCSV && !isJSON && !isZIP) {
			Spicetify.showNotification("Unsupported file type. Use .csv, .json or .zip.", true);
			return;
		}

		// A decade of heavy listening exports well under this; larger files would freeze the renderer
		const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
		if (file.size > MAX_IMPORT_BYTES) {
			Spicetify.showNotification("Import failed: file larger than 100 MB", true);
			return;
		}

		try {
			if (isZIP) {
				setImportPhase("parsing");
				const zipResult = await parseSpotifyZip(await file.arrayBuffer());
				if (zipResult.events.length === 0) {
					Spicetify.showNotification("Import failed: no music plays found in this zip", true);
					setImportPhase("idle");
					return;
				}
				// Zip imports re-add everything Spotify ever recorded, so let the
				// user choose replace vs merge before touching the database.
				setPendingZip(zipResult);
				setImportPhase("confirm-zip");
				return;
			}

			setImportPhase("parsing");
			const text = await file.text();
			const parseResult: ParseResult = isCSV ? await parseHistoryCsv(text) : await parseJsonEvents(text);

			if (parseResult.events.length === 0 && parseResult.errors === 0) {
				Spicetify.showNotification("Import failed: file contains no events", true);
				setImportPhase("idle");
				return;
			}

			await runImport(parseResult);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown import error";
			Spicetify.showNotification(message, true);
			setImportPhase("idle");
			console.error("[DataTab] Import error:", err);
		}
	};

	const handleZipImport = async (replaceExisting: boolean) => {
		if (!pendingZip) return;
		const zip = pendingZip;
		setPendingZip(null);
		try {
			if (replaceExisting) {
				// Only play history - preferences and the artist enrichment cache stay.
				await db.playEvents.clear();
			}
			await runImport(zip);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown import error";
			Spicetify.showNotification(message, true);
			setImportPhase("idle");
			console.error("[DataTab] Zip import error:", err);
		}
	};

	const handleDismissResults = () => {
		setImportPhase("idle");
		setImportSummary(null);
	};

	const handleExportJson = async () => {
		try {
			// Raw play-event dump, not aggregated stats: this is the shape
			// parseJsonEvents accepts, so a backup can be re-imported later.
			const events = await db.playEvents.toArray();
			if (events.length === 0) {
				Spicetify.showNotification("No local play history to export", true);
				return;
			}
			const backup = events.map(({ id: _id, ...rest }) => rest);
			downloadFile(JSON.stringify(backup), "listening-stats-backup.json", "application/json");
		} catch (err) {
			Spicetify.showNotification("Export failed. Check console.", true);
			console.error("[DataTab] Export JSON error:", err);
		}
	};

	const handleExportCsv = async () => {
		try {
			// Raw play-event dump in the v2 header format parseHistoryCsv accepts,
			// so the backup can be re-imported. Newlines are flattened: the CSV
			// parser is line-based.
			const events = await db.playEvents.toArray();
			if (events.length === 0) {
				Spicetify.showNotification("No local play history to export", true);
				return;
			}
			const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
			const header =
				"Track,Artist,Album,Duration (ms),Played (ms),Started At,Ended At,Type,Track URI,Artist URI,Album URI,Album Art\n";
			const rows = events
				.map((e) =>
					[
						esc(e.trackName),
						esc(e.artistName),
						esc(e.albumName),
						e.durationMs,
						e.playedMs,
						new Date(e.startedAt).toISOString(),
						new Date(e.endedAt).toISOString(),
						e.type,
						esc(e.trackUri),
						esc(e.artistUri),
						esc(e.albumUri),
						esc(e.albumArt ?? ""),
					].join(","),
				)
				.join("\n");
			downloadFile(header + rows, "listening-stats-backup.csv", "text/csv");
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

	// Only remove this app's keys - clear() would wipe storage for the whole
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
			<SettingsGroup title="Library">
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
						accept=".csv,.json,.zip"
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
								<div className="settings-sublabel">
									A .json backup from this app, .csv / .json from a v1 export, or the Spotify "Extended streaming
									history" .zip from spotify.com/account/privacy
								</div>
							</div>
							<button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
								Import
							</button>
						</div>
					)}

					{importPhase === "parsing" && (
						<div className="import-progress">
							<span className="import-progress-label">Reading file...</span>
							<progress className="import-progress-bar" />
						</div>
					)}

					{importPhase === "confirm-zip" && pendingZip && (
						<div className="import-result-card">
							<p
								style={{
									margin: 0,
									fontSize: "var(--font-size-sm, 14px)",
									color: "var(--spice-text)",
								}}
							>
								Found <strong>{pendingZip.events.length.toLocaleString()}</strong> music plays in {pendingZip.filesRead}{" "}
								history file
								{pendingZip.filesRead === 1 ? "" : "s"}
								{pendingZip.ignored > 0
									? ` (${pendingZip.ignored.toLocaleString()} podcast/zero-length rows ignored)`
									: ""}
								. This export contains everything Spotify ever recorded for your account - including plays this app
								already tracked.
							</p>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "8px",
									width: "100%",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "12px",
									}}
								>
									<div className="settings-sublabel" style={{ flex: 1 }}>
										<strong>Replace (recommended):</strong> deletes your existing local play history first, then imports
										the export. Guarantees no duplicate plays.
									</div>
									<button type="button" className="btn-primary" onClick={() => handleZipImport(true)}>
										Replace
									</button>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "12px",
									}}
								>
									<div className="settings-sublabel" style={{ flex: 1 }}>
										<strong>Merge:</strong> keeps your current history and skips exact duplicates (same start time +
										track). Plays tracked live by this app have slightly different timestamps, so some may appear twice.
										Use this for the 2nd+ zip of a multi-zip export.
									</div>
									<button type="button" className="btn-secondary" onClick={() => handleZipImport(false)}>
										Merge
									</button>
								</div>
								<div style={{ display: "flex", justifyContent: "flex-end" }}>
									<button
										type="button"
										className="btn-secondary"
										onClick={() => {
											setPendingZip(null);
											setImportPhase("idle");
										}}
									>
										Cancel
									</button>
								</div>
							</div>
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

				<SettingRow label="Export play history as JSON">
					<button type="button" className="btn-secondary" onClick={handleExportJson}>
						Export
					</button>
				</SettingRow>

				<SettingRow label="Export play history as CSV">
					<button type="button" className="btn-secondary" onClick={handleExportCsv}>
						Export
					</button>
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Maintenance">
				<SettingRow label="Refresh statistics cache">
					<button type="button" className="btn-secondary" onClick={handleRefresh}>
						Refresh
					</button>
				</SettingRow>

				<SettingRow label="Test database write">
					<button type="button" className="btn-secondary" onClick={handleTestWrite}>
						Test
					</button>
				</SettingRow>
			</SettingsGroup>

			<SettingsGroup title="Danger zone">
				{!confirmWipe ? (
					<SettingRow label="Wipe all data" sublabel="Deletes all play history permanently">
						<button type="button" className="btn-destructive" onClick={() => setConfirmWipe(true)}>
							Wipe
						</button>
					</SettingRow>
				) : (
					<div
						className="settings-row"
						style={{
							flexDirection: "column",
							alignItems: "flex-start",
							gap: "12px",
						}}
					>
						<p
							style={{
								fontSize: "var(--font-size-sm, 14px)",
								color: "var(--spice-text)",
								margin: 0,
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
			</SettingsGroup>
		</div>
	);
}
