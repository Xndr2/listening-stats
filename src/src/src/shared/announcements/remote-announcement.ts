import { GITHUB_RAW_MAIN_BASE, GITHUB_REPO_WEB_URL } from "../constants/github-repo";

const SESSION_CACHE_KEY = "listening-stats:remote-announcement-cache";
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface ParsedRemoteAnnouncement {
	dismissId: string;
	title: string;
	body: string;
	actionLabel?: string;
	actionUrl?: string;
	/** Opens the in-app Updates modal (changelog) instead of navigating. */
	actionOpensChangelog?: boolean;
}

function simpleHash(input: string): string {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(36);
}

/** Legacy `UPDATE …` first line → banner; primary action opens the in-app Updates modal. */
function parseUpdateFirstLine(line: string): { dismissId: string; headline: string } | null {
	const trimmed = line.trim();
	const m = trimmed.match(/^UPDATE\s*(.*)$/i);
	if (!m) return null;
	const payload = m[1].trim();
	const pipe = payload.indexOf("|");
	if (pipe >= 0) {
		const idPart = payload.slice(0, pipe).trim();
		const headline = payload.slice(pipe + 1).trim();
		return {
			dismissId: idPart || simpleHash(trimmed),
			headline: headline || "Notice from the Listening Stats maintainers.",
		};
	}
	return {
		dismissId: simpleHash(trimmed),
		headline: payload || "Notice from the Listening Stats maintainers.",
	};
}

/**
 * `ANNOUNCEMENT.md` on the default branch:
 * - First line `UPDATE …` → headline banner + Changelog (opens Updates modal)
 * - First line `# Title` → title + body
 * - Otherwise → generic announcement body
 */
export function parseAnnouncementMarkdown(raw: string): ParsedRemoteAnnouncement | null {
	const text = raw.replace(/^\uFEFF/, "").trim();
	if (!text) return null;

	const firstBreak = text.indexOf("\n");
	const line1 = (firstBreak === -1 ? text : text.slice(0, firstBreak)).trim();
	const rest = firstBreak === -1 ? "" : text.slice(firstBreak + 1).trim();

	const update = parseUpdateFirstLine(line1);
	if (update) {
		return {
			dismissId: update.dismissId,
			title: update.headline,
			body: rest.trim() || "Open the changelog in the app, or run the install script from Settings → About to update.",
			actionLabel: "Changelog",
			actionUrl: `${GITHUB_REPO_WEB_URL}/releases`,
			actionOpensChangelog: true,
		};
	}

	if (line1.startsWith("# ")) {
		const title = line1.slice(2).trim();
		return {
			dismissId: simpleHash(text),
			title,
			body: rest,
		};
	}

	return {
		dismissId: simpleHash(text),
		title: "Announcement",
		body: text,
	};
}

interface CacheEnvelope {
	t: number;
	text: string;
}

export async function fetchRemoteAnnouncement(): Promise<ParsedRemoteAnnouncement | null> {
	let text: string | null = null;

	try {
		const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as CacheEnvelope;
			if (
				parsed &&
				typeof parsed.t === "number" &&
				typeof parsed.text === "string" &&
				Date.now() - parsed.t < CACHE_TTL_MS
			) {
				text = parsed.text;
			}
		}
	} catch {
		/* ignore */
	}

	if (text === null) {
		try {
			const res = await fetch(`${GITHUB_RAW_MAIN_BASE}/ANNOUNCEMENT.md?t=${Date.now()}`, {
				cache: "no-store",
			});
			if (res.status === 404) {
				text = "";
			} else if (!res.ok) {
				return null;
			} else {
				text = await res.text();
			}
			try {
				sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ t: Date.now(), text: text ?? "" }));
			} catch {
				/* ignore */
			}
		} catch {
			return null;
		}
	}

	if (text === null || text === "") return null;
	return parseAnnouncementMarkdown(text);
}
