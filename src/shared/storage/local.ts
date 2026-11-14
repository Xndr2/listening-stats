/**
 * localStorage write that never throws. Spotify's localStorage is shared with
 * every extension, and Marketplace can fill it (QuotaExceededError); a failed
 * flag write must not stop a play from saving or a dialog from closing.
 * Returns false when the value couldn't be stored.
 */
export function setLocal(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}
