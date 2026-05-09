import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("PlayCountPill", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders null when count <= 1", async () => {
		const { PlayCountPill } = await import("../app/components/PlayCountPill");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(PlayCountPill, {
				count: 1,
				variant: "pill",
				firstPlayedAt: null,
			}),
			container,
		);
		expect(container.innerHTML).toBe("");
	});

	it("renders null when count is 0", async () => {
		const { PlayCountPill } = await import("../app/components/PlayCountPill");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(PlayCountPill, {
				count: 0,
				variant: "pill",
				firstPlayedAt: null,
			}),
			container,
		);
		expect(container.innerHTML).toBe("");
	});

	describe("pill variant (default)", () => {
		it("renders with play-count-pill class and correct text", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "pill",
					firstPlayedAt: null,
				}),
				container,
			);
			const pill = container.querySelector(".play-count-pill");
			expect(pill).not.toBeNull();
			expect(pill?.textContent).toContain("14 plays");
		});

		it("renders dot indicator", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 5,
					variant: "pill",
					firstPlayedAt: null,
				}),
				container,
			);
			const dot = container.querySelector(".play-count-dot");
			expect(dot).not.toBeNull();
		});

		it("shows tooltip with play count and first-play date", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			const firstPlayed = new Date("2026-03-12T10:00:00Z").getTime();
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "pill",
					firstPlayedAt: firstPlayed,
				}),
				container,
			);
			const pill = container.querySelector(".play-count-pill");
			expect(pill?.getAttribute("title")).toMatch(/Played 14 times/);
			expect(pill?.getAttribute("title")).toMatch(/first on/);
		});

		it("shows tooltip without date when firstPlayedAt is null", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 7,
					variant: "pill",
					firstPlayedAt: null,
				}),
				container,
			);
			const pill = container.querySelector(".play-count-pill");
			expect(pill?.getAttribute("title")).toBe("Played 7 times");
		});
	});

	describe("bubble variant", () => {
		it("renders with play-count-bubble class", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "bubble",
					firstPlayedAt: null,
				}),
				container,
			);
			const bubble = container.querySelector(".play-count-bubble");
			expect(bubble).not.toBeNull();
		});

		it("renders count in badge", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "bubble",
					firstPlayedAt: null,
				}),
				container,
			);
			const badge = container.querySelector(".play-count-badge");
			expect(badge).not.toBeNull();
			expect(badge?.textContent).toBe("14");
		});

		it("renders play triangle icon", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "bubble",
					firstPlayedAt: null,
				}),
				container,
			);
			const icon = container.querySelector(".play-count-bubble-icon");
			expect(icon).not.toBeNull();
			expect(icon?.textContent).toBe("\u{25B6}");
		});
	});

	describe("minimal variant", () => {
		it("renders with play-count-minimal class", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "minimal",
					firstPlayedAt: null,
				}),
				container,
			);
			const minimal = container.querySelector(".play-count-minimal");
			expect(minimal).not.toBeNull();
		});

		it("renders ×count format", async () => {
			const { PlayCountPill } = await import("../app/components/PlayCountPill");
			Spicetify.ReactDOM.render(
				Spicetify.React.createElement(PlayCountPill, {
					count: 14,
					variant: "minimal",
					firstPlayedAt: null,
				}),
				container,
			);
			const minimal = container.querySelector(".play-count-minimal");
			expect(minimal?.textContent).toBe("×14");
		});
	});
});
