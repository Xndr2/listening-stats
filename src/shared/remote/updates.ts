/**
 * New-version check and developer announcements, both read from the public
 * GitHub repo (same files v2 used). Results are cached so Spotify restarts
 * don't hammer GitHub; failures are silent (this is never worth an error).
 */
import { APP_VERSION, GITHUB_REPO } from "../constants/app";
import { getJson } from "../net/http";

const UPDATE_CACHE = "listening-stats:v3:update-cache";
const ANNOUNCE_CACHE = "listening-stats:v3:announcement-cache";
const UPDATE_TTL = 6 * 3_600_000;
const ANNOUNCE_TTL = 30 * 60_000;

/** -1 / 0 / 1. Pre-release suffixes sort before the release ("3.0.0-dev" < "3.0.0"). */
export function compareVersions(a: string, b: string): number {
	const parse = (v: string) => {
		const [core, pre = ""] = v.replace(/^v/i, "").trim().split("-", 2);
		return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
	};
	const x = parse(a);
	const y = parse(b);
	for (let i = 0; i < 3; i++) {
		const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
		if (d) return Math.sign(d);
	}
	if (x.pre === y.pre) return 0;
	if (!x.pre) return 1;
	if (!y.pre) return -1;
	return x.pre < y.pre ? -1 : 1;
}

export interface ReleaseInfo {
	version: string;
	notes: string;
	url: string;
	prerelease: boolean;
}

interface GhRelease {
	tag_name?: string;
	prerelease?: boolean;
	draft?: boolean;
	body?: string;
	html_url?: string;
	assets?: Array<{ name?: string }>;
}

function cached<T>(key: string, ttl: number): T | undefined {
	try {
		const c = JSON.parse(localStorage.getItem(key) ?? "null") as { at: number; v: T } | null;
		return c && Date.now() - c.at < ttl ? c.v : undefined;
	} catch {
		return undefined;
	}
}

function store(key: string, v: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify({ at: Date.now(), v }));
	} catch {
		// non-essential
	}
}

/** The newest release that ships the app zip, or null. Includes pre-releases when asked. */
export async function latestRelease(includeBeta: boolean): Promise<ReleaseInfo | null> {
	const key = `${UPDATE_CACHE}:${includeBeta ? "beta" : "stable"}`;
	const hit = cached<ReleaseInfo | null>(key, UPDATE_TTL);
	if (hit !== undefined) return hit;
	const list = await getJson<GhRelease[]>(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=15`, {
		headers: { Accept: "application/vnd.github+json" },
	});
	const pick = (Array.isArray(list) ? list : [])
		.filter((r) => !r.draft && typeof r.tag_name === "string" && (includeBeta || !r.prerelease))
		.filter((r) => r.assets?.some((a) => a.name === "listening-stats.zip"))
		.sort((a, b) => compareVersions(b.tag_name as string, a.tag_name as string))[0];
	const info = pick
		? {
				version: (pick.tag_name as string).replace(/^v/i, ""),
				notes: (pick.body ?? "").slice(0, 20_000),
				url: pick.html_url?.startsWith("https://github.com/")
					? pick.html_url
					: `https://github.com/${GITHUB_REPO}/releases`,
				prerelease: !!pick.prerelease,
			}
		: null;
	store(key, info);
	return info;
}

export async function availableUpdate(includeBeta: boolean): Promise<ReleaseInfo | null> {
	const r = await latestRelease(includeBeta);
	return r && compareVersions(r.version, APP_VERSION) > 0 ? r : null;
}

export interface Announcement {
	id: string;
	title: string;
	body: string;
}

function hash(s: string): string {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return (h >>> 0).toString(36);
}

/**
 * ANNOUNCEMENT.md formats (as in v2):
 *   "UPDATE <id>|<headline>"   -> headline only
 *   "# Title" + body           -> title and body
 *   anything else              -> body only
 * The id that dismissal remembers is the explicit one, or a hash of the text.
 */
export function parseAnnouncement(raw: string): Announcement | null {
	const text = raw.replace(/^﻿/, "").trim();
	if (!text) return null;
	const nl = text.indexOf("\n");
	const first = (nl < 0 ? text : text.slice(0, nl)).trim();
	const rest = nl < 0 ? "" : text.slice(nl + 1).trim();
	const upd = first.match(/^UPDATE\s*(.*)$/i);
	if (upd) {
		const [idPart, ...head] = upd[1].split("|");
		const headline = (head.length ? head.join("|") : idPart).trim();
		return {
			id: head.length && idPart.trim() ? idPart.trim() : hash(first),
			title: headline || "News from Listening Stats",
			body: rest,
		};
	}
	const h = first.match(/^#\s+(.*)$/);
	if (h) return { id: hash(text), title: h[1].trim(), body: rest };
	return { id: hash(text), title: "News from Listening Stats", body: text };
}

export async function fetchAnnouncement(): Promise<Announcement | null> {
	const hit = cached<Announcement | null>(ANNOUNCE_CACHE, ANNOUNCE_TTL);
	if (hit !== undefined) return hit;
	const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/ANNOUNCEMENT.md`, {
		cache: "no-store",
	});
	const a = res.ok ? parseAnnouncement((await res.text()).slice(0, 10_000)) : null;
	store(ANNOUNCE_CACHE, a);
	return a;
}
