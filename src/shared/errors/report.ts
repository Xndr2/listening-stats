/**
 * Plain-text reports for when Sentry isn't set up: copy to clipboard, or open
 * a prefilled GitHub issue. Entries are already scrubbed; the user's note is
 * scrubbed here.
 */
import { GITHUB_REPO } from "../constants/app";
import type { ErrorEntry } from "./log";
import { scrubText } from "./scrub";

export function formatReport(entry: ErrorEntry, note = ""): string {
	const lines = [
		`Listening Stats ${entry.appVersion} · Spotify ${entry.spotifyVersion} · Spicetify ${entry.spicetifyVersion}`,
		`Provider: ${entry.provider} · Where: ${entry.where ?? "-"} · ${entry.source}/${entry.kind}`,
		`When: ${new Date(entry.at).toISOString()}`,
		"",
		`${entry.name}: ${entry.message}`,
		entry.stack,
	];
	if (entry.breadcrumbs.length) lines.push("", "Before it happened:", ...entry.breadcrumbs);
	const cleanNote = scrubText(note.trim());
	if (cleanNote) lines.unshift(`What I was doing: ${cleanNote}`, "");
	return lines.join("\n");
}

/** GitHub caps URLs around 8 KB; keep the body well under that. */
export function githubIssueUrl(entry: ErrorEntry, note = ""): string {
	const title = `Crash: ${entry.name}: ${entry.message}`.slice(0, 120);
	const body = `\`\`\`\n${formatReport(entry, note).slice(0, 5000)}\n\`\`\``;
	return `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
