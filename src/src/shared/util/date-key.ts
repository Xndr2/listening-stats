/** Local-timezone calendar day key, e.g. "2026-07-29". */
export function toLocalDateKey(timestampMs: number): string {
	const d = new Date(timestampMs);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
