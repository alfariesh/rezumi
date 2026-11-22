// Words for a fact's type, where it came from and how it is used, shared by the Facts list and its detail. Matches the
// web's Facts page (apps/web/src/features/career/knowledge/facts.tsx).
import type { Fact } from "@/features/career/hooks";
import type { FactCategory } from "@rezumi/schema/career";
import { plural, t } from "@lingui/core/macro";
import { factCategorySchema } from "@rezumi/schema/career";

export const FACT_CATEGORIES = factCategorySchema.options;

/** Older rows may carry a retired category; they read as experience. */
export const categoryOf = (fact: Fact): FactCategory => factCategorySchema.catch("experience").parse(fact.category);

export const categoryLabel = (category: FactCategory) =>
	({
		accomplishment: t`Accomplishment`,
		experience: t`Experience`,
		skill: t`Skill`,
		preference: t`Preference`,
	})[category];

/** Where a fact came from, in words: "Added by you", "From your resume". */
export function sourceLabel(fact: Fact) {
	switch (fact.source.kind) {
		case "manual":
			return t`Added by you`;
		case "user-message":
			return t`From your message`;
		case "resume":
		case "resume-version":
			return t`From your resume`;
		case "letter":
		case "letter-version":
			return t`From your cover letter`;
		case "attachment":
			return t`From a document you attached`;
		case "debrief":
			return t`From a debrief`;
	}
}

/** Which stories and saved items lean on the fact. */
export const usageLabel = (fact: Fact) =>
	fact.usedBy.stories + fact.usedBy.savedItems === 0
		? t`Not used in a story or saved item yet`
		: `${plural(fact.usedBy.stories, { one: "Backs # story", other: "Backs # stories" })} · ${plural(fact.usedBy.savedItems, { one: "used in # saved item", other: "used in # saved items" })}`;

/** Names one fact apart from the others for screen readers (switches, rows). */
export const factExcerpt = (fact: Fact) => (fact.text.length > 60 ? `${fact.text.slice(0, 60)}…` : fact.text);
