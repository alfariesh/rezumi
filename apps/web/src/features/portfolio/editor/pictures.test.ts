import { describe, expect, it } from "vite-plus/test";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { ownPictureUrl } from "@rezumi/utils/own-picture";
import { ownFileUrl, withOwnPicture } from "./pictures";

const app = "https://rezumi.app";
const alias = "https://rx.cv";
const origins = [app, alias];

describe("pictures the preview shows", () => {
	it("are this app's own uploads, on its address or its alias", () => {
		expect(ownPictureUrl("/uploads/u1/pictures/portfolio/a-1.webp", origins)).toBe(
			`${app}/uploads/u1/pictures/portfolio/a-1.webp`,
		);
		expect(ownPictureUrl(`${app}/uploads/u1/pictures/photo.jpg`, origins)).toBe(`${app}/uploads/u1/pictures/photo.jpg`);
		expect(ownPictureUrl(`${alias}/api/uploads/u1/pictures/photo.png`, origins)).toBe(
			`${alias}/api/uploads/u1/pictures/photo.png`,
		);
	});

	it("leave out pictures on other sites, with a query or hash, or that aren't pictures", () => {
		expect(ownPictureUrl("https://cdn.example.com/uploads/u1/pictures/photo.jpg", origins)).toBeUndefined();
		expect(ownPictureUrl("//cdn.example.com/uploads/u1/pictures/photo.jpg", origins)).toBeUndefined();
		expect(ownPictureUrl(`${app}/uploads/u1/pictures/photo.jpg?size=1`, origins)).toBeUndefined();
		expect(ownPictureUrl(`${app}/uploads/u1/pictures/photo.jpg#x`, origins)).toBeUndefined();
		expect(ownPictureUrl(`${app}/uploads/u1/documents/portfolio/a.pdf`, origins)).toBeUndefined();
		expect(ownPictureUrl("data:image/png;base64,AAAA", origins)).toBeUndefined();
		expect(ownPictureUrl("/uploads/u1/pictures/photo.jpg", [])).toBeUndefined();
	});

	it("drop a resume photo kept on another site, and keep an uploaded one", () => {
		const elsewhere = structuredClone(defaultResumeData);
		elsewhere.picture.url = "https://avatars.example.com/nadia.jpg";
		expect(withOwnPicture(elsewhere, origins).picture.url).toBe("");

		const uploaded = structuredClone(defaultResumeData);
		uploaded.picture.url = `${app}/uploads/u1/pictures/nadia.webp`;
		expect(withOwnPicture(uploaded, origins)).toBe(uploaded);
	});

	it("link a portfolio's own PDF too, as the published page does", () => {
		expect(ownFileUrl(`${app}/uploads/u1/documents/portfolio/deck-1.pdf`, origins)).toBe(
			`${app}/uploads/u1/documents/portfolio/deck-1.pdf`,
		);
		expect(ownFileUrl("/uploads/u1/pictures/portfolio/a-1.webp", origins)).toBe(
			`${app}/uploads/u1/pictures/portfolio/a-1.webp`,
		);
		expect(ownFileUrl("https://evil.example/uploads/u1/documents/portfolio/deck.pdf", origins)).toBeUndefined();
		expect(ownFileUrl(`${app}/uploads/u1/documents/other/deck.pdf`, origins)).toBeUndefined();
		expect(ownFileUrl(`${app}/uploads/u1/documents/portfolio/deck.pdf?download=1`, origins)).toBeUndefined();
	});
});
