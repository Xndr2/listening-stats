import type { PlayCountVariant } from "../preferences";

const { React } = Spicetify;

interface PlayCountPillProps {
	count: number;
	variant: PlayCountVariant;
	firstPlayedAt: number | null;
}

function formatFirstPlayed(timestamp: number): string {
	const d = new Date(timestamp);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getTooltip(count: number, firstPlayedAt: number | null): string {
	const base = `Played ${count} times`;
	if (firstPlayedAt == null) return base;
	return `${base} · first on ${formatFirstPlayed(firstPlayedAt)}`;
}

export function PlayCountPill({ count, variant, firstPlayedAt }: PlayCountPillProps) {
	if (count <= 1) return null;

	const tooltip = getTooltip(count, firstPlayedAt);

	if (variant === "bubble") {
		return React.createElement("div", { className: "play-count-bubble", title: tooltip },
			React.createElement("div", { className: "play-count-bubble-icon" }, "\u{25B6}"),
			React.createElement("span", { className: "play-count-badge" }, count),
		);
	}

	if (variant === "minimal") {
		return React.createElement("div", { className: "play-count-minimal", title: tooltip },
			`×${count}`,
		);
	}

	return React.createElement("div", { className: "play-count-pill", title: tooltip },
		React.createElement("span", { className: "play-count-dot" }),
		`${count} plays`,
	);
}
