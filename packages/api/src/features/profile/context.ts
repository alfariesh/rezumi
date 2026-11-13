import type { DbOrTx } from "@rezumi/db/client";
import type { ProfileData, ProfileSectionType } from "@rezumi/schema/profile/data";
import { db } from "@rezumi/db/client";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { isProfileEmpty } from "@rezumi/schema/profile/data";
import { profileService } from "./service";

/**
 * How much of the Profile an AI prompt takes, in characters: room for a long career without crowding out the posting,
 * the other context and the reply. The same budget a resume gets in the career prompts.
 */
export const PROFILE_CONTEXT_CHARS = 10_000;

// The model reads section names in English; the Profile has no titles of its own.
const TITLES: Record<ProfileSectionType | "summary", string> = {
	summary: "Summary",
	experience: "Experience",
	education: "Education",
	projects: "Projects",
	skills: "Skills",
	languages: "Languages",
	certifications: "Certifications",
	awards: "Awards",
	publications: "Publications",
	volunteer: "Volunteering",
	interests: "Interests",
	profiles: "Profiles",
	references: "References",
};

/**
 * The Profile as Markdown for an AI prompt, cut at `limit` characters with a note saying so, so the model never
 * reads a cut career as all there is. Empty while the Profile holds nothing.
 */
export function profileMarkdown(profile: ProfileData, limit = PROFILE_CONTEXT_CHARS): string {
	if (isProfileEmpty(profile)) return "";
	let text: string;
	try {
		text = buildMarkdown(resumeDataFromProfile(profile), (id) => TITLES[id as keyof typeof TITLES]).trim();
	} catch {
		// Past the render budget: too long to print, and far past what a prompt takes anyway.
		return "";
	}
	if (text.length <= limit) return text;
	return `${text.slice(0, limit).trimEnd()}\n\n[The rest of the Profile is left out here.]`;
}

/** The account's Profile for an AI prompt (`profileMarkdown`), with its version; null while it holds nothing. */
export async function readProfileContext(
	userId: string,
	client: DbOrTx = db,
): Promise<{ text: string; updatedAt: Date | null } | null> {
	const { data, updatedAt } = await profileService.read(userId, client);
	const text = profileMarkdown(data);
	return text ? { text, updatedAt } : null;
}
