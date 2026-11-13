import type { SourceNote, SourceResult } from "@rezumi/schema/profile/sources";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { profileFromResume } from "@rezumi/resume/profile";

/**
 * A source's resume data as its result: Profile data with every item's ID, and the photo apart, since an address at
 * another site (often one that expires) is no photo to keep until `adoptPhoto` copies it.
 */
export function sourceResult(data: ResumeData, notes: SourceNote[] = []): SourceResult {
	const profile = profileFromResume(data);
	const photoUrl = profile.picture.url.trim() || null;
	profile.picture.url = "";
	return { data: profile, photoUrl, notes };
}

/** A deadline for one outbound read, together with the request's own cancellation. */
export function sourceDeadline(milliseconds: number, signal?: AbortSignal | undefined): AbortSignal {
	const timeout = AbortSignal.timeout(milliseconds);
	return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

/** Whether a read stopped at its deadline rather than because the caller went away. */
export const timedOut = (error: unknown) => error instanceof DOMException && error.name === "TimeoutError";
