/** What a posting doesn't say, named as a missing fact rather than a problem. */
type Unknown = "salary" | "office";

// ponytail: small English and Indonesian stop lists; phrases in other languages simply keep more words significant.
// English, then Indonesian.
const STOP_WORDS = new Set(
	"an and at for from in of on or the to with within dan atau di ke dari yang untuk dengan pada dalam".split(" "),
);

// ponytail: shape-based, so "10,000 users" reads as pay; good enough to stop "Salary not listed" showing wrongly.
const SALARY = /[€$£¥₹]|\b(?:EUR|USD|GBP|CHF|SEK|NOK|DKK|PLN|CAD|AUD|INR|JPY)\b|\b\d{2,3}(?:[.,\s]?\d{3}|\s?k)\b/i;
const OFFICE = /\b(?:remote|hybrid|office|on-?site|in-person)\b/i;

/** Lower-cased words, with a trailing plural "s" dropped so "customers" finds "customer". */
const words = (text: string) =>
	text
		.toLocaleLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 1)
		.map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));

/**
 * Matches a posting against the user's preference phrases in their own words: a phrase matches when every one of its
 * significant words appears in the posting. Also names the facts the posting leaves out.
 */
export function matchOpportunity(text: string, phrases: string[]) {
	const present = new Set(words(text));
	const matches = [
		...new Set(
			phrases.filter((phrase) => {
				const significant = words(phrase).filter((word) => !STOP_WORDS.has(word));
				return significant.length > 0 && significant.every((word) => present.has(word));
			}),
		),
	];
	const unknowns: Unknown[] = [];
	if (!SALARY.test(text)) unknowns.push("salary");
	if (!OFFICE.test(text)) unknowns.push("office");
	return { matches, unknowns };
}

type Posting = { role: string; location: string; snippet: string; description: string };

/**
 * How a found role reads against Preferences. ponytail: target roles match the title and locations the whole posting;
 * free-text priorities would split into noisy fragments, so they aren't matched.
 */
export function matchPosting(posting: Posting, preferences: { targetRoles: string[]; locations: string[] }) {
	const text = [posting.role, posting.location, posting.snippet, posting.description].join("\n");
	return {
		matches: [
			...matchOpportunity(posting.role, preferences.targetRoles).matches,
			...matchOpportunity(text, preferences.locations).matches,
		],
		unknowns: matchOpportunity(text, []).unknowns,
	};
}

/** The most skills a listing is matched on; providers name up to dozens, and the first ones are the main ones. */
export const MAX_MATCHED_SKILLS = 12;

/**
 * The skills a job listing names (`job_listing.skills`), split into those the person's Profile mentions and those it
 * doesn't yet: free, without AI (K8). A skill matches when each of its significant words appears somewhere in the
 * Profile text, in any order; words compare whole (only a plural "s" is dropped), so "analysis" never finds
 * "analysed". Slugs such as "sql-server" read as words. Null when the listing names no skills or the Profile is empty.
 */
export function matchSkills(skills: string[], profileText: string): { matched: string[]; missing: string[] } | null {
	const byKey = new Map<string, string>();
	for (const skill of skills) {
		const name = skill.replace(/[-_]+/g, " ").trim();
		const key = name.toLocaleLowerCase();
		// The first spelling a listing uses is the one shown.
		if (name && !byKey.has(key)) byKey.set(key, name);
	}
	const unique = [...byKey.values()].slice(0, MAX_MATCHED_SKILLS);
	if (unique.length === 0 || !profileText.trim()) return null;
	const matched = new Set(matchOpportunity(profileText, unique).matches);
	return {
		matched: unique.filter((skill) => matched.has(skill)),
		missing: unique.filter((skill) => !matched.has(skill)),
	};
}
