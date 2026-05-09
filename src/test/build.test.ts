import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

describe("build output", () => {
	beforeAll(() => {
		execSync("node build.mjs", { stdio: "inherit" });
	});

	it("produces dist/extension.js", () => {
		expect(existsSync("dist/extension.js")).toBe(true);
	});

	it("produces dist/index.js", () => {
		expect(existsSync("dist/index.js")).toBe(true);
	});

	it("extension.js is IIFE format", () => {
		const content = readFileSync("dist/extension.js", "utf-8");
		// IIFE starts with (() => { or (function(  -  may be preceded by "use strict"; banner
		expect(content.trim()).toMatch(/^("use strict";\s*)?\(/);
	});

	it("index.js wraps in ListeningStatsApp global", () => {
		const content = readFileSync("dist/index.js", "utf-8");
		expect(content).toContain("ListeningStatsApp");
	});

	it("index.js does not contain bundled React source", () => {
		const content = readFileSync("dist/index.js", "utf-8");
		expect(content).not.toContain("__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED");
	});

	it("index.js references Spicetify.React not require(react)", () => {
		const content = readFileSync("dist/index.js", "utf-8");
		expect(content).not.toContain('require("react")');
		expect(content).not.toContain("require('react')");
	});

	it("index.js contains version string", () => {
		const content = readFileSync("dist/index.js", "utf-8");
		const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
		expect(content).toContain(pkg.version);
	});

	it("build.mjs --watch --deploy flag is parseable (syntax check)", () => {
		// Verify the script doesn't have syntax errors with the new flags
		// We can't test actual watch+deploy behavior in CI, but we can verify
		// the script parses without error
		const result = execSync("node --check build.mjs", { encoding: "utf-8" });
		// node --check exits 0 if syntax is valid
		expect(result).toBeDefined();
	});
});
