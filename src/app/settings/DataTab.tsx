import { useEffect, useRef, useState } from "react";
import { captureError } from "../../shared/errors/capture";
import { buildCsvExport, buildJsonExport, saveFile } from "../../shared/io/export";
import { type ImportResult, importFile } from "../../shared/io/import";
import { clearPlayEvents, countPlayEvents } from "../../shared/storage/play-events";
import { wipeEverything } from "../../shared/storage/wipe";
import { describeError } from "../components/Widget/Widget";
import { formatNumber } from "../format";
import { Row, Section } from "./controls";

const today = () => new Date().toISOString().slice(0, 10);

function summary(r: ImportResult): string {
	const parts = [`Added ${formatNumber(r.imported)} plays from your ${r.format}.`];
	if (r.duplicates) parts.push(`${formatNumber(r.duplicates)} were already here.`);
	if (r.ignored) parts.push(`${formatNumber(r.ignored)} podcasts or empty streams were left out.`);
	if (r.errors) parts.push(`${formatNumber(r.errors)} rows couldn't be read.`);
	return parts.join(" ");
}

export function DataTab() {
	const [count, setCount] = useState<number | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [msg, setMsg] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [confirmWipe, setConfirmWipe] = useState(false);
	const input = useRef<HTMLInputElement>(null);

	const refresh = () => void countPlayEvents().then(setCount, () => setCount(null));
	useEffect(refresh, []);

	const run = async (label: string, fn: () => Promise<void>) => {
		setBusy(label);
		setMsg(null);
		try {
			await fn();
		} catch (e) {
			void captureError(e, "app", "handled", `data:${label}`);
			setMsg({ ok: false, text: describeError(e) });
		} finally {
			setBusy(null);
			refresh();
		}
	};

	const onFile = (f: File | undefined) => {
		if (!f) return;
		void run("import", async () => {
			const r = await importFile(f);
			setMsg({ ok: r.imported > 0 || r.duplicates > 0, text: summary(r), details: r.errorDetails });
		});
		if (input.current) input.current.value = "";
	};

	return (
		<>
			<Section
				title="Your play history"
				description={count === null ? "Counting…" : `${formatNumber(count)} plays and skips are stored on this device.`}
			>
				<Row
					label="Back up everything"
					hint="Plays and settings as one file. Connected accounts aren't included."
					control={
						<button
							type="button"
							className="ls-btn-secondary"
							disabled={!!busy}
							onClick={() =>
								void run("export-json", async () => {
									saveFile(
										JSON.stringify(await buildJsonExport()),
										`listening-stats-${today()}.json`,
										"application/json",
									);
								})
							}
						>
							{busy === "export-json" ? "Preparing…" : "Export JSON"}
						</button>
					}
				/>
				<Row
					label="Spreadsheet"
					hint="Plays as CSV. Listening Stats v2 can read this file too."
					control={
						<button
							type="button"
							className="ls-btn-secondary"
							disabled={!!busy}
							onClick={() =>
								void run("export-csv", async () => {
									saveFile(await buildCsvExport(), `listening-stats-${today()}.csv`, "text/csv");
								})
							}
						>
							{busy === "export-csv" ? "Preparing…" : "Export CSV"}
						</button>
					}
				/>
			</Section>
			<Section
				title="Import"
				description={
					<>
						Accepts a Listening Stats backup (any version, JSON or CSV) or your Spotify data. For Spotify, request
						“Extended streaming history” on your{" "}
						<a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer noopener">
							account privacy page
						</a>{" "}
						and pick the zip here once it arrives. Plays you already have are skipped.
					</>
				}
			>
				<Row
					label="Import a file"
					hint=".json, .csv or .zip"
					control={
						<>
							<input
								ref={input}
								type="file"
								accept=".json,.csv,.zip"
								className="ls-visually-hidden"
								aria-label="Choose a file to import"
								onChange={(e) => onFile(e.target.files?.[0])}
							/>
							<button type="button" className="ls-btn-primary" disabled={!!busy} onClick={() => input.current?.click()}>
								{busy === "import" ? "Importing…" : "Choose file"}
							</button>
						</>
					}
				/>
				{msg && (
					<div className={`ls-set-msg ${msg.ok ? "is-ok" : "is-err"}`} role="status">
						<p>{msg.text}</p>
						{msg.details && msg.details.length > 0 && (
							<ul className="ls-set-hint">
								{msg.details.map((d) => (
									<li key={d}>{d}</li>
								))}
							</ul>
						)}
					</div>
				)}
			</Section>
			<Section
				title="Start over"
				description="These can't be undone. Export a backup first if you might want anything back."
			>
				<Row
					label="Delete local history"
					control={
						confirmDelete ? (
							<div className="ls-set-buttons">
								<button type="button" className="ls-btn-secondary" onClick={() => setConfirmDelete(false)}>
									Keep it
								</button>
								<button
									type="button"
									className="ls-btn-danger"
									disabled={!!busy}
									onClick={() =>
										void run("delete", async () => {
											await clearPlayEvents();
											setConfirmDelete(false);
											setMsg({ ok: true, text: "Local history deleted." });
										})
									}
								>
									Delete {count === null ? "" : formatNumber(count)} plays
								</button>
							</div>
						) : (
							<button type="button" className="ls-btn-secondary" onClick={() => setConfirmDelete(true)}>
								Delete…
							</button>
						)
					}
				/>
				<Row
					label="Remove everything"
					hint="Play history, settings, connected accounts and their keys, playlists list, cache and error log. Listening Stats starts again as if just installed. Your Spotify playlists stay."
					control={
						confirmWipe ? (
							<div className="ls-set-buttons">
								<button type="button" className="ls-btn-secondary" onClick={() => setConfirmWipe(false)}>
									Cancel
								</button>
								<button
									type="button"
									className="ls-btn-danger"
									disabled={!!busy}
									onClick={() =>
										void run("wipe", async () => {
											await wipeEverything();
											// Memory still holds the old settings and data; start fresh.
											location.reload();
										})
									}
								>
									{busy === "wipe" ? "Removing…" : "Remove everything"}
								</button>
							</div>
						) : (
							<button type="button" className="ls-btn-secondary" onClick={() => setConfirmWipe(true)}>
								Remove…
							</button>
						)
					}
				/>
			</Section>
		</>
	);
}
