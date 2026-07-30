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
		it("getActiveBanner returns config when version has active banner and not dismissed", async () => {
			const { getActiveBanner } = await import("../app/banners");
			const banner = getActiveBanner("2.6");
			expect(banner).not.toBeNull();
			expect(banner?.title).toBeTruthy();
			expect(banner?.body).toBeTruthy();
		});

		it("getActiveBanner returns null when version has no configured banner", async () => {
			const { getActiveBanner } = await import("../app/banners");
			const banner = getActiveBanner("0.0.0-unknown");
			expect(banner).toBeNull();
		});

		it("getActiveBanner returns null when current version was already dismissed", async () => {
			localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, "2.6");
			const { getActiveBanner } = await import("../app/banners");
			const banner = getActiveBanner("2.6");
			expect(banner).toBeNull();
		});

		it("getActiveBanner returns config when a different version was dismissed", async () => {
			localStorage.setItem(LS_KEYS.DISMISSED_BANNER_VERSION, "2.5");
			const { getActiveBanner } = await import("../app/banners");
			const banner = getActiveBanner("2.6");
			expect(banner).not.toBeNull();
		});

		it("dismissBanner persists version to localStorage", async () => {
			const { dismissBanner } = await import("../app/banners");
			dismissBanner("2.6");
			expect(localStorage.getItem(LS_KEYS.DISMISSED_BANNER_VERSION)).toBe("2.6");
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
			const { getActiveBanner } = await import("../app/banners");
			const banner = getActiveBanner("0.0.0");
			expect(banner).toBeNull();
		});

		it("dismissing banner hides it on re-query for same version", async () => {
			const { getActiveBanner, dismissBanner } = await import("../app/banners");
			expect(getActiveBanner("2.6")).not.toBeNull();
			dismissBanner("2.6");
			expect(getActiveBanner("2.6")).toBeNull();
		});
	});
});
