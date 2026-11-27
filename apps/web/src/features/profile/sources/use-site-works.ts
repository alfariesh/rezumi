import type { SiteWorksDone, SiteWorksProgress } from "./site-import";
import type { WebsiteImportResult } from "@rezumi/schema/profile/website-import";
import type { ProjectItem } from "@rezumi/schema/resume/data";
import { plural, t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { saveSiteWorks, useDraftChoice, useSiteWorksRoom } from "./site-import";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { portfolioErrorMessage } from "@/features/portfolio/errors";
import { profileQueryOptions } from "@/features/profile/queries";
import { orpc } from "@/libs/orpc/client";

/**
 * An import's works from review to the portfolio: which are ticked (within the plan's room, without those the
 * portfolio has), then saving them with the pictures' progress. Saving also adds their Profile projects, so the
 * Profile and portfolio queries are refreshed after it.
 */
export function useSiteWorks(
	result: WebsiteImportResult | null,
	projects: readonly Pick<ProjectItem, "id" | "name" | "website">[],
) {
	const queryClient = useQueryClient();
	const room = useSiteWorksRoom(result?.works ?? [], projects);
	const choice = useDraftChoice(result, room.imported, room.room);
	const [progress, setProgress] = useState<SiteWorksProgress | null>(null);

	/** Saves the ticked works; resolves with what happened, or null when nothing was saved (and says why). */
	const save = async (): Promise<SiteWorksDone | null> => {
		const ids = choice.ids();
		if (!result || ids.length === 0) return null;
		setProgress({ type: "saving" });
		try {
			const done = await saveSiteWorks(result.runId, ids, setProgress);
			const note = siteWorksNote(done);
			if (note) toast.add({ type: "warning", description: note });
			return done;
		} catch (error) {
			if (!openPlanDialogForError(error))
				toast.add({
					type: "error",
					description:
						error instanceof ORPCError
							? portfolioErrorMessage(error, { fallback: t`Couldn't save your works. Try again from your portfolio.` })
							: t`Couldn't save your works. Check your connection, then try again from your portfolio.`,
				});
			return null;
		} finally {
			setProgress(null);
			void queryClient.invalidateQueries({ queryKey: orpc.portfolio.key() });
			void queryClient.invalidateQueries({ queryKey: profileQueryOptions().queryKey });
		}
	};

	return {
		works: result?.works ?? [],
		room,
		chosen: choice.chosen,
		toggle: choice.toggle,
		count: choice.chosen.size,
		/** Saving's progress, while it runs. */
		progress,
		saving: progress !== null,
		save,
	};
}

/** What didn't fully come along when works were saved, or null when everything did. */
function siteWorksNote(done: SiteWorksDone): string | null {
	if (done.storageFull) return t`Your portfolio's storage is full, so some works were saved without their pictures.`;
	if (done.picturesSkipped > 0)
		return plural(done.picturesSkipped, {
			one: "# picture couldn't be copied. The works were saved without it.",
			other: "# pictures couldn't be copied. The works were saved without them.",
		});
	return null;
}

/** "Copying pictures 12 of 30…" while works are saved. */
export function siteWorksProgressLabel(progress: SiteWorksProgress): string {
	if (progress.type === "picture" && progress.total > 0)
		return t`Copying pictures ${progress.done} of ${progress.total}…`;
	return t`Saving your works…`;
}
