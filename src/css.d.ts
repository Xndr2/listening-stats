// App bundle: `import "./x.css"` is a side-effect import; esbuild collects all of
// them into dist/style.css. Extension bundle: .css is loaded as a string instead
// (build.mjs), so `import css from "./x.css"` gives the file contents there.
declare module "*.css" {
	const content: string;
	export default content;
}
