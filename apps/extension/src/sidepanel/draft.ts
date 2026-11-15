import type { ReadingSummary } from "./reading";
import type { SuggestedContact } from "@rezumi/job-sites/contacts";
import type { JobSite } from "@rezumi/job-sites/sites";
import type { PostingSource } from "@rezumi/schema/applications/data";
import { defaultFollowUpDay, followUpAt, localDay } from "../shared/follow-ups";

/**
 * The save form's values for one posting (01-desain.md §3.3) and how they become an application. A draft lives per tab
 * in `chrome.storage.session` (`draftKey`) until it is saved or the tab closes, so closing the panel or a failed save
 * loses nothing (01-desain.md §1, §3.7).
 */

export type SaveStatus = "saved" | "applied";

export type DraftValues = {
	role: string;
	company: string;
	location: string;
	salary: string;
	employmentType: string;
	description: string;
	/** Aturan turunan #2: "Saved" by default; "Applied" brings a date, today by default. */
	status: SaveStatus;
	/** YYYY-MM-DD, the day the person applied (only with "Applied"). */
	appliedOn: string;
	/** "" for none. */
	resumeId: string;
	tags: string[];
	/** The ticked suggested contacts, as `contactId` values; none by default (02-teknis.md §19.2). */
	contacts: string[];
	/** YYYY-MM-DD of the reminder, "" for none (aturan turunan #6: two days before the posting closes). */
	followUpOn: string;
	followUpNote: string;
};

export type Draft = {
	/** Which posting the draft belongs to: its job key, else its address. A draft for another posting is dropped. */
	identity: string;
	values: DraftValues;
	/** Fields the person changed; the server's reading never overwrites them. */
	edited: (keyof DraftValues)[];
};

/** What the server's reading (`applications.readCapture`) adds to the page's own data. */
export type CaptureFields = {
	role: string;
	company: string;
	location: string;
	salary: string;
	employmentType: string;
	/** When the posting closes, as the page states it (JSON-LD `validThrough`). */
	validThrough: string | null;
};

/** Today in the person's time zone, as YYYY-MM-DD. */
const today = (now = new Date()) => localDay(now);

export const postingIdentity = (reading: { key: string | null; canonicalUrl: string }) =>
	reading.key ?? reading.canonicalUrl;

/** A fresh draft from what the panel read on the page. */
export function draftFromReading(identity: string, summary: ReadingSummary, day = today()): Draft {
	const value = (name: keyof ReadingSummary["fields"]) => summary.fields[name]?.value ?? "";
	return {
		identity,
		values: {
			role: value("role"),
			company: value("company"),
			location: value("location"),
			salary: value("salary"),
			employmentType: value("employmentType"),
			description: value("description"),
			status: "saved",
			appliedOn: day,
			resumeId: "",
			tags: [],
			contacts: [],
			followUpOn: "",
			followUpNote: "",
		},
		edited: [],
	};
}

/**
 * Fills in what the server read (and AI, when on) for every field the person has not changed and the page left empty,
 * and the reminder from the posting's closing date (aturan turunan #6) while the person hasn't set one.
 */
export function withCapture(draft: Draft, capture: CaptureFields, day = today()): Draft {
	const values = { ...draft.values };
	for (const name of ["role", "company", "location", "salary", "employmentType"] as const) {
		if (draft.edited.includes(name)) continue;
		const next = capture[name].trim();
		if (next) values[name] = next;
	}
	if (!draft.edited.includes("followUpOn") && !values.followUpOn)
		values.followUpOn = defaultFollowUpDay(capture.validThrough, day);
	return { ...draft, values };
}

/** Applies the person's change and remembers which fields they touched. */
export function editDraft(draft: Draft, patch: Partial<DraftValues>): Draft {
	const names = Object.keys(patch) as (keyof DraftValues)[];
	return {
		...draft,
		values: { ...draft.values, ...patch },
		edited: [...new Set([...draft.edited, ...names])],
	};
}

/** A draft as stored, when it belongs to this posting and still has the shape this version writes. */
export function readDraft(value: unknown, identity: string): Draft | null {
	const draft = value as Partial<Draft> | null | undefined;
	if (
		!draft ||
		draft.identity !== identity ||
		!draft.values ||
		typeof draft.values !== "object" ||
		!Array.isArray(draft.edited)
	)
		return null;
	const values = draft.values as Partial<DraftValues>;
	if (typeof values.role !== "string" || typeof values.company !== "string" || !Array.isArray(values.tags)) return null;
	// Drafts written before reminders existed (an update while a tab kept one) get empty reminder fields.
	return {
		...(draft as Draft),
		values: {
			...(values as DraftValues),
			followUpOn: typeof values.followUpOn === "string" ? values.followUpOn : "",
			followUpNote: typeof values.followUpNote === "string" ? values.followUpNote : "",
		},
	};
}

export const contactId = (contact: SuggestedContact) => `${contact.type}:${contact.value}`;

const SITE_NAMES: Record<JobSite, string> = {
	linkedin: "LinkedIn",
	indeed: "Indeed",
	jobstreet: "JobStreet",
	glints: "Glints",
};

/** Where the posting came from, as the tracker's "Source" shows it: the board's name, else the site's host. */
export function sourceName(site: JobSite | null, url: string): string {
	if (site) return SITE_NAMES[site];
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

/** The kind of employment joins the location ("Jakarta · Full-time"), as remote work does: the tracker has no field for it. */
export function locationWithType(location: string, employmentType: string): string {
	const place = location.trim();
	const kind = employmentType.trim();
	if (!kind || place.toLowerCase().includes(kind.toLowerCase())) return place;
	return [place, kind].filter(Boolean).join(" · ");
}

type SaveContext = {
	site: JobSite | null;
	/** The posting's permanent address (the server's `sourceUrl` from `readCapture`, else the page's canonical one). */
	sourceUrl: string;
	postingSource: PostingSource;
	requirements: string[];
	suggestions: SuggestedContact[];
};

/** The `applications.create` input for a draft. */
export function createInput(draft: Draft, context: SaveContext) {
	const { values } = draft;
	const company = values.company.trim();
	const contacts = context.suggestions
		.filter((contact) => values.contacts.includes(contactId(contact)))
		.map((contact) => ({
			name: company || "HR",
			role: "",
			type: "Recruiter",
			email: contact.type === "email" ? contact.value : "",
			phone: contact.type === "phone" ? contact.value : "",
		}));
	const location = locationWithType(values.location, values.employmentType);
	const reminder = followUpAt(values.followUpOn);
	return {
		role: values.role.trim(),
		company,
		...(location ? { location } : {}),
		...(values.salary.trim() ? { salary: values.salary.trim() } : {}),
		source: sourceName(context.site, context.sourceUrl) || null,
		sourceUrl: context.sourceUrl,
		jobDescription: values.description.trim().slice(0, 20_000) || null,
		postingSource: context.postingSource,
		requirements: context.requirements.slice(0, 30),
		resumeId: values.resumeId || null,
		tags: values.tags,
		contacts,
		status: values.status,
		...(values.status === "applied" ? { stageEnteredAt: values.appliedOn } : {}),
		...(reminder ? { followUpAt: reminder, followUpNote: values.followUpNote.trim().slice(0, 500) || null } : {}),
	};
}

/** Whether the draft can be saved: the tracker needs a role and a company. */
export const canSave = (draft: Draft) => Boolean(draft.values.role.trim() && draft.values.company.trim());
