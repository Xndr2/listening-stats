import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("GenreChips component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders nothing when genres is undefined", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, { genres: undefined }),
			container,
		);
		expect(container.innerHTML).toBe("");
	});

	it("renders nothing when genres is empty array", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(GenreChips, { genres: [] }), container);
		expect(container.innerHTML).toBe("");
	});

	it("does NOT emit .genre-chips wrapper when genres is undefined", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, { genres: undefined }),
			container,
		);
		expect(container.querySelector(".genre-chips")).toBeNull();
	});

	it("does NOT emit .genre-chips wrapper when genres is empty []", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(Spicetify.React.createElement(GenreChips, { genres: [] }), container);
		expect(container.querySelector(".genre-chips")).toBeNull();
	});

	it("renders exactly 1 .genre-chip for single-genre array", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, { genres: ["pop"] }),
			container,
		);
		const chips = container.querySelectorAll(".genre-chip");
		expect(chips.length).toBe(1);
		expect(chips[0]?.textContent).toBe("pop");
	});

	it("renders exactly 3 .genre-chip for 3-genre array", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["rock", "pop", "jazz"],
			}),
			container,
		);
		const chips = container.querySelectorAll(".genre-chip");
		expect(chips.length).toBe(3);
	});

	it("caps at 3 .genre-chip when given 5 genres", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["a", "b", "c", "d", "e"],
			}),
			container,
		);
		expect(container.querySelectorAll(".genre-chip").length).toBe(3);
	});

	it("caps at 3 and drops silently  -  no '+N more' chip, no ellipsis", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["a", "b", "c", "d", "e"],
			}),
			container,
		);
		const text = container.textContent ?? "";
		expect(text.includes("+")).toBe(false);
		expect(text.includes("…")).toBe(false);
		expect(text.toLowerCase().includes("more")).toBe(false);
	});

	it("renders genres verbatim  -  no case transform", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["Indie Pop", "hip hop"],
			}),
			container,
		);
		const chips = container.querySelectorAll(".genre-chip");
		expect(chips[0]?.textContent).toBe("Indie Pop");
		expect(chips[1]?.textContent).toBe("hip hop");
	});

	it("renders .genre-chips wrapper as a sibling div when chips exist", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, { genres: ["pop"] }),
			container,
		);
		expect(container.querySelector(".genre-chips")).not.toBeNull();
	});

	it("respects custom max prop (max=2 keeps two chips)", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["a", "b", "c", "d"],
				max: 2,
			}),
			container,
		);
		expect(container.querySelectorAll(".genre-chip").length).toBe(2);
	});

	it("renders chips with className 'genre-chip' (no inline style attribute)", async () => {
		const { GenreChips } = await import("../app/components/GenreChips");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(GenreChips, {
				genres: ["rock", "pop"],
			}),
			container,
		);
		const chips = container.querySelectorAll<HTMLElement>(".genre-chip");
		for (const chip of chips) {
			expect(chip.className).toBe("genre-chip");
			const styleAttr = chip.getAttribute("style");
			// Inline style attribute must be absent or empty (CHIP-05: styling via class, not inline)
			expect(styleAttr === null || styleAttr === "").toBe(true);
		}
	});
});
