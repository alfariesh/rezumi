/**
 * The term match with a resume (01-desain.md §3.3, 02-teknis.md §10): which resume, the share of the posting's terms
 * it has, and the keyword chips. Free, no AI (`resume.matchTerms`). Pure, for tests.
 */

type ResumeOption = { id: string; isPrimary: boolean };

/**
 * Aturan turunan #11: the resume the person picked last (while it still exists), else the account's primary resume
 * (the one its short link opens), else the most recently updated one (the list comes newest first).
 */
export function matchResumeId(resumes: readonly ResumeOption[], picked: string | null): string | null {
	if (picked && resumes.some((resume) => resume.id === picked)) return picked;
	return (resumes.find((resume) => resume.isPrimary) ?? resumes[0])?.id ?? null;
}

/** The share of the posting's terms found in the resume, 0–100, or null when the posting named none. */
export function matchPercent(found: number, total: number): number | null {
	return total > 0 ? Math.round((found / total) * 100) : null;
}

type Term = { term: string; label: string };

export type MatchChips = {
	missing: Term[];
	found: Term[];
	/** Terms beyond the chips shown ("+N"). */
	more: number;
};

/**
 * At most `max` chips (12 in the design), missing keywords first since they are what to work on, then found ones;
 * the rest counts as "+N".
 */
export function matchChips(found: readonly Term[], missing: readonly Term[], max = 12): MatchChips {
	const shownMissing = missing.slice(0, Math.min(missing.length, Math.max(max - Math.min(found.length, 4), 8)));
	const shownFound = found.slice(0, Math.max(0, max - shownMissing.length));
	return {
		missing: shownMissing,
		found: shownFound,
		more: found.length + missing.length - shownMissing.length - shownFound.length,
	};
}
