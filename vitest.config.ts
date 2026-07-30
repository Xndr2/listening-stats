import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		// src/src/ is a stale WIP backup (commit d860a99) — never run its test copies
		exclude: ["**/node_modules/**", "src/src/**"],
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		coverage: {
			provider: "v8",
			exclude: ["**/node_modules/**", "**/dist/**"],
		},
		css: false, // skip CSS processing — CSS imported as text, not modules
	},
});
