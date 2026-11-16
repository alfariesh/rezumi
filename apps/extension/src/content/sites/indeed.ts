import type { SiteAdapter } from "./types";
import { firstText, logoIn, looksLikeEmploymentType, looksLikeSalary, textOf } from "../text";
import { compact } from "./types";

/**
 * Indeed, checked 2026-11-14 on a search page with a posting open beside it (02-teknis.md §18): the posting pane has
 * `data-testid` hooks (`viewjob-main-content`, `vj-job-title`, `company-info-metadata`, `structured-job-summary`,
 * `vj-job-description-heading`). The older `/viewjob` layout (`#jobDescriptionText`, `jobsearch-JobInfoHeader-title`)
 * is kept as a fallback.
 */

const pane = (document: Document) =>
	document.querySelector('[data-testid="viewjob-main-content"]') ??
	document.querySelector("#jobsearch-ViewjobPaneWrapper, .jobsearch-ViewJobLayout, .jobsearch-JobComponent") ??
	document;

/** Indeed appends a hidden " - job post" to the title for screen readers. */
const cleanRole = (text: string) => text.replace(/\s*-\s*job post$/i, "").trim();

export const indeed: SiteAdapter = {
	site: "indeed",
	read(document) {
		const root = pane(document);
		const role = cleanRole(
			firstText(root, [
				'[data-testid="vj-job-title"]',
				'[data-testid="jobsearch-JobInfoHeader-title"]',
				"h1.jobsearch-JobInfoHeader-title",
				"h2.jobsearch-JobInfoHeader-title",
			]),
		);

		// "<company link>" then "<location>" under the title.
		const metadata = root.querySelector('[data-testid="company-info-metadata"] > div');
		const company =
			textOf(metadata?.querySelector("a")) ||
			firstText(root, ['[data-testid="inlineHeader-companyName"]', "[data-company-name]"]);
		const metaLocation = metadata ? textOf(metadata.children[1]) : "";

		// "Job details": one line each for pay, kind of employment and place, in that order but unlabeled.
		const summary = [...(root.querySelector('[data-testid="structured-job-summary"]')?.children ?? [])]
			.filter((item) => item.querySelector("svg"))
			.map((item) => textOf(item));
		const salary =
			summary.find(looksLikeSalary) ||
			firstText(root, ['[data-testid="jobsearch-OtherJobDetailsContainer"] [id="salaryInfoAndJobType"] span']);
		const employmentType = summary.find(looksLikeEmploymentType);
		const location =
			metaLocation ||
			firstText(root, ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]']) ||
			summary.find(
				(line) => !looksLikeSalary(line) && !looksLikeEmploymentType(line) && !/not provided|tidak/i.test(line),
			);

		const heading = root.querySelector('[data-testid="vj-job-description-heading"]');
		const description =
			textOf(root.querySelector("#jobDescriptionText")) ||
			textOf(heading?.parentElement, { skip: (element) => element === heading });

		const companyLogoUrl = logoIn(root, company, [
			'[data-testid="jobsearch-CompanyAvatar-image"]',
			'[data-testid="company-avatar"] img',
			".jobsearch-CompanyAvatar-image",
		]);

		return { fields: compact({ role, company, location, salary, employmentType, companyLogoUrl }), description };
	},
	anchor(document) {
		return document.querySelector('[data-testid="job-header-actions"], #jobsearch-ViewJobButtons-container');
	},
};
