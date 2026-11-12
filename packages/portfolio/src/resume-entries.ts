import type {
	AwardItem,
	CertificationItem,
	CustomSectionItem,
	CustomSectionType,
	EducationItem,
	ExperienceItem,
	InterestItem,
	LanguageItem,
	ProfileItem,
	ProjectItem,
	PublicationItem,
	SkillItem,
	SummaryItem,
	VolunteerItem,
} from "@rezumi/schema/resume/data";

/**
 * A resume item as the page draws it, whatever its section: what it is, the line under it, when, its link, its text,
 * keywords and a job's roles. Sections name these parts differently (a position or a degree, a company, school,
 * issuer or a language's fluency), so each item type is read once here, by its own fields, and every theme draws the
 * same entries.
 */
export type PortfolioViewEntry = {
	id: string;
	/** What it is: a position, degree, name, title or language. */
	title: string;
	/** The line under it: where or from whom (company, school, issuer, publisher) or how well, then the place. */
	subtitle: string;
	/** When: a period or a date. */
	when: string;
	/** Rich text: the description (a summary item's content). */
	description: string;
	/** The item's own address, as the view made it safe; empty without one. */
	url: string;
	/** A skill's or an interest's keywords, without empty ones. */
	keywords: string[];
	/** A job's roles, in the resume's order. */
	roles: { id: string; title: string; when: string; description: string }[];
};

/**
 * A kind of resume section the page draws: every kind but cover letters and references. A new kind in the resume
 * schema doesn't build until `EntryItems` and `ENTRY_PARTS` map it.
 */
export type ResumeEntryKind = Exclude<CustomSectionType, "cover-letter" | "references">;

/** Each drawn kind's item type, so every field is read by its own name. */
type EntryItems = {
	experience: ExperienceItem;
	education: EducationItem;
	volunteer: VolunteerItem;
	projects: ProjectItem;
	skills: SkillItem;
	summary: SummaryItem;
	profiles: ProfileItem;
	languages: LanguageItem;
	interests: InterestItem;
	awards: AwardItem;
	certifications: CertificationItem;
	publications: PublicationItem;
};

/** One item's parts, besides its id. */
type EntryParts = Omit<PortfolioViewEntry, "id">;

/**
 * A field as text. Resume data is checked when it's saved, but a page can meet older or imported data, so a missing
 * field reads as empty rather than failing the page.
 */
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const joined = (...parts: string[]) => parts.filter(Boolean).join(" · ");
const urlOf = (item: { website?: { url?: unknown } }) => text(item.website?.url);
const keywordsOf = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

const parts = (values: Partial<EntryParts> & Pick<EntryParts, "title">): EntryParts => ({
	subtitle: "",
	when: "",
	description: "",
	url: "",
	keywords: [],
	roles: [],
	...values,
});

/** How each kind of item becomes an entry. */
const ENTRY_PARTS: { [K in ResumeEntryKind]: (item: EntryItems[K]) => EntryParts } = {
	experience: (item) =>
		parts({
			title: text(item.position) || text(item.company),
			subtitle: joined(text(item.position) ? text(item.company) : "", text(item.location)),
			when: text(item.period),
			description: text(item.description),
			url: urlOf(item),
			// Older or imported data may hold anything in the list: only objects are roles.
			roles: (Array.isArray(item.roles) ? item.roles : [])
				.filter((role): role is NonNullable<typeof role> => !!role && typeof role === "object")
				.map((role) => ({
					id: role.id,
					title: text(role.position),
					when: text(role.period),
					description: text(role.description),
				})),
		}),
	education: (item) => {
		const degree = [text(item.degree), text(item.area)].filter(Boolean).join(", ");
		return parts({
			title: degree || text(item.school),
			subtitle: joined(degree ? text(item.school) : "", text(item.location), text(item.grade)),
			when: text(item.period),
			description: text(item.description),
			url: urlOf(item),
		});
	},
	volunteer: (item) =>
		parts({
			title: text(item.organization),
			subtitle: text(item.location),
			when: text(item.period),
			description: text(item.description),
			url: urlOf(item),
		}),
	projects: (item) =>
		parts({ title: text(item.name), when: text(item.period), description: text(item.description), url: urlOf(item) }),
	skills: (item) => parts({ title: text(item.name), keywords: keywordsOf(item.keywords) }),
	summary: (item) => parts({ title: "", description: text(item.content) }),
	profiles: (item) =>
		parts({
			title: text(item.network) || text(item.username),
			subtitle: text(item.network) ? text(item.username) : "",
			url: urlOf(item),
		}),
	languages: (item) => parts({ title: text(item.language), subtitle: text(item.fluency) }),
	interests: (item) => parts({ title: text(item.name), keywords: keywordsOf(item.keywords) }),
	awards: (item) =>
		parts({
			title: text(item.title),
			subtitle: text(item.awarder),
			when: text(item.date),
			description: text(item.description),
			url: urlOf(item),
		}),
	certifications: (item) =>
		parts({
			title: text(item.title),
			subtitle: text(item.issuer),
			when: text(item.date),
			description: text(item.description),
			url: urlOf(item),
		}),
	publications: (item) =>
		parts({
			title: text(item.title),
			subtitle: text(item.publisher),
			when: text(item.date),
			description: text(item.description),
			url: urlOf(item),
		}),
};

/** Whether the page draws a resume section of this type (it leaves cover letters and references out). */
export function isResumeEntryKind(type: string): type is ResumeEntryKind {
	return Object.hasOwn(ENTRY_PARTS, type);
}

/** A resume section's items as the page draws them, read by the section's kind. */
export function resumeEntries<K extends ResumeEntryKind>(
	kind: K,
	items: readonly EntryItems[K][],
): PortfolioViewEntry[] {
	const toParts: (item: EntryItems[K]) => EntryParts = ENTRY_PARTS[kind];
	return items.map((item) => ({ id: item.id, ...toParts(item) }));
}

/**
 * A custom section's items as the page draws them, read as items of the section's type. The resume schema checks each
 * item against its section's type (`customSectionItemDefinitionByType`), but its TypeScript type doesn't pair the two.
 */
export function customSectionEntries(type: ResumeEntryKind, items: readonly CustomSectionItem[]): PortfolioViewEntry[] {
	return resumeEntries(type, items as readonly EntryItems[ResumeEntryKind][]);
}
