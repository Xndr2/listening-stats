import {
	GITHUB_API_REPO_BASE,
	GITHUB_DIST_META_URL,
	JSDELIVR_DIST_META_URL,
} from "../constants/github-repo";

export interface ResolvedRelease {
	tag: string;
	version: string;
	prerelease: boolean;
}

function versionFromTag(tag: string): string {
	return tag.replace(/^v/i, "").trim();
}

async function fetchDistMeta(): Promise<{ tag: string; prerelease: boolean } | null> {
	const bases = [GITHUB_DIST_META_URL, JSDELIVR_DIST_META_URL];
	for (const base of bases) {
		try {
			const res = await fetch(`${base}?t=${Date.now()}`, { cache: "no-store" });
			if (!res.ok) continue;
			const j = (await res.json()) as { tag?: unknown; prerelease?: unknown };
			if (typeof j.tag !== "string" || !j.tag) continue;
			return { tag: j.tag, prerelease: Boolean(j.prerelease) };
		} catch {
			/* next mirror */
		}
	}
	return null;
}

async function fetchGitHubJson<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(`${GITHUB_API_REPO_BASE}${path}`, {
			cache: "no-store",
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

type ReleasePayload = {
	tag_name?: string;
	prerelease?: boolean;
	assets?: Array<{ name?: string }>;
};

function firstReleaseWithZip(list: ReleasePayload[] | null): ReleasePayload | undefined {
	if (!list?.length) return undefined;
	return list.find((r) => {
		if (typeof r.tag_name !== "string" || !r.tag_name) return false;
		const assets = r.assets ?? [];
		return assets.some((a) => a.name === "listening-stats.zip");
	});
}

/**
 * Resolves the published release to compare against the embedded app version.
 *
 * - **Stable (Prereleases off):** GitHub `GET /releases/latest`, then optional `dist/latest-release.json`.
 * - **Beta (Prereleases on):** Newest GitHub release that ships `listening-stats.zip` (includes prereleases),
 *   then fallbacks above if needed.
 */
export async function resolvePublishedRelease(
	receiveBetaUpdates: boolean,
): Promise<ResolvedRelease | null> {
	if (receiveBetaUpdates) {
		const list = await fetchGitHubJson<ReleasePayload[]>("/releases?per_page=15");
		const picked = firstReleaseWithZip(list ?? null);
		if (picked?.tag_name) {
			return {
				tag: picked.tag_name,
				version: versionFromTag(picked.tag_name),
				prerelease: Boolean(picked.prerelease),
			};
		}
	}

	const latest = await fetchGitHubJson<{ tag_name?: string; prerelease?: boolean }>(
		"/releases/latest",
	);
	if (latest?.tag_name) {
		return {
			tag: latest.tag_name,
			version: versionFromTag(latest.tag_name),
			prerelease: Boolean(latest.prerelease),
		};
	}

	const meta = await fetchDistMeta();
	if (meta) {
		const usable = receiveBetaUpdates || !meta.prerelease;
		if (usable) {
			return {
				tag: meta.tag,
				version: versionFromTag(meta.tag),
				prerelease: meta.prerelease,
			};
		}
	}

	return null;
}
