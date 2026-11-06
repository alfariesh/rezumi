import type { PortfolioHeroEffect, PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { t } from "@lingui/core/macro";

/** What each theme looks like, in the theme gallery (create dialog and Design). */
export const themeDescription = (theme: PortfolioTheme) =>
	({
		lugas: t`One calm column, a big name and your work as a clear list.`,
		prima: t`Formal and structured: a timeline, case studies and numbers in neat cards.`,
		kanvas: t`Big pictures first, with your name across the page.`,
		mozaik: t`Playful tiles that fit your intro, numbers and work together.`,
	})[theme];

/** Whom each theme suits (`01-desain.md` section 5). */
export const themeAudience = (theme: PortfolioTheme) =>
	({
		lugas: t`Suits every field.`,
		prima: t`For finance, consulting, state companies, managers and formal fresh graduates.`,
		kanvas: t`For designers, photographers, architects and content creators.`,
		mozaik: t`For creators, freelancers and students.`,
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

export const effectDescription = (effect: PortfolioHeroEffect) =>
	({
		none: t`Calm and formal.`,
		"fade-up": t`Words appear one by one, once.`,
		shimmer: t`A light in your accent colour sweeps across a few times.`,
		gradient: t`Your accent colours drift slowly, then rest.`,
		typewriter: t`Your headline types itself, then up to two more roles.`,
		scramble: t`Random letters settle into your name.`,
		"vector-hover": t`Letters turn into design-app outlines under the mouse. Phones get the gentle fade-in.`,
	})[effect];
