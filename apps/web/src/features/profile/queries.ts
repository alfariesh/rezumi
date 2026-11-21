import type { RouterOutput } from "@/libs/orpc/client";
import type { QueryClient } from "@tanstack/react-query";
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

export { profileHasCareer } from "@rezumi/resume/profile";
