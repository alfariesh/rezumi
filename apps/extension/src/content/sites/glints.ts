import type { SiteAdapter } from "./types";
import { firstText, logoIn } from "../text";
import { compact } from "./types";

/**
 * Glints, checked 2026-11-14 (02-teknis.md §18): every posting page carries a full JSON-LD JobPosting (title,
 * company, place, pay, validThrough, description), which the server reads. The markup has styled-components class
 * names whose readable prefix stays put (`TopFoldExperimentsc__JobOverViewTitle-sc-…`), matched here by substring.
 */

export const glints: SiteAdapter = {
	site: "glints",
	read(document) {
		const company = firstText(document, ['[class*="JobOverViewCompanyName"]']);
		return {
			fields: compact({
				role: firstText(document, ['[class*="JobOverViewTitle"]', "h1"]),
				company,
				companyLogoUrl: logoIn(document.querySelector('[class*="JobOverView"]')?.parentElement, company, [
					'[class*="CompanyLogo"] img',
				]),
				salary: firstText(document, ['[class*="SalaryJobOverview"]', '[class*="BasicSalary"]']),
			}),
			description: firstText(document, [
				'[class*="JobDescriptionsc__DescriptionContainer"]',
				'[class*="DescriptionContainer"]',
			]),
		};
	},
	anchor(document) {
		return document.querySelector('[class*="TopFold"][class*="ButtonContainer"]');
	},
};
