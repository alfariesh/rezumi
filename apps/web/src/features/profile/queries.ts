import type { RouterOutput } from "@/libs/orpc/client";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { QueryClient } from "@tanstack/react-query";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { stripHtml } from "@rezumi/utils/string";
import { orpc } from "@/libs/orpc/client";

/** The account's Profile as read: its data and version (`updatedAt`, null until the first save). */
export type ProfileDto = RouterOutput["profile"]["get"];

/** What a save returns: the Profile and the resumes whose linked parts followed it. */
export type ProfileSaveResult = RouterOutput["profile"]["update"];

export const profileQueryOptions = () => orpc.profile.get.queryOptions();

/**
 * After a save, every reader of the Profile (the editor, the builder's markers, the portfolio editor) sees the new
 * version, and the resumes that followed it are read again.
 */
export function storeSavedProfile(queryClient: QueryClient, result: ProfileSaveResult) {
	queryClient.setQueryData(orpc.profile.get.queryKey(), { data: result.data, updatedAt: result.updatedAt });
	if (result.updatedResumes.length === 0) return;
	void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
	for (const resume of result.updatedResumes)
		void queryClient.invalidateQueries({ queryKey: orpc.resume.getById.queryKey({ input: { id: resume.id } }) });
}

/** Whether the Profile has a career to draw on (a summary or any entry), beyond the name and email it starts with. */
export const profileHasCareer = (data: ProfileData) =>
	Boolean(stripHtml(data.summary.content).trim()) ||
	PROFILE_SECTION_TYPES.some((type) => data.sections[type].length > 0);
