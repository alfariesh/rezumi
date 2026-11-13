import type { Transaction } from "../billing/account";
import type { DbOrTx } from "@rezumi/db/client";
import type { ProfileData, ProfilePart } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { ORPCError } from "@orpc/client";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import {
	completeProfile,
	followProfile,
	profileFromResume,
	resumeDataFromProfile,
	sameContent,
	saveToProfile,
} from "@rezumi/resume/profile";
import { emptyProfileData, parseProfileData } from "@rezumi/schema/profile/data";
import { syncResumeDates } from "@rezumi/schema/resume/dates";
import { lockUser } from "../documents/ownership";
import { publishResumeUpdated } from "../resume/events";
import { parseStoredResumeData, parseWritableResumeData } from "../resume/resume-data-validation";

/**
 * The account's Profile (`@rezumi/schema/profile/data`): one place for a person's details and career history.
 *
 * Reading: `read` is what every other feature uses (a new resume, a letter's sender, the portfolio, AI context).
 * Writing: every change goes through `write`, which saves the Profile and, in the same transaction, carries the
 * change into each resume part still linked to it (`followProfile`). Resumes in Trash and locked resumes are never
 * touched; cover letters and the portfolio read their source live, so they need no write.
 */

export type ProfileDto = {
	data: ProfileData;
	/** The version to send back with a save; null while the Profile was never saved. */
	updatedAt: Date | null;
};

export type ProfileSaveResult = ProfileDto & {
	/** The resumes that followed this change, for the editor's "updated in N resumes" note. */
	updatedResumes: { id: string; name: string }[];
};

type ChangedResume = { id: string; name: string; updatedAt: Date };

const conflict = (updatedAt: Date | null) =>
	new ORPCError("PROFILE_VERSION_CONFLICT", {
		status: 409,
		message: "The Profile changed after it was read. Read it again, then save.",
		data: { updatedAt: updatedAt?.toISOString() ?? null },
	});

/**
 * Profile data as it is stored: checked against the resume's own write rules (sizes, ids, rich text), with each
 * entry's date text written from its structured dates. BAD_REQUEST when it doesn't pass.
 */
function canonicalProfileData(data: ProfileData): ProfileData {
	try {
		return profileFromResume(parseWritableResumeData(resumeDataFromProfile(data)));
	} catch (cause) {
		throw new ORPCError("BAD_REQUEST", { status: 400, message: "The Profile data isn't valid.", cause });
	}
}

/** What an account that never saved a Profile starts with: the name and email it signed up with. */
async function initialProfileData(client: DbOrTx, userId: string): Promise<ProfileData> {
	const [owner] = await client
		.select({ name: schema.user.name, email: schema.user.email, isAnonymous: schema.user.isAnonymous })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	const data = emptyProfileData();
	// A guest's name and address are generated, not theirs.
	if (owner && !owner.isAnonymous) {
		data.basics.name = owner.name.trim();
		data.basics.email = owner.email.trim();
	}
	return data;
}

async function readProfile(client: DbOrTx, userId: string): Promise<ProfileDto> {
	const [row] = await client
		.select({ data: schema.profile.data, updatedAt: schema.profile.updatedAt })
		.from(schema.profile)
		.where(eq(schema.profile.userId, userId));
	if (row) return { data: parseProfileData(row.data), updatedAt: row.updatedAt };
	return { data: await initialProfileData(client, userId), updatedAt: null };
}

/** Carries a Profile change into the account's editable resumes. Unreadable resumes are skipped, never an error. */
async function updateLinkedResumes(tx: Transaction, userId: string, before: ProfileData, after: ProfileData) {
	const resumes = await tx
		.select({ id: schema.resume.id, name: schema.resume.name, data: schema.resume.data })
		.from(schema.resume)
		.where(and(eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt), eq(schema.resume.isLocked, false)))
		.for("update");

	const changed: ChangedResume[] = [];
	for (const resume of resumes) {
		let current: ResumeData;
		try {
			current = parseStoredResumeData(resume.data);
		} catch {
			continue;
		}
		const next = followProfile(current, before, after);
		if (!next) continue;
		// The items it took carry the Profile's date text; write this resume's own, in its language and format.
		syncResumeDates(next);
		const [row] = await tx
			.update(schema.resume)
			.set({ data: next })
			.where(eq(schema.resume.id, resume.id))
			.returning({ updatedAt: schema.resume.updatedAt });
		if (row) changed.push({ id: resume.id, name: resume.name, updatedAt: row.updatedAt });
	}
	return changed;
}

/**
 * The one way the Profile changes. Under the account's lock: reads the Profile, lets `build` produce the next data
 * (null: nothing to change), saves it with a new version and updates the linked resumes.
 */
async function write(
	tx: Transaction,
	userId: string,
	build: (current: ProfileDto) => ProfileData | null | Promise<ProfileData | null>,
): Promise<ProfileDto & { changed: ChangedResume[] }> {
	await lockUser(tx, userId);
	const current = await readProfile(tx, userId);
	const built = await build(current);
	if (!built) return { ...current, changed: [] };

	const data = canonicalProfileData(built);
	if (current.updatedAt && sameContent(data, current.data)) return { ...current, changed: [] };

	// Always later than the version replaced, even within one millisecond or with a server clock behind another's.
	const updatedAt = new Date(Math.max(Date.now(), (current.updatedAt?.getTime() ?? 0) + 1));
	await tx
		.insert(schema.profile)
		.values({ userId, data, updatedAt })
		.onConflictDoUpdate({ target: schema.profile.userId, set: { data, updatedAt } });

	const changed = await updateLinkedResumes(tx, userId, current.data, data);
	return { data, updatedAt, changed };
}

async function announce(userId: string, changed: ChangedResume[]) {
	await Promise.all(
		changed.map((resume) =>
			publishResumeUpdated({
				type: "resume.updated",
				resumeId: resume.id,
				userId,
				updatedAt: resume.updatedAt.toISOString(),
				mutation: "profile",
			}).catch((error: unknown) => console.warn("Failed to publish resume.updated event:", error)),
		),
	);
}

async function save(
	userId: string,
	build: (current: ProfileDto) => ProfileData | null | Promise<ProfileData | null>,
): Promise<ProfileSaveResult> {
	const { changed, ...profile } = await db.transaction((tx) => write(tx, userId, build));
	await announce(userId, changed);
	return { ...profile, updatedResumes: changed.map(({ id, name }) => ({ id, name })) };
}

/** A resume the account owns that isn't in Trash, read at its current shape. NOT_FOUND otherwise. */
async function activeResumeData(client: DbOrTx, userId: string, resumeId: string): Promise<ResumeData> {
	const [row] = await client
		.select({ data: schema.resume.data })
		.from(schema.resume)
		.where(and(eq(schema.resume.id, resumeId), eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt)));
	if (!row) throw new ORPCError("NOT_FOUND");
	return parseStoredResumeData(row.data);
}

export const profileService = {
	/** The account's Profile, or what it starts with (name and email) while it was never saved. */
	read: (userId: string, client: DbOrTx = db): Promise<ProfileDto> => readProfile(client, userId),

	/**
	 * Saves the editor's data. With `expectedUpdatedAt` (null: "I read it before its first save"), a Profile changed
	 * elsewhere in the meantime is a PROFILE_VERSION_CONFLICT instead of being overwritten.
	 */
	update: (userId: string, input: { data: ProfileData; expectedUpdatedAt?: Date | null | undefined }) =>
		save(userId, (current) => {
			if (
				input.expectedUpdatedAt !== undefined &&
				(input.expectedUpdatedAt?.getTime() ?? null) !== (current.updatedAt?.getTime() ?? null)
			)
				throw conflict(current.updatedAt);
			return input.data;
		}),

	/** "Save to Profile": makes one resume's version of a part the Profile's, which every linked resume then follows. */
	savePart: (userId: string, input: { resumeId: string; part: ProfilePart }) =>
		save(userId, async (current) =>
			saveToProfile(current.data, await activeResumeData(db, userId, input.resumeId), input.part),
		),

	/** Fills what the Profile still lacks (blank basics, photo, summary, empty sections) from one resume. */
	fillFromResume: (userId: string, input: { resumeId: string }) =>
		save(userId, async (current) => completeProfile(current.data, await activeResumeData(db, userId, input.resumeId))),

	/**
	 * As `fillFromResume`, for data already at hand (an import). Best effort by design: the caller's own work must
	 * not fail because the Profile couldn't take the data.
	 */
	completeFrom: async (userId: string, data: ResumeData): Promise<void> => {
		try {
			await save(userId, (current) => completeProfile(current.data, data));
		} catch (error) {
			console.warn("Couldn't complete the Profile from a resume:", error);
		}
	},
};
