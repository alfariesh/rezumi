import type { JdTermMatch, matchJobDescription, surfaceFormsOf } from "../ats-pdf";
import type { SkillItem } from "@rezumi/schema/resume/data";
import { generateId } from "@rezumi/utils/string";

/** Matches the applications feature's cap on a saved posting. */
export const MAX_POSTING_CHARS = 20_000;

/** A posting term, with `label` as the posting writes it ("C#" rather than the matcher's "csharp"). */
export type MatchedTerm = JdTermMatch & { label: string };

export type JobMatchResult = { found: MatchedTerm[]; missing: MatchedTerm[]; total: number };

/**
 * The matcher's two functions. `@rezumi/resume/ats-pdf` is passed in rather than imported, so the web can load it
 * only once there is a posting to match.
 */
export type PostingMatcher = { matchJobDescription: typeof matchJobDescription; surfaceFormsOf: typeof surfaceFormsOf };

/** The first spelling of a term the posting uses, as it writes it ("Figma", not "figma"). */
export function termAsWritten(forms: readonly string[], posting: string): string | undefined {
	for (const form of forms) {
		const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const found = posting.match(new RegExp(escaped, "i"))?.[0];
		if (found) return found;
	}
}

type MatchPostingOptions = {
	posting: string;
	/** The resume as text (`buildMarkdown`). */
	resumeText: string;
	/** Terms hidden as "not true for me"; left out. */
	hiddenTerms?: readonly string[] | undefined;
};

/** Sorts a posting's terms into found and missing in the resume. Job match is never part of the score. */
export function matchPosting(matcher: PostingMatcher, options: MatchPostingOptions): JobMatchResult {
	const hidden = new Set(options.hiddenTerms ?? []);
	const terms = matcher
		.matchJobDescription({ jobDescription: options.posting, resumeText: options.resumeText })
		.terms.filter((term) => !hidden.has(term.term))
		.map((term) => ({
			...term,
			label: termAsWritten(matcher.surfaceFormsOf(term.term), options.posting) ?? term.term,
		}));

	return {
		found: terms.filter((term) => term.resumeCount > 0),
		missing: terms.filter((term) => term.resumeCount === 0),
		total: terms.length,
	};
}

/** A skill named as the posting writes it, for "Add to Skills". */
export const newSkill = (name: string): SkillItem => ({
	id: generateId(),
	hidden: false,
	icon: "",
	iconColor: "",
	name,
	proficiency: "",
	level: 0,
	keywords: [],
});
