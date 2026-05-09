import semver from "semver";
import { LS_KEYS } from "../constants/storage-keys";
import { resolvePublishedRelease } from "./release-info";

export interface UpdateCheckResult {
	updateAvailable: boolean;
	localVersion: string;
	remoteVersion: string;
	remoteTag: string | null;
	prerelease?: boolean;
}

/** True if `remoteVersion` is newer than `localVersion` (semver coercion). */
export function compareVersions(localVersion: string, remoteVersion: string): boolean {
	const a = semver.coerce(localVersion);
	const b = semver.coerce(remoteVersion);
	if (!a || !b) return false;
	return semver.gt(b, a);
}

export async function checkForAppUpdate(
	localVersion: string,
	receiveBetaUpdates: boolean,
): Promise<UpdateCheckResult> {
	const resolved = await resolvePublishedRelease(receiveBetaUpdates);
	if (!resolved) {
		return {
			updateAvailable: false,
			localVersion,
			remoteVersion: localVersion,
			remoteTag: null,
		};
	}

	const updateAvailable = compareVersions(localVersion, resolved.version);
	return {
		updateAvailable,
		localVersion,
		remoteVersion: resolved.version,
		remoteTag: resolved.tag,
		prerelease: resolved.prerelease,
	};
}

export function snoozeUpdatePrompt(hours: number): void {
	try {
		const until = Date.now() + hours * 60 * 60 * 1000;
		localStorage.setItem(LS_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL, String(until));
	} catch {
		/* ignore */
	}
}

export function isUpdatePromptSnoozed(): boolean {
	try {
		const raw = localStorage.getItem(LS_KEYS.UPDATE_PROMPT_SNOOZE_UNTIL);
		if (!raw) return false;
		const until = Number.parseInt(raw, 10);
		return !Number.isNaN(until) && Date.now() < until;
	} catch {
		return false;
	}
}
