/**
 * Whether two postings are the same job published on different sites (.agents/docs/plans/plugin-browser/02-teknis.md
 * §19.3): the role and the company match once case, accents, punctuation and legal forms ("PT", "Tbk", "Inc") are set
 * aside. Pure, so the server and the extension agree.
 */

/** Legal forms and filler words a company name drops before comparing. */
const COMPANY_FORMS = new Set([
	"pt",
	"tbk",
	"persero",
	"cv",
	"inc",
	"incorporated",
	"ltd",
	"limited",
	"llc",
	"llp",
	"plc",
	"corp",
	"corporation",
	"co",
	"company",
	"gmbh",
	"ag",
	"sa",
	"bv",
	"nv",
	"pte",
	"sdn",
	"bhd",
	"pty",
	"the",
]);

const words = (text: string) =>
	text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);

/** "PT. Lumen Health Tbk" → "lumen health". */
export function normalizeCompany(company: string): string {
	return words(company)
		.filter((word) => !COMPANY_FORMS.has(word))
		.join(" ");
}

/** "Senior Product Designer (Remote)" → "senior product designer remote". */
export function normalizeRole(role: string): string {
	return words(role).join(" ");
}

type Posting = { role: string; company: string };

/** The same role at the same company, by the normalised names; false when either name is empty. */
export function isSamePosting(a: Posting, b: Posting): boolean {
	const company = normalizeCompany(a.company);
	const role = normalizeRole(a.role);
	return Boolean(company && role) && company === normalizeCompany(b.company) && role === normalizeRole(b.role);
}
