import type { AuthSession } from "@rezumi/auth/types";
import type { QueryClient } from "@tanstack/react-query";
import { needsOnboarding } from "@rezumi/career/onboarding";
import { profileQueryOptions } from "@/features/profile/queries";
import { orpc } from "@/libs/orpc/client";

/**
 * Whether Home should hand over to onboarding, from the cached Profile and documents when there are any. The documents
 * are only read for a Profile never saved. A failed read never blocks Home: it just opens.
 */
export async function shouldStartOnboarding(queryClient: QueryClient, session: AuthSession | null) {
	if (!session || session.user.isAnonymous) return false;
	try {
		const profile = await queryClient.ensureQueryData(profileQueryOptions());
		if (profile.updatedAt !== null) return false;
		const documents = await queryClient.ensureQueryData(
			orpc.documents.list.queryOptions({ input: { trashed: false } }),
		);
		return needsOnboarding({ isGuest: false, profileUpdatedAt: profile.updatedAt, documentCount: documents.length });
	} catch {
		return false;
	}
}
