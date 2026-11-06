/** Minimal CSV (RFC 4180 quoting) for LS's own exports and imports. */

export function splitCsvRow(line: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			if (c === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cur += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			out.push(cur);
			cur = "";
		} else cur += c;
	}
	out.push(cur);
	return out;
}

/** Quotes a field; newlines are flattened because the importer is line-based. */
export function csvField(v: string | number | undefined | null): string {
	if (v === undefined || v === null) return "";
	if (typeof v === "number") return String(v);
	// A leading = + - @ would run as a formula in spreadsheet apps.
	const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
	return `"${safe.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}
