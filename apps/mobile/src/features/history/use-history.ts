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

/** The newest "Before restore" version, by the server's clock. */
const newestBeforeRestore = (versions: readonly Version[]) =>
	versions
		.filter((version) => version.kind === "before-restore")
		.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

/**
 * A resume's versions, and saving, restoring, renaming and deleting them. Callers run these through
 * `useDocumentOperations`, which checks the session and network and words failures.
 */
export function useHistory(resumeId: string, offline: boolean) {
	const queryClient = useQueryClient();
	const options = orpc.resume.listVersions.queryOptions({ input: { resumeId } });
	const list = useQuery({ ...options, enabled: !offline });
	const refresh = () => queryClient.invalidateQueries({ queryKey: options.queryKey });

	return {
		list,
		save: async (name: string) => {
			await flushResume(resumeId);
			await client.resume.createVersion({ resumeId, name });
			void refresh();
		},
		/**
		 * Restores a version. The server saves the current state as "Before restore" first; this returns that version's
		 * id (null when it can't be read back) so Undo restores exactly it.
		 */
		restore: async (versionId: string): Promise<string | null> => {
			const scope = await getDraftScope();
			await flushResume(resumeId);
			await client.resume.restoreVersion({ resumeId, versionId });
			await reopen(resumeId, scope);
			let before: string | null = null;
			try {
				const versions = await client.resume.listVersions({ resumeId });
				queryClient.setQueryData(options.queryKey, versions);
				before = newestBeforeRestore(versions)?.id ?? null;
			} catch {
				// The restore succeeded; only its Undo is unavailable.
				void refresh();
			}
			return before;
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
