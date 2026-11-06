import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { t } from "@lingui/core/macro";

/** Who each theme suits, in the theme gallery (create dialog and Design). */
export const themeDescription = (theme: PortfolioTheme) =>
	({
		lugas: t`One calm column, a big name and your work as a clear list. Suits every field.`,
		prima: t`Formal and structured, for finance, consulting and management.`,
		kanvas: t`Big pictures first, for designers, photographers and architects.`,
		mozaik: t`Playful tiles, for creators, freelancers and students.`,
	})[theme];
