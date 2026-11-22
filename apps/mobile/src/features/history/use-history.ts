import type { Version } from "./format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/api/client";
import { getDraftScope, useResumeStore } from "@/draft";
import { flushResume } from "@/features/share/document";

/** Loads the restored copy into the builder's draft, if the person is still on this resume in the same account. */
async function reopen(resumeId: string, scope: string | null) {
	if ((await getDraftScope()) === scope && useResumeStore.getState().document?.id === resumeId)
		await useResumeStore.getState().open(resumeId);
}

/**
 * A resume's versions, and saving, restoring, renaming and deleting them. Restoring saves the current state as
 * "Before restore" first (on the server), so `undoRestore` restores that one.
 */
export function useHistory(resumeId: string, offline: boolean) {
	const queryClient = useQueryClient();
	const options = orpc.resume.listVersions.queryOptions({ input: { resumeId } });
	const list = useQuery({ ...options, enabled: !offline });
	const refresh = () => queryClient.invalidateQueries({ queryKey: options.queryKey });

	const restoreVersion = async (versionId: string) => {
		const scope = await getDraftScope();
		await flushResume(resumeId);
		await client.resume.restoreVersion({ resumeId, versionId });
		await reopen(resumeId, scope);
		void refresh();
	};

	return {
		list,
		save: async (name: string) => {
			await flushResume(resumeId);
			await client.resume.createVersion({ resumeId, name });
			void refresh();
		},
		restore: restoreVersion,
		/** Restores the newest "Before restore" version saved since `since`. */
		undoRestore: async (since: Date) => {
			const versions: Version[] = await client.resume.listVersions({ resumeId });
			const before = versions
				.filter((version) => version.kind === "before-restore" && version.createdAt.getTime() >= since.getTime())
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
			if (!before) throw new Error("No version to go back to");
			await restoreVersion(before.id);
		},
		rename: async (versionId: string, name: string) => {
			await client.resume.renameVersion({ resumeId, versionId, name });
			void refresh();
		},
		remove: async (versionId: string) => {
			await client.resume.deleteVersion({ resumeId, versionId });
			void refresh();
		},
	};
}
