import type { ParsedRemoteAnnouncement } from "../shared/announcements/remote-announcement";
import { LS_KEYS } from "../shared/constants/storage-keys";

export interface BannerConfig {
	title: string;
	body: string;
	actionLabel?: string;
	actionUrl?: string;
	actionOpensChangelog?: boolean;
}

const BANNERS: Record<string, BannerConfig> = {
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

function getLocalBanner(version: string): BannerConfig | null {
	return BANNERS[version] ?? null;
}

function isLocalBannerDismissed(version: string): boolean {
	try {
		return localStorage.getItem(LS_KEYS.DISMISSED_BANNER_VERSION) === version;
	} catch {
		return false;
	}
}

function isRemoteAnnouncementDismissed(id: string): boolean {
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
