import type { DocumentSummary } from "./filter";
import { publicResumeUrl } from "@rezumi/resume/sharing";
import { useFlags } from "@/api/flags";
import { getServer } from "@/auth/session";
import { useProfile } from "@/features/account/queries";

/** A resume's public address while its link is on, otherwise null. Uses the app's alias when the server has one. */
export function usePublicLink(document: DocumentSummary | null) {
	const profile = useProfile();
	const flags = useFlags();
	const username = profile.data?.username;
	if (!document || document.type !== "resume" || !document.isPublic || !document.slug || !username) return null;
	return publicResumeUrl(flags.data?.aliasUrl ?? getServer(), { username, slug: document.slug });
}
