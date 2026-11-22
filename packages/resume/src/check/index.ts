// Check: the live checks on a resume as numbered, placed issues with their fixes, plus the job match, the writing
// review and the PDF report's grouping. Shared by the web and the app; each words the issues in its own catalog.
export type { CheckFacts, CheckFix, CheckFixIcon, CheckIssue, CheckTarget } from "./issues";
export {
	buildCheckIssues,
	checkStateOf,
	getFindingField,
	getSectionName,
	hideTerm,
	ignoreIssue,
	runCheck,
} from "./issues";
export type { JobMatchResult, MatchedTerm, PostingMatcher } from "./job-match";
export { MAX_POSTING_CHARS, matchPosting, newSkill } from "./job-match";
export type { PageBlock } from "./page";
export { findBlock, isSameTarget, placeIssuePins, targetsMentioning, toTarget } from "./page";
export type { PdfFindingGroup } from "./pdf-rows";
export { groupPdfFindings } from "./pdf-rows";
export type { ReviewSuggestion, WritingNote } from "./review";
export { mapWritingReview } from "./review";
