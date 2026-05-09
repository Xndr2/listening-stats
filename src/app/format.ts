export function formatDuration(ms: number): string {
	if (ms < 60_000) return "<1 min";
	const totalMinutes = Math.floor(ms / 60_000);
	if (totalMinutes < 60) return `${totalMinutes} min`;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;
	return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatRelativeTime(timestampMs: number): string {
	const diffMs = Date.now() - timestampMs;
	const diffSec = Math.floor(diffMs / 1000);
	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	return `${diffDays}d ago`;
}

export function formatNumber(n: number): string {
	try {
		return Spicetify.Locale.formatNumber(n);
	} catch {
		return String(n);
	}
}

export function formatHour(hour: number, use24h: boolean): string {
	if (use24h) return `${hour}:00`;
	if (hour === 0) return "12am";
	if (hour < 12) return `${hour}am`;
	if (hour === 12) return "12pm";
	return `${hour - 12}pm`;
}

export function formatEstimatedPayout(totalPlays: number): string {
	// Spotify average per-stream rate ~$0.004
	const payout = totalPlays * 0.004;
	return `$${payout.toFixed(2)}`;
}
