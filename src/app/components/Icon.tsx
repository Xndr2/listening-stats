/**
 * Icons on a 16 px grid. Where Spotify ships the same icon (Spicetify.SVGIcons)
 * we use its path data so LS matches the host exactly; only the `d`
 * attributes are taken from that markup, never injected as HTML. The paths
 * below are the fallback for icons Spotify doesn't have or a client that
 * lacks SVGIcons. An entry can hold several paths.
 */
const PATHS = {
	// Spotify's own share and settings icons (from its icon set; SVGIcons has neither).
	share: [
		"M1 5.75A.75.75 0 0 1 1.75 5H4v1.5H2.5v8h11v-8H12V5h2.25a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z",
		"M8 9.576a.75.75 0 0 0 .75-.75V2.903l1.454 1.454a.75.75 0 0 0 1.06-1.06L8 .03 4.735 3.296a.75.75 0 0 0 1.06 1.061L7.25 2.903v5.923c0 .414.336.75.75.75",
	],
	settings: [
		"m15.51 7.484-1.09-.406a.55.55 0 0 1-.3-.412.53.53 0 0 1 .1-.472l.8-.846a.76.76 0 0 0 .13-.87 8.3 8.3 0 0 0-2.082-2.645.75.75 0 0 0-.865-.064l-.9.55a.56.56 0 0 1-.543-.016.59.59 0 0 1-.349-.42L10.273.818a.76.76 0 0 0-.194-.417.75.75 0 0 0-.396-.227 8.1 8.1 0 0 0-3.339 0 .75.75 0 0 0-.396.227.76.76 0 0 0-.194.416L5.62 1.851a.63.63 0 0 1-.369.441.6.6 0 0 1-.569.017l-.88-.538a.74.74 0 0 0-.865.065 8.2 8.2 0 0 0-1.175 1.216q-.527.668-.906 1.43a.77.77 0 0 0 .13.87l.784.826a.54.54 0 0 1 .1.484.57.57 0 0 1-.3.424l-1.082.406a.75.75 0 0 0-.359.283.77.77 0 0 0-.13.442 8.4 8.4 0 0 0 .743 3.298.75.75 0 0 0 .751.44l1.294-.122a.45.45 0 0 1 .366.19.47.47 0 0 1 .11.413l-.4 1.233a.77.77 0 0 0 .257.84 8.1 8.1 0 0 0 3.007 1.468.73.73 0 0 0 .537-.069.75.75 0 0 0 .27-.253l.76-1.174a.457.457 0 0 1 .64.013l.75 1.162a.75.75 0 0 0 .807.321 8.2 8.2 0 0 0 3.008-1.468.76.76 0 0 0 .255-.84l-.41-1.259a.46.46 0 0 1 .107-.397.41.41 0 0 1 .354-.183l1.3.122a.745.745 0 0 0 .75-.44 8.35 8.35 0 0 0 .743-3.297.77.77 0 0 0-.128-.445.75.75 0 0 0-.36-.286m-1.176 2.075q-.095.42-.24.823l-.747-.072a1.9 1.9 0 0 0-.918.161 1.95 1.95 0 0 0-.738.576 1.95 1.95 0 0 0-.37 1.834l.236.725a6 6 0 0 1-.737.42 7 7 0 0 1-.784.322l-.447-.692a1.9 1.9 0 0 0-.69-.62A1.86 1.86 0 0 0 8 12.821a1.8 1.8 0 0 0-.883.21 1.85 1.85 0 0 0-.678.612l-.455.71a6.7 6.7 0 0 1-1.522-.743l.228-.7a1.98 1.98 0 0 0-.376-1.852 1.96 1.96 0 0 0-.743-.579 1.9 1.9 0 0 0-.923-.162l-.741.071a7 7 0 0 1-.376-1.667l.563-.212c.31-.131.583-.335.8-.595a2.15 2.15 0 0 0 .427-1.906 2.14 2.14 0 0 0-.466-.887l-.4-.421a6.7 6.7 0 0 1 1.053-1.338l.405.248a2.07 2.07 0 0 0 2 .048 2.13 2.13 0 0 0 1.2-1.61l.062-.475a6.6 6.6 0 0 1 1.69 0l.065.507a2.2 2.2 0 0 0 .404.94c.206.276.474.498.782.649a2.13 2.13 0 0 0 1.966-.051l.429-.262a6.8 6.8 0 0 1 1.053 1.337l-.421.443a2.146 2.146 0 0 0-.037 2.772c.214.258.486.46.794.59l.57.215a7 7 0 0 1-.136.845Z",
		"M8 6.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5M4.75 8a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0",
	],
	back: "M10.6 2.6 5.2 8l5.4 5.4 1-1L7.2 8l4.4-4.4-1-1Z",
	close: "m3.5 2.5-1 1L7 8l-4.5 4.5 1 1L8 9l4.5 4.5 1-1L9 8l4.5-4.5-1-1L8 7 3.5 2.5Z",
	play: "M4 2.5v11l9.5-5.5L4 2.5Z",
	chevronDown: "m3 5.6 1-1 4 4 4-4 1 1-5 5-5-5Z",
	refresh:
		"M8 2.5a5.5 5.5 0 0 0-5.2 3.8l1.3.4A4.1 4.1 0 0 1 11.6 6H9.5v1.4H14V2.9h-1.4v2A5.5 5.5 0 0 0 8 2.5Zm-6 6.1v4.5h1.4v-2a5.5 5.5 0 0 0 9.8-1.4l-1.3-.4A4.1 4.1 0 0 1 4.4 10h2.1V8.6H2Z",
	warning: "M8 1.5 .8 14h14.4L8 1.5Zm0 2.8L12.8 12.6H3.2L8 4.3Zm-.7 2.9v3h1.4v-3H7.3Zm0 3.8v1.4h1.4V11H7.3Z",
	chartUp: "M1 12.5 6 7.5l3 3 4.6-4.6V8H15V3.5h-4.5v1.4h2.1L9 8.5l-3-3-6 6 1 1Z",
	chartDown: "M1 3.5 6 8.5l3-3 4.6 4.6V8H15v4.5h-4.5v-1.4h2.1L9 7.5l-3 3-6-6 1-1Z",
	check: "M13.4 3.6 6 11 2.6 7.6l-1 1L6 13l8.4-8.4-1-1Z",
	external: "M9 1.5V3h2.9L6.5 8.4l1 1L13 4v3h1.5V1.5H9ZM2 3.5v10.5c0 .3.2.5.5.5H13V9h-1.5v4h-8V5h4V3.5H2Z",
	heart:
		"M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-.605-.463L1.348 8.309A4.582 4.582 0 0 1 1.689 2zm3.158.252A3.082 3.082 0 0 0 2.49 7.337l.005.005L7.8 13.664a.264.264 0 0 0 .311.069.262.262 0 0 0 .09-.069l5.312-6.33a3.043 3.043 0 0 0 .68-2.573 3.118 3.118 0 0 0-2.551-2.463 3.079 3.079 0 0 0-2.612.816l-.007.007a1.501 1.501 0 0 1-2.045 0l-.009-.008a3.082 3.082 0 0 0-2.121-.861z",
	heartFilled:
		"M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z",
	music:
		"M13.5 1.5 5.5 3v7.4a2.3 2.3 0 1 0 1.4 2.1V6.6l5.2-1v3.8a2.3 2.3 0 1 0 1.4 2.1V1.5ZM6.9 5.2V4.1l5.2-1v1.1l-5.2 1Z",
} as const satisfies Record<string, string | readonly string[]>;

export type IconName = keyof typeof PATHS;

/** Our name -> Spicetify.SVGIcons name, where Spotify has an equivalent. */
const HOST: Partial<Record<IconName, string>> = {
	back: "chevron-left",
	close: "x",
	play: "play",
	warning: "exclamation-circle",
	chartUp: "chart-up",
	chartDown: "chart-down",
	check: "check",
	external: "external-link",
	heart: "heart",
	heartFilled: "heart-active",
};

const resolved = new Map<IconName, string[]>();

function pathsFor(name: IconName): string[] {
	let p = resolved.get(name);
	if (!p) {
		const markup = HOST[name]
			? (globalThis as { Spicetify?: { SVGIcons?: Record<string, string> } }).Spicetify?.SVGIcons?.[
					HOST[name] as string
				]
			: undefined;
		// Only filled paths: Spotify's markup also contains invisible
		// bounding boxes (fill="none") that would draw as a solid square.
		const fromHost = markup
			? [...markup.matchAll(/<path\s([^>]*)>/g)]
					.map((m) => m[1])
					.filter((attrs) => !/fill="none"/.test(attrs))
					.map((attrs) => attrs.match(/\sd="([^"]+)"|^d="([^"]+)"/))
					.map((m) => m?.[1] ?? m?.[2] ?? "")
					.filter((d) => /^[\d\sMmLlHhVvCcSsQqTtAaZz.,-]+$/.test(d))
			: [];
		const own: string | readonly string[] = PATHS[name];
		p = fromHost.length ? fromHost : typeof own === "string" ? [own] : [...own];
		resolved.set(name, p);
	}
	return p;
}

export function Icon({
	name,
	size = 16,
	label,
	flip,
}: {
	name: IconName;
	size?: number;
	label?: string;
	flip?: boolean;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="currentColor"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			focusable="false"
			style={flip ? { transform: "rotate(180deg)" } : undefined}
		>
			{pathsFor(name).map((d) => (
				<path key={d} d={d} fillRule="evenodd" />
			))}
		</svg>
	);
}
