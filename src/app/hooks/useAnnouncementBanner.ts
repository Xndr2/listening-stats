import type { ParsedRemoteAnnouncement } from "../../shared/announcements/remote-announcement";
import { fetchRemoteAnnouncement } from "../../shared/announcements/remote-announcement";
import { EVENTS } from "../../shared/constants/events";
import type { ResolvedBanner } from "../banners";
import { resolveAnnouncementBanner } from "../banners";
import { getPreferences, setPreference } from "../preferences";

const { useState, useEffect, useCallback, useMemo } = Spicetify.React;

/**
 * Remote GitHub announcement + baked-in version banner resolution, including
 * the "new announcement un-hides a previously dismissed banner" rule.
 */
export function useAnnouncementBanner(version: string, onPrefsChanged: () => void) {
	const [remoteAnnouncement, setRemoteAnnouncement] = useState<ParsedRemoteAnnouncement | null>(null);

	useEffect(() => {
		fetchRemoteAnnouncement()
			.then(setRemoteAnnouncement)
			.catch(() => {});
	}, []);

	const resolvedBanner: ResolvedBanner | null = useMemo(
		() => resolveAnnouncementBanner(version, remoteAnnouncement),
		[version, remoteAnnouncement],
	);

	useEffect(() => {
		if (!resolvedBanner) return;
		const p = getPreferences();
		if (p.showAnnouncementBanner) return;
		const cur = resolvedBanner.dismissKey;
		const hid = p.announcementBannerHiddenForDismissKey;
		if (cur !== hid) {
			setPreference("showAnnouncementBanner", true);
			setPreference("announcementBannerHiddenForDismissKey", "");
			window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
			onPrefsChanged();
		}
	}, [resolvedBanner, onPrefsChanged]);

	const dismissBanner = useCallback(() => {
		if (!resolvedBanner) return;
		setPreference("showAnnouncementBanner", false);
		setPreference("announcementBannerHiddenForDismissKey", resolvedBanner.dismissKey);
		window.dispatchEvent(new CustomEvent(EVENTS.PREFS_CHANGED));
		onPrefsChanged();
	}, [resolvedBanner, onPrefsChanged]);

	return { resolvedBanner, dismissBanner };
}
