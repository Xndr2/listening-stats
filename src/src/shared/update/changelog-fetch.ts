import { GITHUB_RAW_MAIN_BASE } from "../constants/github-repo";

export async function fetchChangelogMarkdown(): Promise<string | null> {
	try {
		const res = await fetch(`${GITHUB_RAW_MAIN_BASE}/CHANGELOG.md?t=${Date.now()}`, {
			cache: "no-store",
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}
