import { LS_KEYS } from "../shared/constants/storage-keys";
import type { ParsedRemoteAnnouncement } from "../shared/announcements/remote-announcement";

export interface BannerConfig {
	title: string;
	body: string;
	actionLabel?: string;
	actionUrl?: string;
	actionOpensChangelog?: boolean;
}

export const BANNERS: Record<string, BannerConfig> = {
	"2.6": {
		title: "v2.6 is here",
		body: "section streaming, share cards, world charts.",
		actionLabel: "What's new →",
	},
};

export interface ResolvedBanner extends BannerConfig {
	source: "remote" | "local";
	dismissKey: string;
}

export function getLocalBanner(version: string): BannerConfig | null {
	return BANNERS[version] ?? null;
}

export function isLocalBannerDismissed(version: string): boolean {
	try {
		return localStorage.getItem(LS_KEYS.DISMISSED_BANNER_VERSION) === version;
	} catch {
		return false;
	}
}

export function isRemoteAnnouncementDismissed(id: string): boolean {
	try {
		return localStorage.getItem(LS_KEYS.DISMISSED_REMOTE_ANNOUNCEMENT_ID) === id;
	} catch {
		return false;
	}
}

/**
 * Remote GitHub announcement (if any) takes precedence over baked-in per-version banners.
 */
export function resolveAnnouncementBanner(
	version: string,
	remote: ParsedRemoteAnnouncement | null,
): ResolvedBanner | null {
	if (remote && !isRemoteAnnouncementDismissed(remote.dismissId)) {
		return {
			source: "remote",
			dismissKey: remote.dismissId,
			title: remote.title,
			body: remote.body,
			actionLabel: remote.actionLabel,
			actionUrl: remote.actionUrl,
			actionOpensChangelog: remote.actionOpensChangelog,
		};
	}

	const local = getLocalBanner(version);
	if (local && !isLocalBannerDismissed(version)) {
		return {
			source: "local",
			dismissKey: version,
			title: local.title,
			body: local.body,
			actionLabel: local.actionLabel,
			actionUrl: local.actionUrl,
		};
	}

	return null;
}

/** Local banner only  -  used by tests and legacy call sites. */
export function getActiveBanner(currentVersion: string): BannerConfig | null {
	const local = getLocalBanner(currentVersion);
	if (!local) return null;
	if (isLocalBannerDismissed(currentVersion)) return null;
	return local;
}

export function dismissBanner(version: string): void {
	try {
		localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, version);
	} catch {
		/* ignore */
	}
}

export function dismissRemoteAnnouncement(id: string): void {
	try {
		localStorage.setItem(LS_KEYS.DISMISSED_REMOTE_ANNOUNCEMENT_ID, id);
	} catch {
		/* ignore */
	}
}
