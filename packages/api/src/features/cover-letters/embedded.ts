import type { Transaction } from "../billing/account";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { ORPCError } from "@orpc/client";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@rezumi/db/schema";
import { copyCoverLetterStyle, detachEmbeddedLetters } from "@rezumi/resume/cover-letter";
import { coverLetterSchema } from "@rezumi/schema/cover-letter/data";
import { assertDocumentCapacity } from "../billing/limits";
import { sanitizeCoverLetterHtml } from "./html";
import { writeLetterVersion } from "./versions";

/**
 * Letters are documents of their own. Older app versions, API clients, imported files and restored versions can
 * still hand the server a resume with cover-letter sections; each resume write passes through here first, so those
 * letters become saved letters (linked to the resume's details and design, as they read inside it) and the resume
 * keeps none. Run it in the transaction that writes the resume, so the letters and the resume save together.
 *
 * A letter already saved from the same item with the same text isn't saved twice, so a client that keeps sending
 * the section creates one letter. New letters count against the plan's limit, unless the caller already counted them
 * (`capacityChecked`). Mutates `data`.
 */
export async function adoptEmbeddedLetters(
	client: Transaction,
	input: { userId: string; resumeId: string; resumeName: string; data: ResumeData; capacityChecked?: boolean },
) {
	const sections = input.data.customSections.filter((section) => section.type === "cover-letter");
	if (sections.length === 0) return;
	const styleSize = JSON.stringify(copyCoverLetterStyle(input.data)).length;
	let expandedSize = 0;
	for (const section of sections)
		for (const item of section.items) {
			// Both the letter and its initial history snapshot retain the complete shared design.
			expandedSize +=
				2 * (styleSize + JSON.stringify(item).length + section.title.length + input.resumeName.length + 1024);
			if (expandedSize > 10_000_000)
				throw new ORPCError("BAD_REQUEST", {
					message: "Embedded cover letters are too large. Import fewer letters or reduce their shared design data.",
				});
		}
	const style = (sectionId: string, itemId: string) => copyCoverLetterStyle(input.data, sectionId, itemId);
	const letters = detachEmbeddedLetters(input.data);
	if (letters.length === 0) return;

	const existing = await client
		.select({ itemId: sql<string>`${schema.coverLetter.style}->>'itemId'`, content: schema.coverLetter.content })
		.from(schema.coverLetter)
		.where(
			and(
				eq(schema.coverLetter.userId, input.userId),
				eq(schema.coverLetter.sourceResumeId, input.resumeId),
				inArray(
					sql`${schema.coverLetter.style}->>'itemId'`,
					letters.map((letter) => letter.itemId),
				),
			),
		);

	const existingContents = new Map<string, Set<string>>();
	for (const row of existing) {
		const contents = existingContents.get(row.itemId) ?? new Set<string>();
		contents.add(sanitizeCoverLetterHtml(row.content));
		existingContents.set(row.itemId, contents);
	}
	// Letters the migration moved are stored as they were written, so both sides are compared cleaned.
	const added = letters
		.map((letter) => ({ letter, content: sanitizeCoverLetterHtml(letter.content) }))
		.filter(({ letter, content }) => !existingContents.get(letter.itemId)?.has(content));
	if (!input.capacityChecked) await assertDocumentCapacity(client, input.userId, { coverLetters: added.length });

	for (const { letter, content } of added) {
		const name = `${input.resumeName.trim() || "Resume"} — ${letter.title.trim() || "Cover letter"}`.slice(0, 100);
		const [row] = await client
			.insert(schema.coverLetter)
			.values({
				userId: input.userId,
				name,
				recipient: sanitizeCoverLetterHtml(letter.recipient),
				content,
				style: style(letter.sectionId, letter.itemId),
				layout: "freeform",
				sourceResumeId: input.resumeId,
				senderLinked: true,
				designLinked: true,
			})
			.returning();
		if (row)
			await writeLetterVersion(client, { letter: coverLetterSchema.parse(row), userId: input.userId, kind: "created" });
	}
}
