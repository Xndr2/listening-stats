import esbuild from "esbuild";
import { globalExternals } from "@fal-works/esbuild-plugin-global-externals";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const reactGlobals = {
	react: {
		varName: "Spicetify.React",
		namedExports: [
			"useState",
			"useEffect",
			"useRef",
			"useCallback",
			"useMemo",
			"useContext",
			"createContext",
			"memo",
			"forwardRef",
			"Fragment",
			"StrictMode",
		],
		type: "esm",
	},
	"react-dom": {
		varName: "Spicetify.ReactDOM",
		namedExports: [
			"render",
			"createPortal",
			"unmountComponentAtNode",
		],
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
	minify: isProduction,
	sourcemap: !isProduction,
	loader: { ".css": "text" },
};

const extConfig = {
	...sharedOptions,
	entryPoints: ["src/extension/index.ts"],
	outfile: "dist/extension.js",
};

const appConfig = {
	...sharedOptions,
	entryPoints: ["src/app/index.tsx"],
	outfile: "dist/index.js",
	globalName: "ListeningStatsApp",
	footer: {
		js: "var { render, unmount } = ListeningStatsApp;",
	},
};

function copyManifestToDist() {
	mkdirSync("dist", { recursive: true });
	copyFileSync("manifest.json", "dist/manifest.json");
}

if (process.argv.includes("--watch")) {
	const shouldDeploy = process.argv.includes("--deploy");

	let deployFn;
	if (shouldDeploy) {
		const { execSync } = await import("node:child_process");

		deployFn = () => {
			try {
				execSync("npm run deploy:files", { stdio: "inherit" });
				execSync("spicetify apply", { stdio: "inherit" });
				console.log("Deploy complete.");
			} catch {
				console.error("Deploy failed - is Spicetify CLI in PATH?");
			}
		};
		console.log("Deploy mode: will copy + apply after each rebuild.");
	}

	const rebuildPlugin = {
		name: "rebuild-notify",
		setup(build) {
			build.onEnd((result) => {
				if (result.errors.length === 0) {
					console.log(`Rebuilt at ${new Date().toLocaleTimeString()}`);
					if (shouldDeploy && deployFn) {
						deployFn();
					}
				}
			});
		},
	};

	const watchExtConfig = { ...extConfig, plugins: [...extConfig.plugins, rebuildPlugin] };
	const watchAppConfig = { ...appConfig, plugins: [...appConfig.plugins, rebuildPlugin] };

	const [extCtx, appCtx] = await Promise.all([
		esbuild.context(watchExtConfig),
		esbuild.context(watchAppConfig),
	]);
	copyManifestToDist();
	await Promise.all([extCtx.watch(), appCtx.watch()]);
	console.log(`Watching for changes...${shouldDeploy ? " (deploy mode)" : ""}`);
} else {
	await Promise.all([esbuild.build(extConfig), esbuild.build(appConfig)]);
	copyManifestToDist();
	console.log(`Built v${pkg.version} (${isProduction ? "production" : "development"})`);
}
