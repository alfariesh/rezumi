import type { PortfolioHeroEffect, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { t } from "@lingui/core/macro";

/**
 * A theme's gallery picture (`pnpm --filter @rezumi/tooling portfolio:previews`): the top of its sample page with a
 * fictional persona. Indonesian pages show the Indonesian one, every other language the English one.
 */
export const themePicture = (theme: PortfolioTheme, locale: string) =>
	`/portfolio-themes/thumb/${locale.split("-")[0] === "id" ? "id/" : ""}${theme}.webp`;

/** What each theme looks like, in the theme gallery (create dialog and Design). */
export const themeDescription = (theme: PortfolioTheme) =>
	({
		lugas: t`One calm column, a big name and your work as a clear list.`,
		prima: t`Formal and structured: a timeline, case studies and numbers in neat cards.`,
		kanvas: t`Big pictures first, with your name across the page.`,
		mozaik: t`Playful tiles that fit your intro, numbers and work together.`,
		paper: t`Warm paper, fine borders, folded corners and alternating stories of your work.`,
		brutal: t`Bold type, solid colours, thick outlines and hard offset shadows.`,
	})[theme];

/** Whom each theme suits (`01-desain.md` section 5). */
export const themeAudience = (theme: PortfolioTheme) =>
	({
		lugas: t`Suits every field.`,
		prima: t`For finance, consulting, state companies, managers and formal fresh graduates.`,
		kanvas: t`For designers, photographers, architects and content creators.`,
		mozaik: t`For creators, freelancers and students.`,
		paper: t`For designers, design engineers and thoughtful makers.`,
		brutal: t`For creatives, developers and makers with a bold point of view.`,
	})[theme];

/** The intro effects' names and what they do (`01-desain.md` section 18). */
export const effectLabel = (effect: PortfolioHeroEffect) =>
	({
		none: t`No effect`,
		"fade-up": t`Gentle fade-in`,
		shimmer: t`Shimmer`,
		gradient: t`Living gradient`,
		typewriter: t`Typewriter`,
		scramble: t`Tech scramble`,
		"vector-hover": t`Vector outline`,
	})[effect];
