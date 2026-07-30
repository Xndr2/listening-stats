import { describe, expect, it } from "vitest";
import { parseAnnouncementMarkdown } from "../shared/announcements/remote-announcement";

describe("parseAnnouncementMarkdown", () => {
	it("parses UPDATE line with id pipe  -  Changelog action opens in-app modal", () => {
		const r = parseAnnouncementMarkdown("UPDATE hotfix-1|We fixed the crash.\n\nMore detail.");
		expect(r?.dismissId).toBe("hotfix-1");
		expect(r?.title).toBe("We fixed the crash.");
		expect(r?.body).toContain("More detail.");
		expect(r?.actionLabel).toBe("Changelog");
		expect(r?.actionUrl).toContain("/releases");
		expect(r?.actionOpensChangelog).toBe(true);
	});

	it("parses UPDATE without pipe using stable dismiss id", () => {
		const r = parseAnnouncementMarkdown("UPDATE Rollout banner text\n\nExtra.");
		expect(r?.dismissId.length).toBeGreaterThan(0);
		expect(r?.title).toBe("Rollout banner text");
		expect(r?.body).toContain("Extra.");
	});

	it("parses markdown title line", () => {
		const r = parseAnnouncementMarkdown("# Heads up\n\nWe are testing.");
		expect(r?.title).toBe("Heads up");
		expect(r?.body).toBe("We are testing.");
	});

	it("returns null for empty file", () => {
		expect(parseAnnouncementMarkdown("   \n")).toBeNull();
	});
});
