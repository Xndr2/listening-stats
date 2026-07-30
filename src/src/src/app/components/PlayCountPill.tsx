import type { ReactNode } from "react";
import type { PlayCountVariant } from "../preferences";

const { React } = Spicetify;

interface PlayCountPillProps {
	count: number;
	variant: PlayCountVariant;
	firstPlayedAt: number | null;
	/** stats.fm streams in the current dashboard period (when enabled in settings). */
	periodStreams?: number | null;
	periodLabel?: string | null;
	/** When count is 0 and Display → extra play context is on: show a first-play hint. */
	showFirstListen?: boolean;
}

function formatFirstPlayed(timestamp: number): string {
	const d = new Date(timestamp);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PlayCountPill({
	count,
	variant,
	firstPlayedAt,
	periodStreams,
	periodLabel,
	showFirstListen = false,
}: PlayCountPillProps) {
	if (variant === "off") return null;
	if (count < 1 && !showFirstListen) return null;

	const firstListenTooltip =
		"No plays in your tracked history for this track yet (skips excluded). Count updates after a qualifying listen.";

	if (showFirstListen && count < 1) {
		const pillFirst = (className: string, inner: ReactNode, title: string) =>
			React.createElement("div", { className, title }, inner);

		if (variant === "bubble") {
			return pillFirst(
				"play-count-bubble",
				[
					React.createElement("div", { key: "i", className: "play-count-bubble-icon" }, "\u{25B6}"),
					React.createElement("span", { key: "b", className: "play-count-badge play-count-badge--new" }, "NEW"),
				],
				firstListenTooltip,
			);
		}
		if (variant === "minimal") {
			return pillFirst("play-count-minimal", "New", firstListenTooltip);
		}
		return pillFirst(
			"play-count-pill play-count-pill--first",
			[
				React.createElement("span", { key: "d", className: "play-count-dot" }),
				React.createElement("span", { key: "t" }, "New play"),
			],
			firstListenTooltip,
		);
	}

	const timeWord = count === 1 ? "time" : "times";
	let tooltip = `Played ${count} ${timeWord}`;
	if (firstPlayedAt != null) {
		tooltip += ` · first on ${formatFirstPlayed(firstPlayedAt)}`;
	}
	if (periodStreams != null && periodLabel) {
		tooltip += ` · ${periodStreams} in ${periodLabel} (stats.fm top tracks)`;
	}

	const playsLabel = count === 1 ? "1 play" : `${count} plays`;
	const periodSuffix =
		periodStreams != null && periodLabel
			? React.createElement(
					"span",
					{
						style: {
							marginLeft: 6,
							fontSize: "0.85em",
							fontWeight: 500,
							color: "rgba(var(--spice-rgb-text), 0.55)",
						},
					},
					`· ${periodStreams} ${periodLabel}`,
				)
			: null;

	if (variant === "bubble") {
		return React.createElement(
			"div",
			{ className: "play-count-bubble", title: tooltip },
			React.createElement("div", { className: "play-count-bubble-icon" }, "\u{25B6}"),
			React.createElement("span", { className: "play-count-badge" }, count),
			periodStreams != null && periodLabel
				? React.createElement(
						"span",
						{
							style: {
								marginLeft: 4,
								fontSize: 10,
								color: "rgba(var(--spice-rgb-text), 0.55)",
							},
						},
						`${periodStreams}`,
					)
				: null,
		);
	}

	if (variant === "minimal") {
		const extra = periodStreams != null && periodLabel ? ` (${periodStreams} ${periodLabel})` : "";
		return React.createElement("div", { className: "play-count-minimal", title: tooltip }, `×${count}${extra}`);
	}

	return React.createElement(
		"div",
		{ className: "play-count-pill", title: tooltip },
		React.createElement("span", { className: "play-count-dot" }),
		playsLabel,
		periodSuffix,
	);
}
