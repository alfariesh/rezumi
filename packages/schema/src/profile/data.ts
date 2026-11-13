import type { SectionType } from "../resume/data";
import z from "zod";
import {
	awardItemSchema,
	basicsSchema,
	certificationItemSchema,
	educationItemSchema,
	experienceItemSchema,
	interestItemSchema,
	languageItemSchema,
	profileItemSchema,
	projectItemSchema,
	publicationItemSchema,
	referenceItemSchema,
	skillItemSchema,
	volunteerItemSchema,
} from "../resume/data";

/**
 * The account's Profile: the one place a person's details and career history are kept. Resumes, cover letters and the
 * portfolio take their content from it; each document may still replace any part with its own version.
 *
 * It holds content only, in the resume's own shapes (basics and section items), so a part moves between the Profile
 * and a resume unchanged. Design, layout, section titles and what a document hides stay with the document.
 */

/** The sections a Profile holds, in the order its editor lists them: every built-in resume section. */
export const PROFILE_SECTION_TYPES = [
	"experience",
	"education",
	"projects",
	"skills",
	"languages",
	"certifications",
	"awards",
	"publications",
	"volunteer",
	"interests",
	"profiles",
	"references",
] as const satisfies readonly SectionType[];

export type ProfileSectionType = (typeof PROFILE_SECTION_TYPES)[number];

/** The basics a document can take from the Profile or replace, one by one. */
export const PROFILE_BASICS_FIELDS = [
	"name",
	"headline",
	"email",
	"phone",
	"location",
	"website",
	"customFields",
] as const satisfies readonly (keyof z.infer<typeof basicsSchema>)[];

export type ProfileBasicsField = (typeof PROFILE_BASICS_FIELDS)[number];

/** One part of a document that can come from the Profile: a basics field, the photo, the summary or one item. */
export const profilePartSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("basics"), field: z.enum(PROFILE_BASICS_FIELDS) }),
	z.object({ kind: z.literal("picture") }),
	z.object({ kind: z.literal("summary") }),
	z.object({ kind: z.literal("item"), section: z.enum(PROFILE_SECTION_TYPES), id: z.string().min(1).max(64) }),
]);

export type ProfilePart = z.infer<typeof profilePartSchema>;

const itemSchemas = {
	experience: experienceItemSchema,
	education: educationItemSchema,
	projects: projectItemSchema,
	skills: skillItemSchema,
	languages: languageItemSchema,
	certifications: certificationItemSchema,
	awards: awardItemSchema,
	publications: publicationItemSchema,
	volunteer: volunteerItemSchema,
	interests: interestItemSchema,
	profiles: profileItemSchema,
	references: referenceItemSchema,
} as const satisfies Record<ProfileSectionType, z.ZodType>;

const emptyBasics = (): z.infer<typeof basicsSchema> => ({
	name: "",
	headline: "",
	email: "",
	phone: "",
	location: "",
	website: { url: "", label: "" },
	customFields: [],
});

const sectionsShape = <Lenient extends boolean>(lenient: Lenient) =>
	Object.fromEntries(
		PROFILE_SECTION_TYPES.map((type) => {
			const items = z.array(itemSchemas[type]);
			return [type, lenient ? items.catch(() => []) : items];
		}),
	) as unknown as { [Type in ProfileSectionType]: z.ZodType<z.infer<(typeof itemSchemas)[Type]>[]> };

const pictureSchema = z.object({
	url: z.string().describe("The person's photo. Prefer app-served paths (for example /uploads/...) set by an upload."),
});
const summarySchema = z.object({
	content: z.string().describe("The person's summary, as an HTML-formatted string."),
});

/** What a save must send: every part present and valid. */
export const profileDataSchema = z.object({
	basics: basicsSchema.describe("Name, headline and contact details."),
	picture: pictureSchema,
	summary: summarySchema,
	sections: z
		.object(sectionsShape(false))
		.describe("Career history by section. Items use the resume's item shapes; `hidden` is always false here."),
});

export type ProfileData = z.infer<typeof profileDataSchema>;
export type ProfileItem<Type extends ProfileSectionType = ProfileSectionType> = ProfileData["sections"][Type][number];

export const emptyProfileData = (): ProfileData => ({
	basics: emptyBasics(),
	picture: { url: "" },
	summary: { content: "" },
	sections: Object.fromEntries(PROFILE_SECTION_TYPES.map((type) => [type, []])) as unknown as ProfileData["sections"],
});

// Stored JSON may predate today's shapes: a part that no longer reads is replaced by its empty value, never an error.
const storedProfileDataSchema = z.object({
	basics: basicsSchema.catch(emptyBasics),
	picture: pictureSchema.catch(() => ({ url: "" })),
	summary: summarySchema.catch(() => ({ content: "" })),
	sections: z.object(sectionsShape(true)).catch(() => emptyProfileData().sections),
});

/** Reads stored Profile data. Anything unreadable comes back empty, so a Profile always opens. */
export const parseProfileData = (data: unknown): ProfileData => {
	const parsed = storedProfileDataSchema.safeParse(data ?? {});
	return parsed.success ? parsed.data : emptyProfileData();
};

/** Whether nothing was filled in yet: no basics, photo, summary or items. */
export const isProfileEmpty = (data: ProfileData): boolean =>
	!data.picture.url.trim() &&
	!data.summary.content.trim() &&
	!data.basics.name.trim() &&
	!data.basics.headline.trim() &&
	!data.basics.email.trim() &&
	!data.basics.phone.trim() &&
	!data.basics.location.trim() &&
	!data.basics.website.url.trim() &&
	data.basics.customFields.length === 0 &&
	PROFILE_SECTION_TYPES.every((type) => data.sections[type].length === 0);
