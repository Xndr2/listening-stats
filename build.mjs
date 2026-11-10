import { execSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { globalExternals } from "@fal-works/esbuild-plugin-global-externals";
import esbuild from "esbuild";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const APP_ID = "listening-stats";

/**
 * Spotify already ships React; a custom app must reuse it via Spicetify.React /
 * Spicetify.ReactDOM instead of bundling its own copy (two Reacts = broken hooks).
 * Every `import { x } from "react"` in src/ is rewritten to `Spicetify.React.x`.
 *
 * NOTE: a named import that is not listed here fails the build with
 * "No matching export" - add it to the list.
 */
const reactGlobals = {
	react: {
		varName: "Spicetify.React",
		namedExports: [
			"useState",
			"useEffect",
			"useLayoutEffect",
			"useRef",
			"useCallback",
			"useMemo",
			"useContext",
			"useReducer",
			"useId",
			"useSyncExternalStore",
			"useTransition",
			"useDeferredValue",
			"useImperativeHandle",
			"createContext",
			"memo",
			"forwardRef",
			"Fragment",
			"StrictMode",
			"Component",
			"createElement",
		],
		type: "esm",
	},
	"react-dom": {
		varName: "Spicetify.ReactDOM",
		namedExports: ["render", "createPortal", "unmountComponentAtNode", "flushSync", "createRoot"],
		defaultExport: false,
		type: "esm",
	},
};

const isProduction = process.env.NODE_ENV === "production";

const sharedOptions = {
	bundle: true,
	format: "iife",
	target: ["chrome96"],
	plugins: [globalExternals(reactGlobals)],
	define: {
		"process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
		__VERSION__: JSON.stringify(pkg.version),
	},
	// Names stay readable so crash reports from real users point at real functions.
	minifyWhitespace: isProduction,
	minifySyntax: isProduction,
	sourcemap: !isProduction,
};

/**
 * extension.js is evaluated before Spotify has set Spicetify.React, so a
 * module-level `import { useState } from "react"` (which becomes a top-level
 * destructure of Spicetify.React) crashes the whole extension, tracker
 * included. Fail the build instead; components read Spicetify.React at render.
 */
const noReactInExtension = {
	name: "no-react-in-extension",
	setup(build) {
		build.onResolve({ filter: /^react(-dom)?$/ }, (args) => ({
			errors: [
				{
					text: `extension bundle imports "${args.path}" (from ${args.importer}). Read Spicetify.React at render time instead.`,
				},
			],
		}));
	},
};

// extension.js: runs at Spotify startup, in the background, even when the app page is closed.
const extConfig = {
	...sharedOptions,
	plugins: [noReactInExtension],
	entryPoints: ["src/extension/index.ts"],
	outfile: "dist/extension.js",
	// Spicetify only auto-injects the app's style.css, so if the extension ever
	// needs CSS (e.g. a playbar widget) it imports it as a string and injects it.
	loader: { ".css": "text" },
};

/**
 * Every `import "./x.css"` under src/app/ is collected by esbuild, in import
 * order, into one stylesheet next to index.js. esbuild names it index.css;
 * Spicetify expects style.css (it becomes spicetify-routes-<app>.css in Spotify
 * and is injected automatically), so rename after each build.
 */
const cssOutName = {
	name: "css-out-name",
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length !== 0) return;
			for (const [from, to] of [
				["dist/index.css", "dist/style.css"],
				["dist/index.css.map", "dist/style.css.map"],
			]) {
				if (existsSync(from)) renameSync(from, to);
			}
		});
	},
};

// index.js: the custom app page. Spicetify calls the global `render()` when the user opens it.
const appConfig = {
	...sharedOptions,
	entryPoints: ["src/app/index.tsx"],
	outfile: "dist/index.js",
	globalName: "ListeningStatsApp",
	footer: {
		js: "var { render, unmount } = ListeningStatsApp;",
	},
	plugins: [...sharedOptions.plugins, cssOutName],
};

/** Files that make up the installable app - keep in sync with the release zip. */
const DIST_FILES = ["index.js", "style.css", "extension.js", "manifest.json"];

function copyManifestToDist() {
	mkdirSync("dist", { recursive: true });
	copyFileSync("manifest.json", "dist/manifest.json");
}

/** Spicetify's config dir (holds CustomApps/). Asks the CLI, falls back to the Linux default. */
function spicetifyUserdataDir() {
	try {
		return execSync("spicetify path userdata", { encoding: "utf-8" }).trim();
	} catch {
		return join(homedir(), ".config", "spicetify");
	}
}

/** Copy the built files into CustomApps/<app>. Does NOT run `spicetify apply`. */
function copyToCustomApps() {
	const dest = join(spicetifyUserdataDir(), "CustomApps", APP_ID);
	mkdirSync(dest, { recursive: true });
	for (const f of DIST_FILES) {
		copyFileSync(join("dist", f), join(dest, f));
	}
	return dest;
}

if (process.argv.includes("--copy-only")) {
	console.log(`Copied dist -> ${copyToCustomApps()}`);
	process.exit(0);
}

if (process.argv.includes("--watch")) {
	const shouldDeploy = process.argv.includes("--deploy"); // copy + full `spicetify apply` (restarts Spotify)
	const shouldLive = process.argv.includes("--live"); // copy + let `spicetify watch -a -l` hot-reload the page
	const shouldCopy = shouldDeploy || shouldLive || process.argv.includes("--copy");

	let deployFn;
	if (shouldDeploy) {
		deployFn = () => {
			try {
				copyToCustomApps();
				execSync("spicetify apply", { stdio: "inherit" });
				console.log("Deploy complete.");
			} catch {
				console.error("Deploy failed - is Spicetify CLI in PATH?");
			}
		};
		console.log("Deploy mode: will copy + apply after each rebuild.");
	} else if (shouldCopy) {
		deployFn = () => {
			try {
				console.log(`Copied -> ${copyToCustomApps()}`);
			} catch (err) {
				console.error("Copy failed:", err.message);
			}
		};
	}

	if (shouldLive) {
		// `spicetify watch -a` restarts Spotify ONCE with the remote debugger on (if
		// it isn't already), then on every change to CustomApps/<app> it copies the
		// files into Spotify and triggers a page reload over the DevTools protocol -
		// no process restart. Do NOT add `-l`: in spicetify 2.45 it means "watch
		// theme + extensions + apps", and with no extensions configured the whole
		// watcher exits with "No extension to watch".
		const sp = spawn("spicetify", ["watch", "-a"], { stdio: "inherit" });
		sp.on("error", () => console.error("Could not start `spicetify watch` - is Spicetify CLI in PATH?"));
		sp.on("exit", (code) => {
			if (code !== null && code !== 0) {
				console.error(`spicetify watch exited with code ${code} - saves will NOT reach Spotify. Fix and restart pnpm dev.`);
			}
		});
		const stop = () => {
			sp.kill();
			process.exit(0);
		};
		process.on("SIGINT", stop);
		process.on("SIGTERM", stop);
		console.log("Live mode: saves hot-reload the Spotify page via `spicetify watch -a`.");
	}

	// Both bundles rebuild independently; debounce so one save = one deploy.
	let deployTimer;
	const rebuildPlugin = {
		name: "rebuild-notify",
		setup(build) {
			build.onEnd((result) => {
				if (result.errors.length !== 0) return;
				console.log(`Rebuilt at ${new Date().toLocaleTimeString()}`);
				if (deployFn) {
					clearTimeout(deployTimer);
					deployTimer = setTimeout(deployFn, 150);
				}
			});
		},
	};

	const [extCtx, appCtx] = await Promise.all([
		esbuild.context({ ...extConfig, plugins: [...extConfig.plugins, rebuildPlugin] }),
		esbuild.context({ ...appConfig, plugins: [...appConfig.plugins, rebuildPlugin] }),
	]);
	copyManifestToDist();
	await Promise.all([extCtx.watch(), appCtx.watch()]);
	// Initial build is done: sync once so live/copy mode starts from the current source.
	if (deployFn && !shouldDeploy) deployFn();
	console.log(`Watching for changes...${shouldDeploy ? " (deploy mode)" : shouldLive ? " (live mode)" : ""}`);
} else {
	await Promise.all([esbuild.build(extConfig), esbuild.build(appConfig)]);
	copyManifestToDist();
	console.log(`Built v${pkg.version} (${isProduction ? "production" : "development"})`);
}
