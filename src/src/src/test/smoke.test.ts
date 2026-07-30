import { describe, expect, it } from "vitest";

describe("Spicetify stub smoke test", () => {
	it("Spicetify global is defined", () => {
		expect(Spicetify).toBeDefined();
	});

	it("Spicetify.React is the React instance", () => {
		expect(Spicetify.React.useState).toBeTypeOf("function");
	});

	it("Spicetify.Player has addEventListener", () => {
		expect(Spicetify.Player.addEventListener).toBeTypeOf("function");
	});
});
