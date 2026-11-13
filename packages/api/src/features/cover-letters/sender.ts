import type { DbOrTx } from "@rezumi/db/client";
import type { CoverLetter, CoverLetterStyle } from "@rezumi/schema/cover-letter/data";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { and, eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { copyCoverLetterStyle } from "@rezumi/resume/cover-letter";
import { profileService } from "../profile/service";
import { parseStoredResumeData } from "../resume/resume-data-validation";

/** The sender details a letter takes from the Profile: its basics and photo; the photo's size and effects stay the letter's. */
export function profileSender(
	style: CoverLetterStyle,
	profile: ProfileData,
): Pick<CoverLetterStyle, "basics" | "picture"> {
	return { basics: structuredClone(profile.basics), picture: { ...style.picture, url: profile.picture.url } };
}

/**
 * A letter as it reads now. Its sender details come live from its source resume when it has one, else from the
 * account's Profile, while `senderLinked`; its design comes live from the resume while `designLinked`. Otherwise, and
 * when the resume can't be read, the copies the letter keeps in `style` stand in.
 *
 * A source resume in Trash still counts: it can't change there, so the letter reads the same in the editor and in the
 * version an application records as sent, and restoring the resume changes nothing. The one resolver for both, so
 * those two never disagree.
 *
 * `lock` takes the source resume's row for the caller's transaction (recording a sent version), so an edit in flight
 * lands either wholly before or after the copy.
 */
export async function resolveLetterLinks(
	letter: CoverLetter,
	userId: string,
	options: { client?: DbOrTx; lock?: boolean } = {},
): Promise<CoverLetter> {
	const client = options.client ?? db;
	if (!letter.sourceResumeId) {
		if (!letter.senderLinked) return letter;
		const { data } = await profileService.read(userId, client);
		return { ...letter, style: { ...letter.style, ...profileSender(letter.style, data) } };
	}
	if (!letter.senderLinked && !letter.designLinked) return letter;

	const query = client
		.select({ data: schema.resume.data })
		.from(schema.resume)
		.where(and(eq(schema.resume.id, letter.sourceResumeId), eq(schema.resume.userId, userId)));
	const [resume] = await (options.lock ? query.for("update") : query);
	if (!resume) return letter;

	let linked: CoverLetterStyle;
	try {
		linked = copyCoverLetterStyle(parseStoredResumeData(resume.data), letter.style.sectionId, letter.style.itemId);
	} catch {
		return letter;
	}
	return {
		...letter,
		style: {
			...letter.style,
			...(letter.senderLinked ? { basics: linked.basics, picture: linked.picture } : {}),
			...(letter.designLinked ? { metadata: linked.metadata } : {}),
		},
	};
}
