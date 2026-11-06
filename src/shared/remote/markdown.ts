/**
 * A deliberately small markdown parser for changelogs and announcements
 * fetched from GitHub. It produces a plain tree that the UI turns into React
 * elements, so remote text can never become HTML. Supported: headings,
 * paragraphs, bullet lists, **bold**, *italic*, `code` and https links.
 * Images are not supported on purpose (a remote file must not be able to
 * make every client load an arbitrary URL).
 */

export type Inline =
	| { t: "text"; v: string }
	| { t: "strong"; c: Inline[] }
	| { t: "em"; c: Inline[] }
	| { t: "code"; v: string }
	| { t: "link"; href: string; c: Inline[] };

export type Block =
	| { t: "h"; level: 1 | 2 | 3; c: Inline[] }
	| { t: "p"; c: Inline[] }
	| { t: "ul"; items: Inline[][] };

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;

export function parseInline(s: string): Inline[] {
	const out: Inline[] = [];
	let rest = s;
	while (rest) {
		const candidates: Array<{ i: number; len: number; node: Inline }> = [];
		const code = rest.match(/`([^`]+)`/);
		if (code?.index !== undefined)
			candidates.push({ i: code.index, len: code[0].length, node: { t: "code", v: code[1] } });
		const strong = rest.match(/\*\*([^*]+)\*\*/);
		if (strong?.index !== undefined)
			candidates.push({ i: strong.index, len: strong[0].length, node: { t: "strong", c: parseInline(strong[1]) } });
		const em = rest.match(/(?<![*\w])\*([^*\s][^*]*)\*(?!\*)|(?<!\w)_([^_]+)_(?!\w)/);
		if (em?.index !== undefined)
			candidates.push({ i: em.index, len: em[0].length, node: { t: "em", c: parseInline(em[1] ?? em[2]) } });
		const link = rest.match(LINK);
		if (link?.index !== undefined) {
			// Only https links survive; anything else stays as its visible text.
			const node: Inline = /^https:\/\//i.test(link[2])
				? { t: "link", href: link[2], c: parseInline(link[1]) }
				: { t: "text", v: link[1] };
			candidates.push({ i: link.index, len: link[0].length, node });
		}
		if (!candidates.length) {
			out.push({ t: "text", v: rest });
			break;
		}
		const first = candidates.sort((a, b) => a.i - b.i)[0];
		if (first.i > 0) out.push({ t: "text", v: rest.slice(0, first.i) });
		out.push(first.node);
		rest = rest.slice(first.i + first.len);
	}
	return out;
}

export function parseMarkdown(md: string): Block[] {
	const blocks: Block[] = [];
	let para: string[] = [];
	let list: string[] | null = null;
	const flush = () => {
		if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
		if (list) blocks.push({ t: "ul", items: list.map(parseInline) });
		para = [];
		list = null;
	};
	for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
		const line = raw.trim();
		if (!line) {
			flush();
			continue;
		}
		const h = line.match(/^(#{1,3})\s+(.*)$/);
		const li = line.match(/^[-*]\s+(.*)$/);
		if (h) {
			flush();
			blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2]) });
		} else if (li) {
			if (para.length) flush();
			list ??= [];
			list.push(li[1]);
		} else if (/^!\[/.test(line)) {
			// image line: dropped
		} else {
			if (list) flush();
			para.push(line);
		}
	}
	flush();
	return blocks;
}
