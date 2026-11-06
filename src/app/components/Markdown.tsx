/** Renders parsed remote markdown as React elements. Never as HTML. */
import { type Block, type Inline, parseMarkdown } from "../../shared/remote/markdown";

function Inlines({ nodes }: { nodes: Inline[] }) {
	return (
		<>
			{nodes.map((n, i) => {
				switch (n.t) {
					case "text":
						return n.v;
					case "code":
						return <code key={i}>{n.v}</code>;
					case "strong":
						return (
							<strong key={i}>
								<Inlines nodes={n.c} />
							</strong>
						);
					case "em":
						return (
							<em key={i}>
								<Inlines nodes={n.c} />
							</em>
						);
					case "link":
						return (
							<a key={i} href={n.href} target="_blank" rel="noreferrer noopener">
								<Inlines nodes={n.c} />
							</a>
						);
					default:
						return null;
				}
			})}
		</>
	);
}

function BlockView({ b }: { b: Block }) {
	if (b.t === "h") {
		const H = b.level === 1 ? "h3" : "h4";
		return (
			<H className="ls-md-h">
				<Inlines nodes={b.c} />
			</H>
		);
	}
	if (b.t === "ul") {
		return (
			<ul>
				{b.items.map((it, i) => (
					<li key={i}>
						<Inlines nodes={it} />
					</li>
				))}
			</ul>
		);
	}
	return (
		<p>
			<Inlines nodes={b.c} />
		</p>
	);
}

export function Markdown({ source }: { source: string }) {
	return (
		<div className="ls-md">
			{parseMarkdown(source).map((b, i) => (
				<BlockView key={i} b={b} />
			))}
		</div>
	);
}
