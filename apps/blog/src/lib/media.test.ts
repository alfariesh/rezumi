import { describe, expect, it } from "vite-plus/test";
import { imageUrl } from "./media";

describe("imageUrl", () => {
	it("serves uploaded media through EmDash's media route", () => {
		expect(imageUrl({ id: "01ABC", meta: { storageKey: "01ABC.jpg" } })).toBe(
			"https://blog.rezumi.app/_emdash/api/media/file/01ABC.jpg",
		);
		expect(imageUrl({ id: "01ABC" })).toBe("https://blog.rezumi.app/_emdash/api/media/file/01ABC");
	});

	it("keeps external images and resolves relative sources", () => {
		expect(imageUrl({ id: "", src: "https://images.example.com/a.png" })).toBe("https://images.example.com/a.png");
		expect(imageUrl({ src: "/og/en.png" })).toBe("https://blog.rezumi.app/og/en.png");
		expect(imageUrl(null)).toBeUndefined();
	});
});
