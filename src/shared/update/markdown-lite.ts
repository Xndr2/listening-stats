/**
 * Minimal markdown for changelog display  -  avoids a full parser bundle.
 * Supports ## headings (mapped to h3), paragraphs, **bold**, [text](url), `code`.
 */
export function markdownLiteToHtml(md: string): string {
	const lines = md.replace(/\r\n/g, "\n").split("\n");
	const out: string[] = [];
	let inPara = false;

	function flushPara() {
		if (inPara) {
			out.push("</p>");
			inPara = false;
		}
	}

	function inline(s: string): string {
		let t = escapeHtml(s);
		t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
		t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
		t = t.replace(
			/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
			'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
		);
		return t;
	}

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const trimmed = line.trim();

		if (trimmed === "") {
			flushPara();
			continue;
		}

		const h2 = trimmed.match(/^##+\s+(.*)$/);
		if (h2) {
			flushPara();
			out.push(`<h3>${inline(h2[1] ?? "")}</h3>`);
			continue;
		}

		if (!inPara) {
			out.push("<p>");
			inPara = true;
		} else {
			out.push("<br />");
		}
		out.push(inline(trimmed));
	}
	flushPara();
	return out.join("");
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
