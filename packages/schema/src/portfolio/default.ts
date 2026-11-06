import type { PortfolioData } from "./data";
import type { PortfolioTheme } from "./themes";
import { parseWritablePortfolioData } from "./data";
import { defaultPortfolioTheme } from "./themes";

/**
 * A new, empty portfolio. Accent and fonts follow the resume and the theme; section order, mode, layouts and the
 * intro effect are the theme's until the user changes them. The profile links show in Contact, so their own section
 * starts hidden.
 */
export function createDefaultPortfolioData(theme: PortfolioTheme = defaultPortfolioTheme): PortfolioData {
	return parseWritablePortfolioData({ theme, sections: { hidden: ["profiles"] } });
}

export const defaultPortfolioData: PortfolioData = createDefaultPortfolioData();
