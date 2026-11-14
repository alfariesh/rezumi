import type { SiteAdapter } from "./types";
import { textOf } from "../text";
import { compact } from "./types";

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
		return {
			fields: compact({
				role: field(document, "job-detail-title"),
				company: field(document, "advertiser-name"),
				location: field(document, "job-detail-location"),
				salary: field(document, "job-detail-salary"),
				employmentType: field(document, "job-detail-work-type"),
				applyUrl,
			}),
			description: field(document, "jobAdDetails"),
		};
	},
	anchor(document) {
		return document.querySelector('[data-automation="job-detail-apply"]')?.parentElement ?? null;
	},
};
