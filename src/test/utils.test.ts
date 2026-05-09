import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigateToUri, downloadFile } from "../app/utils";

describe("navigateToUri", () => {
	beforeEach(() => {
		vi.mocked(Spicetify.Platform.History.push).mockClear();
	});

	it("calls History.push with '/track/abc123' for 'spotify:track:abc123'", () => {
		navigateToUri("spotify:track:abc123");
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith("/track/abc123");
	});

	it("calls History.push with '/artist/xyz' for 'spotify:artist:xyz'", () => {
		navigateToUri("spotify:artist:xyz");
		expect(Spicetify.Platform.History.push).toHaveBeenCalledWith("/artist/xyz");
	});

	it("does nothing for URIs with fewer than 3 parts", () => {
		navigateToUri("spotify:track");
		expect(Spicetify.Platform.History.push).not.toHaveBeenCalled();
	});
});

describe("downloadFile", () => {
	it("creates a link element and clicks it", () => {
		const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:url");
		const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const clickSpy = vi.fn();
		const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
			href: "",
			download: "",
			click: clickSpy,
		} as unknown as HTMLAnchorElement);

		downloadFile("content", "test.json", "application/json");

		expect(createObjectURLSpy).toHaveBeenCalled();
		expect(clickSpy).toHaveBeenCalled();
		expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:url");

		createObjectURLSpy.mockRestore();
		revokeObjectURLSpy.mockRestore();
		createElementSpy.mockRestore();
	});
});
