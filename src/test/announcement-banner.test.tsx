import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LS_KEYS } from "../shared/constants/storage-keys";

describe("AnnouncementBanner", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		localStorage.clear();
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
		localStorage.clear();
	});

	describe("banners.ts  -  config and gating logic", () => {
		it("resolveAnnouncementBanner returns local banner when configured and not dismissed", async () => {
			const { resolveAnnouncementBanner } = await import("../app/banners");
			const banner = resolveAnnouncementBanner("2.6", null);
			expect(banner).not.toBeNull();
			expect(banner?.source).toBe("local");
			expect(banner?.title).toBeTruthy();
			expect(banner?.body).toBeTruthy();
		});

		it("returns null when version has no configured banner", async () => {
			const { resolveAnnouncementBanner } = await import("../app/banners");
			expect(resolveAnnouncementBanner("0.0.0-unknown", null)).toBeNull();
		});

		it("returns null when current version was already dismissed", async () => {
			localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, "2.6");
			const { resolveAnnouncementBanner } = await import("../app/banners");
			expect(resolveAnnouncementBanner("2.6", null)).toBeNull();
		});

		it("returns local banner when a different version was dismissed", async () => {
			localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, "2.5");
			const { resolveAnnouncementBanner } = await import("../app/banners");
			expect(resolveAnnouncementBanner("2.6", null)).not.toBeNull();
		});
	});

	describe("AnnouncementBanner component  -  rendering", () => {
		it("renders banner with title, body, action link, and dismiss button", async () => {
			const { AnnouncementBanner } = await import("../app/components/AnnouncementBanner");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(AnnouncementBanner, {
					title: "v2.6 is here",
					body: "section streaming, share cards.",
					actionLabel: "What's new →",
					onDismiss: vi.fn(),
				}),
				container,
			);
			const banner = container.querySelector(".announcement-banner");
			expect(banner).not.toBeNull();
			expect(banner?.textContent).toContain("v2.6 is here");
			expect(banner?.textContent).toContain("section streaming, share cards.");
			expect(banner?.textContent).toContain("What's new →");
		});

		it("calls onDismiss when dismiss button is clicked", async () => {
			const { AnnouncementBanner } = await import("../app/components/AnnouncementBanner");
			const onDismiss = vi.fn();
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(AnnouncementBanner, {
					title: "v2.6 is here",
					body: "updates.",
					actionLabel: "What's new →",
					onDismiss,
				}),
				container,
			);
			const dismissBtn = container.querySelector(".announcement-banner-dismiss") as HTMLButtonElement;
			expect(dismissBtn).not.toBeNull();
			dismissBtn.click();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it("renders action link only when actionLabel is provided", async () => {
			const { AnnouncementBanner } = await import("../app/components/AnnouncementBanner");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(AnnouncementBanner, {
					title: "Update",
					body: "details.",
					onDismiss: vi.fn(),
				}),
				container,
			);
			const link = container.querySelector(".announcement-banner-link");
			expect(link).toBeNull();
		});

		it("titleOnly hides body text in the banner row (UPDATE-style)", async () => {
			const { AnnouncementBanner } = await import("../app/components/AnnouncementBanner");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(AnnouncementBanner, {
					title: "Version 9 is live",
					body: "This extra copy should not appear in the row.",
					titleOnly: true,
					actionLabel: "Changelog",
					onActionClick: vi.fn(),
					onDismiss: vi.fn(),
				}),
				container,
			);
			const text = container.querySelector(".announcement-banner-text");
			expect(text).not.toBeNull();
			expect(text?.textContent).toContain("Version 9 is live");
			expect(text?.textContent).not.toContain("This extra copy should not appear");
		});
	});

	describe("Integration  -  version-gated display in App", () => {
		it("does not render banner when no active banner for current version", async () => {
			const { resolveAnnouncementBanner } = await import("../app/banners");
			expect(resolveAnnouncementBanner("0.0.0", null)).toBeNull();
		});

		it("dismissing banner hides it on re-query for same version", async () => {
			const { resolveAnnouncementBanner } = await import("../app/banners");
			expect(resolveAnnouncementBanner("2.6", null)).not.toBeNull();
			localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, "2.6");
			expect(resolveAnnouncementBanner("2.6", null)).toBeNull();
		});
	});
});
