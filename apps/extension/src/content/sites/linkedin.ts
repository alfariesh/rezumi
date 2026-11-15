import type { SiteAdapter } from "./types";
import { jobKey } from "@rezumi/job-sites/sites";
import { firstText, logoIn, looksLikeSalary, textOf } from "../text";
import { buttonRow, compact } from "./types";

/**
 * LinkedIn, checked 2026-11-14 signed in (02-teknis.md §18). The current interface has generated class names, so the
 * reader relies on what stays put: `componentkey="JobDetails_AboutTheJob_<id>"` around the description, the company's
 * `aria-label="Company, <name>."`, the role's link to `/jobs/view/<id>/` and the tab title `<role> | <company> |
 * LinkedIn`. The older interface's classes and the signed-out page's classes are kept as fallbacks.
 */

const COMPANY_LABEL = /^(?:Company|Perusahaan),\s*(.+?)\.?$/;

/** The open posting's id, from the address (`/jobs/view/<id>/` or `?currentJobId=<id>`). */
const postingId = (url: URL) => jobKey(url)?.replace(/^linkedin:/, "") ?? null;

/** `<role> | <company> | LinkedIn` → role and company; also with a leading `(3) ` unread count. */
function fromTitle(title: string) {
	const parts = title
		.replace(/^\(\d+\)\s*/, "")
		.split(" | ")
		.map((part) => part.trim());
	if (parts.length < 3 || parts.at(-1) !== "LinkedIn") return { role: "", company: "" };
	return { role: parts[0] ?? "", company: parts[1] ?? "" };
}

/** The current interface's top card: the column that holds the company label. */
function topCard(document: Document) {
	const company = document.querySelector('[aria-label^="Company, "], [aria-label^="Perusahaan, "]');
	return { company, card: company?.closest('[data-testid="lazy-column"]') ?? company?.closest("main") ?? null };
}

export const linkedin: SiteAdapter = {
	site: "linkedin",
	read(document, url) {
		const id = postingId(url);
		const { company: companyLabel, card } = topCard(document);

		const roleLink = id && card ? card.querySelector(`a[href*="/jobs/view/${id}"]`) : null;
		const titleParts = fromTitle(document.title);
		// The tab title follows the open posting (also beside the search results) and is the steadiest source.
		const role =
			titleParts.role ||
			textOf(roleLink) ||
			firstText(document, [
				".job-details-jobs-unified-top-card__job-title",
				".jobs-unified-top-card__job-title",
				".top-card-layout__title",
				".topcard__title",
			]);
		const company =
			titleParts.company ||
			COMPANY_LABEL.exec(companyLabel?.getAttribute("aria-label")?.trim() ?? "")?.[1] ||
			firstText(document, [
				".job-details-jobs-unified-top-card__company-name",
				".jobs-unified-top-card__company-name",
				".topcard__org-name-link",
				".top-card-layout__card .topcard__flavor",
			]);

		// The line under the role: "<location> · <posted> · <applicants>". On the posting's own page the role is not a
		// link to itself, so its paragraph is found by its text.
		const paragraphs = card ? [...card.querySelectorAll("p")] : [];
		const roleParagraph = roleLink?.closest("p") ?? paragraphs.find((paragraph) => textOf(paragraph) === role) ?? null;
		const metaLine = roleParagraph ? textOf(paragraphs[paragraphs.indexOf(roleParagraph) + 1]) : "";
		const location =
			metaLine.split(" · ")[0] ||
			firstText(document, [
				".job-details-jobs-unified-top-card__primary-description-container",
				".jobs-unified-top-card__bullet",
				".topcard__flavor--bullet",
			]).split(" · ")[0];
		const about =
			(id && document.querySelector(`[componentkey="JobDetails_AboutTheJob_${id}"]`)) ||
			document.querySelector('[componentkey^="JobDetails_AboutTheJob_"]') ||
			document.querySelector(
				".jobs-description__content, #job-details, .show-more-less-html__markup, .description__text",
			);
		// The block starts with its own "About the job" heading.
		const heading = about?.querySelector("h1, h2, h3");
		const description = textOf(about, { skip: (element) => element === heading });

		// Pay shows as a short chip in the top card, above the description (never read from the description itself).
		const aboveDescription = (element: Element) =>
			!about || Boolean(about.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING);
		const salary = card
			? [...card.querySelectorAll("span, p, button")]
					.filter(aboveDescription)
					.map((element) => textOf(element))
					.find(looksLikeSalary)
			: undefined;

		// The company's picture beside its name in the top card (signed in), or the signed-out card's logo.
		const companyLogoUrl =
			logoIn(card, company) ||
			logoIn(document, company, [".top-card-layout__card img.artdeco-entity-image", ".topcard__org-logo img"]);

		return { fields: compact({ role, company, location, salary, companyLogoUrl }), description };
	},
	anchor(document) {
		const save = document.querySelector(
			'button[aria-label="Save the job"], button[aria-label^="Simpan"], .jobs-save-button',
		);
		// Signed in (2026-11-15) the Save button sits alone in a grid that stacks its children: go up to the row.
		return save ? buttonRow(save) : document.querySelector(".jobs-apply-button--top-card");
	},
};
