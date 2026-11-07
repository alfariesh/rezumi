import type { PortfolioViewSection } from "../view";

/** Sections drawn as short two-column lists, grouped when they follow each other (`01-desain.md` section 5). */
export const EXTRA_KINDS: ReadonlySet<string> = new Set([
	"languages",
	"certifications",
	"awards",
	"publications",
	"interests",
]);

/** The sections the navigation links to: the first four, then Contact. Long pages stay one tap from everything. */
export function navSections(sections: readonly PortfolioViewSection[], count = 4): PortfolioViewSection[] {
	const contact = sections.find((section) => section.kind === "contact");
	const others = sections.filter((section) => section.kind !== "contact").slice(0, count);
	return contact ? [...others, contact] : others;
}

/** Consecutive short-list sections share one block, each keeping its own anchor and heading. */
export function groupSections(
	sections: readonly PortfolioViewSection[],
	kinds: ReadonlySet<string> = EXTRA_KINDS,
): PortfolioViewSection[][] {
	const groups: PortfolioViewSection[][] = [];
	for (const section of sections) {
		const last = groups.at(-1);
		if (kinds.has(section.kind) && last && kinds.has(last[0]?.kind ?? "")) last.push(section);
		else groups.push([section]);
	}
	return groups;
}
