import { describe, expect, it } from "vitest";
import { markdownLiteToHtml } from "../shared/update/markdown-lite";
import { pickBetaRelease, type ReleasePayload } from "../shared/update/release-info";
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

	it("treats a stable release as newer than its own prerelease", () => {
		expect(compareVersions("2.1.0-beta.1", "2.1.0")).toBe(true);
		expect(compareVersions("2.1.0", "2.1.0-beta.1")).toBe(false);
	});

	it("offers a newer prerelease over an older stable", () => {
		expect(compareVersions("2.0.3", "2.1.0-beta.1")).toBe(true);
	});
});

describe("pickBetaRelease", () => {
	const zip = [{ name: "listening-stats.zip" }];
	const rel = (tag: string, prerelease: boolean): ReleasePayload => ({ tag_name: tag, prerelease, assets: zip });

	it("picks the stable release when no prerelease exists", () => {
		expect(pickBetaRelease([rel("v2.0.3", false)])?.tag_name).toBe("v2.0.3");
	});

	it("picks the prerelease only when strictly newer than stable", () => {
		expect(pickBetaRelease([rel("v2.1.0-beta.1", true), rel("v2.0.3", false)])?.tag_name).toBe("v2.1.0-beta.1");
	});

	it("prefers stable over an older or same-version prerelease", () => {
		expect(pickBetaRelease([rel("v2.1.0", false), rel("v2.1.0-beta.1", true)])?.tag_name).toBe("v2.1.0");
		expect(pickBetaRelease([rel("v2.2.0", false), rel("v2.1.0-beta.9", true)])?.tag_name).toBe("v2.2.0");
	});

	it("falls back to a prerelease when no stable release exists", () => {
		expect(pickBetaRelease([rel("v0.9.0-rc.1", true)])?.tag_name).toBe("v0.9.0-rc.1");
	});

	it("ignores releases without the zip asset", () => {
		const noZip: ReleasePayload = { tag_name: "v9.9.9", prerelease: true, assets: [] };
		expect(pickBetaRelease([noZip, rel("v2.0.3", false)])?.tag_name).toBe("v2.0.3");
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
