import type { CapturedFields } from "@rezumi/job-sites/capture";
import type { JobSite } from "@rezumi/job-sites/sites";

/** What a board's reader found in the open posting: plain text only. */
type SiteReading = {
	fields: CapturedFields;
	/** The posting's own description block, tidied; empty when the page shows none. */
	description: string;
};

/**
 * One job board's reader (02-teknis.md §7.1). Which board a page belongs to and its job key come from
 * `@rezumi/job-sites/sites` (shared with the server); an adapter only reads the page's markup.
 */
export type SiteAdapter = {
	site: JobSite;
	/** Reads the posting the page shows now (the picked one on a search page). `url` is the tab's address. */
	read(document: Document, url: URL): SiteReading;
	/** Where an in-page "Save to Rezumi" button goes (Phase 04), or null to float it. */
	anchor(document: Document): Element | null;
};

/** The longest value each field may have (the server's capturedFieldsSchema refuses longer ones). */
const FIELD_LIMITS: Record<keyof CapturedFields, number> = {
	role: 300,
	company: 300,
	location: 300,
	salary: 300,
	employmentType: 100,
	validThrough: 100,
	applyUrl: 2_000,
	companyLogoUrl: 2_000,
};

/** Drops empty values and cuts long ones, so only what the page states is sent and the server accepts it. */
export function compact(fields: { [K in keyof CapturedFields]?: string | undefined }): CapturedFields {
	const out: CapturedFields = {};
	for (const [name, value] of Object.entries(fields) as [keyof CapturedFields, string | undefined][]) {
		const text = value?.replace(/\s+/g, " ").trim();
		if (!text) continue;
		if (name === "applyUrl") {
			if (/^https?:\/\//i.test(text) && text.length <= FIELD_LIMITS.applyUrl) out.applyUrl = text;
			continue;
		}
		if (name === "companyLogoUrl") {
			// Pictures inlined as data: or served over http are not copied.
			if (/^https:\/\/\S+$/i.test(text) && text.length <= FIELD_LIMITS.companyLogoUrl) out.companyLogoUrl = text;
			continue;
		}
		out[name] = text.slice(0, FIELD_LIMITS[name]).trim();
	}
	return out;
}
