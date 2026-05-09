import { afterEach, beforeEach, describe, expect, it } from "vitest";

const mockGenres = [
	{ rank: 1, genre: "pop", count: 200 },
	{ rank: 2, genre: "rock", count: 100 },
	{ rank: 3, genre: "jazz", count: 50 },
];

const manyGenres = Array.from({ length: 15 }, (_, i) => ({
	rank: i + 1,
	genre: `genre-${i + 1}`,
	count: 200 - i * 10,
}));

describe("TopGenres component", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		Spicetify.ReactDOM.unmountComponentAtNode(container);
		document.body.removeChild(container);
	});

	it("renders .section-card wrapper with 'Top Genres' heading when topGenres has items", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const card = container.querySelector(".section-card");
		expect(card).not.toBeNull();
		expect(card?.textContent).toContain("Top Genres");
	});

	it("renders kicker 'Composition' and title 'Top Genres'", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const kicker = container.querySelector(".section-kicker");
		expect(kicker?.textContent).toBe("Composition");
		const title = container.querySelector(".section-title");
		expect(title?.textContent).toBe("Top Genres");
	});

	it("renders nothing (null) when topGenres is empty array", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: [] }),
			container,
		);
		expect(container.innerHTML).toBe("");
	});

	it("renders max 6 .top-genres-row elements (design spec)", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: manyGenres }),
			container,
		);
		const rows = container.querySelectorAll(".top-genres-row");
		expect(rows.length).toBe(6);
	});

	it("first genre bar has .peak class", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const bars = container.querySelectorAll(".top-genres-bar");
		expect(bars[0]?.classList.contains("peak")).toBe(true);
	});

	it("non-first genre bars do NOT have .peak class", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const bars = container.querySelectorAll(".top-genres-bar");
		expect(bars[1]?.classList.contains("peak")).toBe(false);
		expect(bars[2]?.classList.contains("peak")).toBe(false);
	});

	it("bar width of rank-1 genre is '100%'", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const bars = container.querySelectorAll<HTMLElement>(".top-genres-bar");
		expect(bars[0]?.style.width).toBe("100%");
	});

	it("bar width proportional  -  genre with half the count of max gets '50%' width", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const bars = container.querySelectorAll<HTMLElement>(".top-genres-bar");
		expect(bars[1]?.style.width).toBe("50%");
	});

	it("genre name displayed in .top-genres-name button, percentage in .top-genres-pct", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, { topGenres: mockGenres }),
			container,
		);
		const names = container.querySelectorAll(".top-genres-name");
		const pcts = container.querySelectorAll(".top-genres-pct");
		expect(names[0]?.textContent).toBe("pop");
		expect(pcts[0]?.textContent).toBe("57%");
	});

	it("genre name button is clickable and calls onGenreClick", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		let clicked = "";
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, {
				topGenres: mockGenres,
				onGenreClick: (g: string) => {
					clicked = g;
				},
				activeGenre: null,
			}),
			container,
		);
		const nameBtn = container.querySelector(".top-genres-name") as HTMLButtonElement;
		nameBtn?.click();
		expect(clicked).toBe("pop");
	});

	it("active genre name has .top-genres-name--active class", async () => {
		const { TopGenres } = await import("../app/components/TopGenres");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(TopGenres, {
				topGenres: mockGenres,
				onGenreClick: () => {},
				activeGenre: "pop",
			}),
			container,
		);
		const names = container.querySelectorAll(".top-genres-name");
		expect(names[0]?.classList.contains("top-genres-name--active")).toBe(true);
		expect(names[1]?.classList.contains("top-genres-name--active")).toBe(false);
	});
});
