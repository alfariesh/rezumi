import { describe, expect, it } from "vite-plus/test";
import { ownPictureUrl } from "./own-picture";

const origins = ["https://rezumi.example", "https://rx.example"];

describe("ownPictureUrl", () => {
	it("keeps this app's uploads on its own origin and its alias", () => {
		expect(ownPictureUrl("/uploads/user-1/pictures/a.webp", origins)).toBe(
			"https://rezumi.example/uploads/user-1/pictures/a.webp",
		);
		expect(ownPictureUrl("/api/uploads/user-1/pictures/portfolio/b-sm.jpg", origins)).toBe(
			"https://rezumi.example/api/uploads/user-1/pictures/portfolio/b-sm.jpg",
		);
		expect(ownPictureUrl("https://rx.example/uploads/user-1/pictures/c.png", origins)).toBe(
			"https://rx.example/uploads/user-1/pictures/c.png",
		);
	});

	it("refuses pictures elsewhere, private files and addresses carrying more than a path", () => {
		for (const source of [
			"https://elsewhere.example/uploads/user-1/pictures/a.webp",
			"/uploads/user-1/documents/portfolio/a.pdf",
			"/uploads/user-1/pictures/a.svg",
			"/uploads/user-1/pictures/a.webp?x=1",
			"/uploads/user-1/pictures/a.webp#x",
			"https://user:pass@rezumi.example/uploads/user-1/pictures/a.webp",
			"/uploads/user-1/pictures/../../secret.webp",
			"javascript:alert(1)",
			"",
		])
			expect(ownPictureUrl(source, origins), source).toBeUndefined();
		expect(ownPictureUrl("/uploads/user-1/pictures/a.webp", [])).toBeUndefined();
	});
});
