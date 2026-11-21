import { describe, expect, it } from "vite-plus/test";
import sharp from "sharp";
import { PORTFOLIO_THEMES } from "@rezumi/schema/portfolio/themes";
import { buildPersona, THEME_PERSONAS } from "./persona";

describe("portfolio sample art", () => {
	it.each(PORTFOLIO_THEMES)("%s resolves every WebP with its declared dimensions", async (theme) => {
		const persona = buildPersona(THEME_PERSONAS[theme], { theme });
		const photo = await sharp(await persona.photo.read()).metadata();
		expect(photo).toMatchObject({ format: "webp", width: 560, height: 560 });

		const clients = persona.portfolio.clients?.items ?? [];
		expect(clients.map(({ name }) => name)).toEqual([
			"Boltshift",
			"45 Degrees",
			"3portals",
			"Acme Corp",
			"Building Blocks",
		]);
		for (const client of clients) {
			expect(client.logo).toMatchObject({
				key: expect.stringContaining("/portfolio/untitled-ui-"),
				alt: client.name,
			});
		}

		const covers = persona.portfolio.works?.items?.map((work) => work.cover?.key) ?? [];
		expect(covers).toHaveLength(6);
		for (const key of covers) {
			expect(key).toContain(`/portfolio/${theme}-`);
		}

		const pictures = persona.files.filter((file) => file.name.endsWith(".webp"));
		await Promise.all(
			pictures.map(async (file) => {
				const metadata = await sharp(await file.read()).metadata();
				expect(metadata, file.name).toMatchObject({
					format: "webp",
					width: file.width,
					height: file.height,
				});
			}),
		);
	});

	it.each(["paper", "brutal"] as const)("%s keeps its own portrait and gallery assets", (theme) => {
		const persona = buildPersona(THEME_PERSONAS[theme], { theme });
		expect(persona.photo.name).toBe(`${theme}-portrait.webp`);
		expect(persona.files.filter((file) => /-g[1-3]\.webp$/.test(file.name)).map((file) => file.name)).toEqual([
			`${theme}-g1.webp`,
			`${theme}-g2.webp`,
			`${theme}-g3.webp`,
		]);
	});
});
