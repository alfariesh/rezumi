import { describe, expect, it } from "vite-plus/test";
import { icons } from "@rezumi/schema/icons";
import { brandIconSchema } from "@rezumi/schema/portfolio/blocks";
import { brandIconForUrl } from "./brand";

describe("brandIconForUrl", () => {
	it.each([
		["https://www.behance.net/gallery/123/kopi", "behance-01"],
		["https://dribbble.com/shots/1-kopi", "dribbble"],
		["https://github.com/nadia/kopi-app", "github"],
		["https://gist.github.com/nadia/abc", "github"],
		["https://nadia.github.io/", "github"],
		["https://www.figma.com/design/abc/Kopi", "figma"],
		["https://nadia.medium.com/a-story-1", "medium"],
		["https://medium.com/@nadia/a-story-1", "medium"],
		["https://www.linkedin.com/in/nadia", "linkedin-02"],
		["https://nadia.notion.site/Kopi-1", "notion-01"],
		["https://www.notion.so/Kopi-1", "notion-01"],
		["https://drive.google.com/file/d/1/view", "google-drive"],
		["https://docs.google.com/spreadsheets/d/1/edit", "google-sheet"],
		["https://docs.google.com/document/d/1/edit", "google-doc"],
		["https://docs.google.com/presentation/d/1/edit", "google-drive"],
		["https://codepen.io/nadia/pen/x", "codepen"],
		["https://x.com/nadia", "new-twitter"],
		["https://GITHUB.COM./nadia", "github"],
	])("%s → %s", (url, icon) => {
		expect(brandIconForUrl(url)).toBe(icon);
	});

	it("gives sites without a logo, look-alike domains and bad addresses none", () => {
		expect(brandIconForUrl("https://www.canva.com/design/x")).toBeUndefined();
		expect(brandIconForUrl("https://notgithub.com/nadia")).toBeUndefined();
		expect(brandIconForUrl("https://github.com.example.test/")).toBeUndefined();
		expect(brandIconForUrl("https://senja.example.test/")).toBeUndefined();
		expect(brandIconForUrl("not a url")).toBeUndefined();
	});

	it("only names logos the resume icon set has, as the portfolio schema accepts them", () => {
		const known = new Set<string>(icons);
		const urls = [
			"behance.net",
			"dribbble.com",
			"github.com",
			"gitlab.com",
			"figma.com",
			"medium.com",
			"linkedin.com",
			"notion.so",
			"drive.google.com",
			"youtube.com",
			"vimeo.com",
			"codepen.io",
			"codesandbox.io",
			"replit.com",
			"instagram.com",
			"tiktok.com",
			"pinterest.com",
			"x.com",
			"threads.net",
			"framer.com",
			"webflow.io",
			"wordpress.com",
			"upwork.com",
			"fiverr.com",
			"deviantart.com",
			"flickr.com",
			"unsplash.com",
			"spotify.com",
			"soundcloud.com",
			"twitch.tv",
			"gitbook.io",
			"dropbox.com",
			"loom.com",
			"trello.com",
			"shopify.com",
			"npmjs.com",
			"sketch.com",
		];
		for (const host of urls) {
			const icon = brandIconForUrl(`https://${host}/x`);
			expect(icon, host).toBeDefined();
			expect(known.has(icon as string), `${host}: ${icon}`).toBe(true);
			expect(brandIconSchema.safeParse(icon).success, `${host}: ${icon}`).toBe(true);
		}
	});
});
