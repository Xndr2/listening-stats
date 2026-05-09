import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
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
