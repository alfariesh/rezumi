// The wording of Check: issue cards and categories. The issues themselves (what fails, where, how it's fixed) come
// from `@rezumi/resume/check`, as on the web. Keep the copy identical to apps/web/src/features/resume/editor/check/
// issues.ts so the catalogs share translations (`pnpm lingui:seed`).
import type { AtsCategory } from "@rezumi/resume/ats";
import type { CheckIssue as CoreIssue } from "@rezumi/resume/check";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { getSectionName as getCoreSectionName } from "@rezumi/resume/check";
import { formatList } from "@rezumi/utils/locale";
import { SECTION_TITLES } from "@/features/entries/fields";

/** An issue worded for its card: title, explanation, the fix's label and what its toast says. */
export type CheckIssue = CoreIssue & { title: string; body: string; fixLabel: string; done: string };

export const getCategoryName = (category: AtsCategory) =>
	({
		contact: t`Contact details`,
		dates: t`Dates`,
		layout: t`Layout`,
		headings: t`Section headings`,
		writing: t`Writing`,
	})[category];

/** What a category checks. */
export const getCategoryDescription = (category: AtsCategory) =>
	({
		contact: t`Name, email, phone and location are found, and links are full addresses.`,
		dates: t`Every entry has dates in a form systems read, in order, and none in the future.`,
		layout: t`Text comes out in the order a person reads it, at a size and spacing that survive.`,
		headings: t`Sections use headings systems recognize, and work experience shows.`,
		writing: t`Every role says what you did. Opinions on wording live in the Writing tab.`,
	})[category];

/** The printed name of a section: the title the author gave it, else its type's name. */
export const getSectionName = (data: ResumeData, sectionId: string) =>
	getCoreSectionName(data, sectionId, (type) => i18n._(SECTION_TITLES[type]));

type Words = { title: string; body: string; label: string; done?: string };

function describe(issue: CoreIssue, data: ResumeData): Words {
	const { value, url, minimum, columns, title } = issue.facts;
	const name = getSectionName(data, issue.facts.section);
	const entry = issue.facts.entry ? `“${issue.facts.entry}”` : t`This entry`;

	switch (issue.code) {
		case "MISSING_NAME":
			return {
				title: t`Your name is missing`,
				body: t`Systems file you under the name at the top of the page.`,
				label: t`Add your name`,
			};
		case "MISSING_EMAIL":
			return {
				title: t`No email address`,
				body: t`Most systems file candidates by email address.`,
				label: t`Add an email`,
			};
		case "MALFORMED_EMAIL":
			return {
				title: t`Email address won't be recognized`,
				body: t`“${value}” isn't a plain address like name@example.com.`,
				label: t`Edit the email`,
			};
		case "MISSING_PHONE":
			return {
				title: t`No phone number`,
				body: t`Some application systems ask for one before you can apply.`,
				label: t`Add a phone number`,
			};
		case "MISSING_LOCATION":
			return {
				title: t`No location`,
				body: t`A city and country let roles be matched to where you are.`,
				label: t`Add a location`,
			};
		case "MALFORMED_URL":
			return {
				title: t`A link isn't a full address`,
				body: t`Some systems only recognize links that start with https://. This one reads as plain text: “${value}”.`,
				...(issue.fix.kind === "apply" ? { label: t`Use ${url}`, done: t`Link updated` } : { label: t`Edit the link` }),
			};
		case "PICTURE_PRESENT":
			return {
				title: t`Your resume has a photo`,
				body: t`Some systems mishandle images, and photos are discouraged in some countries.`,
				label: t`Hide the photo`,
				done: t`Photo hidden`,
			};
		case "EMPTY_PERIOD":
			return {
				title: t`An entry has no dates`,
				body: t`${entry} doesn't say when. Dates place it on your timeline.`,
				label: t`Add dates`,
			};
		case "UNPARSEABLE_PERIOD":
			return {
				title: t`Dates won't be read`,
				body: t`“${value}” isn't a form systems recognize, such as Mar 2020 – Present.`,
				label: t`Fix the dates`,
			};
		case "UNPARSEABLE_DATE":
			return {
				title: t`A date won't be read`,
				body: t`“${value}” isn't a form systems recognize, such as March 2022.`,
				label: t`Fix the date`,
			};
		case "REVERSED_PERIOD":
			return { title: t`Dates run backwards`, body: t`“${value}” ends before it starts.`, label: t`Fix the dates` };
		case "FUTURE_DATED_PERIOD":
			return {
				title: t`Dates start in the future`,
				body: t`“${value}” starts after today. Check the year, or mark it as current.`,
				label: t`Fix the dates`,
			};
		case "SECTION_MISSING_FROM_LAYOUT":
			return {
				title: t`${name} never prints`,
				body: t`It has entries but isn't placed on a page.`,
				label: t`Add it to page 1`,
				done: t`${name} added to page 1`,
			};
		case "NO_VISIBLE_EXPERIENCE":
			return {
				title: t`No work experience shows`,
				body: t`Systems look for an experience section. Projects or volunteering can show the same history.`,
				label: t`Add experience`,
			};
		case "MISSING_EXPERIENCE_DESCRIPTION":
			return {
				title: t`A role has no description`,
				body: t`${entry} names the role but not what you did, so it adds no keywords.`,
				label: t`Describe the role`,
			};
		case "NON_STANDARD_SECTION_TITLE":
			return {
				title: t`“${title}” isn't a heading systems look for`,
				body: t`They look for headings such as Experience, Education and Skills.`,
				label: t`Use the standard heading`,
				done: t`Heading changed`,
			};
		case "MULTI_COLUMN_PROSE_SECTION":
			return {
				title: t`${name} is split into ${columns} columns`,
				body: t`Columns can scramble the order text is read in.`,
				label: t`Use one column`,
				done: t`${name} uses one column`,
			};
		case "PROSE_SECTION_IN_SIDEBAR":
			return {
				title: t`${name} sits in the sidebar`,
				body: t`Sidebars are often read last, or mixed into the main column.`,
				label: t`Move it to the main column`,
				done: t`${name} moved to the main column`,
			};
		case "TWO_COLUMN_LAYOUT": {
			const names = formatList(
				i18n.locale,
				issue.facts.sections.map((id) => getSectionName(data, id)),
			);
			return {
				title: t`Sidebar is read after the main column`,
				body: t`${names} come last in the text. Most systems still find them; some don't.`,
				label: t`Switch to one column`,
				done: t`Switched to one column`,
			};
		}
		case "SMALL_BODY_FONT":
			return {
				title: t`Body text is very small`,
				body: t`Text under ${minimum} pt can be misread when a system re-renders it.`,
				label: t`Use ${minimum} pt`,
				done: t`Body text set to ${minimum} pt`,
			};
		case "TIGHT_LINE_HEIGHT":
			return {
				title: t`Lines are packed tightly`,
				body: t`Lines this close can run together when read. Use at least ${minimum}.`,
				label: t`Use ${minimum}`,
				done: t`Line height set to ${minimum}`,
			};
		case "TIGHT_PAGE_MARGINS":
			return {
				title: t`Margins are very narrow`,
				body: t`Text this close to the edge can be cut off. Use at least ${minimum} pt.`,
				label: t`Use ${minimum} pt margins`,
				done: t`Margins set to ${minimum} pt`,
			};
	}
}

/** Words every issue of a report for its card. */
export function describeIssues(issues: readonly CoreIssue[], data: ResumeData): CheckIssue[] {
	return issues.map((issue) => {
		const words = describe(issue, data);
		return { ...issue, title: words.title, body: words.body, fixLabel: words.label, done: words.done ?? words.label };
	});
}
