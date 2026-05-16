import { describe, expect, it } from "vitest";
import { markdownLiteToHtml } from "../shared/update/markdown-lite";
import { compareVersions } from "../shared/update/update-check";

describe("compareVersions", () => {
	it("returns true when remote semver is greater", () => {
		expect(compareVersions("1.0.0", "1.0.1")).toBe(true);
		expect(compareVersions("2.5.0", "2.6.0")).toBe(true);
	});

	it("returns false when equal or remote is older", () => {
		expect(compareVersions("1.0.0", "1.0.0")).toBe(false);
		expect(compareVersions("2.0.0", "1.9.9")).toBe(false);
	});

	it("coerces v-prefixed tags", () => {
		expect(compareVersions("1.0.0", "v1.1.0")).toBe(true);
	});
});

describe("markdownLiteToHtml", () => {
	it("renders headings, bold, links, and code", () => {
		const html = markdownLiteToHtml("## Title\n\nHello **world** and `code` and [a](https://ex.test).");
		expect(html).toContain("<h3>");
		expect(html).toContain("Title");
		expect(html).toContain("<strong>world</strong>");
		expect(html).toContain("<code>code</code>");
		expect(html).toContain('href="https://ex.test"');
	});

	it("escapes raw HTML in source", () => {
		const html = markdownLiteToHtml("<script>x</script>");
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});
