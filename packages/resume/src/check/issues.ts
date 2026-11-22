import type { AtsCategory, AtsFinding, AtsReport, AtsRuleCode } from "../ats";
import type { CustomSectionType, ResumeData } from "@rezumi/schema/resume/data";
import { atsRuleCategory, lintResumeForAts } from "../ats";
import { describeEntry, findEntry, getSectionObject, resolveSection } from "../write";

/** The block on the page an issue is about. Same shape as `PageMapTarget` from `@rezumi/pdf/page-map`. */
export type CheckTarget =
	| { kind: "header" }
	| { kind: "section"; sectionId: string }
	| { kind: "item"; sectionId: string; itemId: string };

/** Icons of the one-step fixes; kebab names from `@rezumi/icons`, which both apps' `IconName` accept. */
export type CheckFixIcon =
	| "link-simple-horizontal"
	| "eye-slash"
	| "plus"
	| "text-t"
	| "list-dashes"
	| "arrow-right"
	| "text-aa"
	| "sliders-horizontal";

/** How an issue is fixed: in one step on the resume (with undo), or by opening the entry in Write. */
export type CheckFix =
	| { kind: "apply"; icon: CheckFixIcon; apply: (draft: ResumeData) => void }
	| { kind: "write"; target: CheckTarget };

/** The values an issue's wording needs. Each app words the issue from its code and these, in its own catalog. */
export type CheckFacts = {
	/** The offending text (an email, a link, a date). */
	value: string;
	/** `value` with https:// in front, for the link fix. */
	url: string;
	/** The section the issue is about (an id). */
	section: string;
	/** The sidebar's sections, for the two-column issue (ids). */
	sections: string[];
	/** A non-standard heading as written. */
	title: string;
	/** The smallest size, line height or margin that reads reliably. */
	minimum: number;
	columns: number;
	/** The printed title of the entry the issue is on; null when it's on none or the entry has no title. */
	entry: string | null;
};

/** A live check that fails, numbered and placed, without wording. */
export type CheckIssue = {
	key: string;
	/** 1-based, in the order the cards list them; the pin on the page carries the same number. */
	number: number;
	finding: AtsFinding;
	code: AtsRuleCode;
	category: AtsCategory;
	/** Danger for errors, warning for the rest: the card chip and the page pin. */
	tone: "danger" | "warning";
	facts: CheckFacts;
	fix: CheckFix;
	/** "Keep" instead of "Ignore": the issue follows from a design choice that is the author's to make. */
	keepLabel: boolean;
	/** The block on the page the issue is about, for its pin; null for page-wide settings. */
	target: CheckTarget | null;
};

const decodeToken = (token: string) => token.replace(/~1/g, "/").replace(/~0/g, "~");

const tokensOf = (pointer: string) => pointer.split("/").slice(1).map(decodeToken);

/** The section a pointer is in: the summary, a built-in section's key or a custom section's id. */
function sectionIdOf(tokens: readonly string[], data: ResumeData): string | undefined {
	const [head, next] = tokens;
	if (head === "summary") return "summary";
	if (head === "sections") return next;
	if (head === "customSections") return data.customSections[Number(next)]?.id;
	return undefined;
}

function itemIdOf(tokens: readonly string[], data: ResumeData): string | undefined {
	const itemsIndex = tokens.indexOf("items");
	if (itemsIndex === -1) return undefined;

	let node: unknown = data;
	for (const token of tokens.slice(0, itemsIndex + 2)) node = (node as Record<string, unknown> | undefined)?.[token];

	const id = (node as { id?: unknown } | undefined)?.id;
	return typeof id === "string" ? id : undefined;
}

/** The block a finding is about: the header for contact details, else its section or entry. */
function getFindingTarget(finding: AtsFinding, data: ResumeData): CheckTarget | null {
	const tokens = tokensOf(finding.pointer);
	if (tokens[0] === "basics" || tokens[0] === "picture") return { kind: "header" };

	const sectionId = sectionIdOf(tokens, data);
	if (!sectionId) return null;

	const itemId = itemIdOf(tokens, data);
	return itemId ? { kind: "item", sectionId, itemId } : { kind: "section", sectionId };
}

/** The field inside the entry a pointer names ("period", "website/url"), for focusing it in Write. */
export function getFindingField(pointer: string): string {
	const tokens = tokensOf(pointer);
	const items = tokens.indexOf("items");
	return tokens.slice(items === -1 ? 1 : items + 2).join("/");
}

/** The printed name of a section: the title the author gave it, else its type's name (translated by the app). */
export function getSectionName(
	data: ResumeData,
	sectionId: string,
	typeName: (type: CustomSectionType) => string,
): string {
	const section = resolveSection(data, sectionId);
	if (!section) return sectionId;

	const title = getSectionObject(data, section)?.title.trim();
	return title || typeName(section.type);
}

function getEntryTitle(data: ResumeData, target: CheckTarget | null): string | null {
	if (target?.kind !== "item") return null;

	const section = resolveSection(data, target.sectionId);
	const entry = findEntry(data, target.sectionId, target.itemId);
	return (section && entry ? describeEntry(section.type, entry).title : "") || null;
}

/** Sets the value a finding's pointer names (the pointer still has array indexes, which match `draft`). */
function setAt(draft: ResumeData, pointer: string, value: unknown) {
	const tokens = tokensOf(pointer);
	const last = tokens.pop();
	let node: unknown = draft;
	for (const token of tokens) node = (node as Record<string, unknown> | undefined)?.[token];
	if (node && last !== undefined) (node as Record<string, unknown>)[last] = value;
}

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** What fixes a finding, and whether it's the author's choice to keep. */
function getFix(
	finding: AtsFinding,
	facts: CheckFacts,
	target: CheckTarget | null,
): Pick<CheckIssue, "fix" | "keepLabel"> {
	const write: CheckFix = { kind: "write", target: target ?? { kind: "header" } };
	const apply = (icon: CheckFixIcon, edit: (draft: ResumeData) => void) => ({
		fix: { kind: "apply", icon, apply: edit } satisfies CheckFix,
		keepLabel: false,
	});
	const { section, minimum } = facts;

	switch (finding.code) {
		case "MALFORMED_URL":
			return HAS_SCHEME.test(facts.value)
				? { fix: write, keepLabel: false }
				: apply("link-simple-horizontal", (draft) => setAt(draft, finding.pointer, facts.url));
		case "PICTURE_PRESENT":
			return apply("eye-slash", (draft) => {
				draft.picture.hidden = true;
			});
		case "SECTION_MISSING_FROM_LAYOUT":
			return apply("plus", (draft) => {
				const [page] = draft.metadata.layout.pages;
				if (page) page.main.push(section);
				else draft.metadata.layout.pages.push({ fullWidth: false, main: [section], sidebar: [] });
			});
		case "NO_VISIBLE_EXPERIENCE":
			return { fix: { kind: "write", target: { kind: "section", sectionId: "experience" } }, keepLabel: false };
		// An empty title prints the section type's name in the resume's language.
		case "NON_STANDARD_SECTION_TITLE":
			return apply("text-t", (draft) => setAt(draft, finding.pointer, ""));
		case "MULTI_COLUMN_PROSE_SECTION":
			return apply("list-dashes", (draft) => setAt(draft, finding.pointer, 1));
		case "PROSE_SECTION_IN_SIDEBAR":
			return apply("arrow-right", (draft) => {
				for (const page of draft.metadata.layout.pages) {
					if (!page.sidebar.includes(section)) continue;
					page.sidebar = page.sidebar.filter((id) => id !== section);
					page.main.push(section);
				}
			});
		// Full-width pages print no sidebar, so its sections move into the main column first.
		case "TWO_COLUMN_LAYOUT":
			return {
				...apply("list-dashes", (draft) => {
					for (const page of draft.metadata.layout.pages) {
						if (page.fullWidth || page.sidebar.length === 0) continue;
						page.main.push(...page.sidebar);
						page.sidebar = [];
						page.fullWidth = true;
					}
				}),
				keepLabel: true,
			};
		case "SMALL_BODY_FONT":
			return apply("text-aa", (draft) => setAt(draft, finding.pointer, minimum));
		case "TIGHT_LINE_HEIGHT":
		case "TIGHT_PAGE_MARGINS":
			return apply("sliders-horizontal", (draft) => setAt(draft, finding.pointer, minimum));
		default:
			return { fix: write, keepLabel: false };
	}
}

function getFacts(finding: AtsFinding, data: ResumeData, target: CheckTarget | null): CheckFacts {
	const value = String(finding.params?.value ?? "");
	return {
		value,
		url: `https://${value}`,
		section: String(finding.params?.section ?? ""),
		sections: String(finding.params?.sections ?? "")
			.split(",")
			.filter(Boolean),
		title: String(finding.params?.title ?? ""),
		minimum: Number(finding.params?.minimum ?? 0),
		columns: Number(finding.params?.columns ?? 2),
		entry: getEntryTitle(data, target),
	};
}

/** The open findings as numbered issues, in the report's order (most severe first). */
export function buildCheckIssues(report: AtsReport, data: ResumeData): CheckIssue[] {
	return report.findings.map((finding, index) => {
		const target = getFindingTarget(finding, data);
		const facts = getFacts(finding, data, target);

		return {
			key: finding.key,
			number: index + 1,
			finding,
			code: finding.code,
			category: atsRuleCategory(finding.code),
			tone: finding.severity === "error" ? "danger" : "warning",
			facts,
			...getFix(finding, facts, target),
			target,
		};
	});
}

/** The live checks on a resume: the report (score, categories) and its numbered issues. */
export function runCheck(data: ResumeData, options: { now?: Date } = {}) {
	const report = lintResumeForAts(data, options);
	return { report, issues: buildCheckIssues(report, data) };
}

/** The author's Check choices on a draft (ignored issues, hidden posting terms), created on first use. */
export function checkStateOf(draft: ResumeData) {
	draft.metadata.check ??= { ignored: [], hiddenTerms: [] };
	return draft.metadata.check;
}

/** Sets an issue aside; it stops counting until shown again. */
export function ignoreIssue(draft: ResumeData, key: string) {
	const state = checkStateOf(draft);
	if (!state.ignored.includes(key)) state.ignored.push(key);
}

/** Hides a posting term as "not true for me". */
export function hideTerm(draft: ResumeData, term: string) {
	const state = checkStateOf(draft);
	if (!state.hiddenTerms.includes(term)) state.hiddenTerms.push(term);
}
