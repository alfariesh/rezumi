import type { SiteAdapter } from "./types";
import { logoIn, textOf } from "../text";
import { buttonRow, compact } from "./types";

/**
 * JobStreet (SEEK), checked 2026-11-14 on id.jobstreet.com, Indonesian and English (02-teknis.md §18): the posting,
 * on its own page or beside the search results, is marked with `data-automation` attributes. No JSON-LD JobPosting.
 */

const field = (document: Document, name: string) => textOf(document.querySelector(`[data-automation="${name}"]`));

export const jobstreet: SiteAdapter = {
	site: "jobstreet",
	read(document, url) {
		const apply = document.querySelector('a[data-automation="job-detail-apply"]')?.getAttribute("href");
		let applyUrl: string | undefined;
		try {
			applyUrl = apply ? new URL(apply, url).href : undefined;
		} catch {
			applyUrl = undefined;
		}
		const company = field(document, "advertiser-name");
		const title = document.querySelector('[data-automation="job-detail-title"]');
		const header = title?.closest("section, article, [data-automation='jobDetailsPage']") ?? document;
		return {
			fields: compact({
				role: field(document, "job-detail-title"),
				company,
				location: field(document, "job-detail-location"),
				salary: field(document, "job-detail-salary"),
				employmentType: field(document, "job-detail-work-type"),
				applyUrl,
				// Only the posting's own branding (checked 2026-11-15): the same page lists other postings with their
				// companies' logos, so no guessing by alt text.
				companyLogoUrl: logoIn(header, "", [
					'img[data-testid="bx-logo-image"]',
					'[data-testid="bx-logo-image"] img',
					'[data-automation="advertiser-logo"] img',
				]),
			}),
			description: field(document, "jobAdDetails"),
		};
	},
	anchor(document) {
		// "Quick apply" sits in its own block; the row with the board's Save button is above it (2026-11-15).
		return buttonRow(document.querySelector('[data-automation="job-detail-apply"]'));
	},
};
