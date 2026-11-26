import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_AI_PLACEHOLDER } from "@rezumi/schema/portfolio/ai";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { generateId } from "@rezumi/utils/string";

export type PortfolioAiDraft = {
	greeting: string;
	about: string;
	works: { id: string; summary: string; html: string }[];
};

/**
 * Puts a draft into the portfolio: the greeting, About me, and each work's summary and first Text block (a new one at
 * the top for a work without any). Whatever the AI left empty stays as it was.
 */
export function applyPortfolioDraft(data: PortfolioData, draft: PortfolioAiDraft): void {
	if (draft.greeting) data.hero.greeting = draft.greeting;
	if (draft.about) data.about.content = draft.about;
	for (const entry of draft.works) {
		const work = data.works.items.find((item) => item.id === entry.id);
		if (!work) continue;
		if (entry.summary) work.summary = entry.summary;
		if (!entry.html) continue;
		const text = work.blocks.find((block) => block.type === "text");
		if (text) text.html = entry.html;
		else if (work.blocks.length < PORTFOLIO_LIMITS.blocksPerWork)
			work.blocks.unshift({ id: generateId(), type: "text", html: entry.html });
	}
}

const placeholdersIn = (text: string) => text.match(PORTFOLIO_AI_PLACEHOLDER)?.length ?? 0;

/** Places a draft left for the person to fill in, such as "[add the result]", still on the page. */
export function countPortfolioPlaceholders(data: PortfolioData): number {
	const works = data.works.items.flatMap((work) => [
		work.summary,
		...work.blocks.flatMap((block) => (block.type === "text" ? [block.html] : [])),
	]);
	return [data.hero.greeting, data.about.content, ...works].reduce((sum, text) => sum + placeholdersIn(text), 0);
}
