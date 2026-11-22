import type { SourceId, SourceRequest, SourceRuns } from "@rezumi/resume/profile-sources";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { profileFromResume } from "@rezumi/resume/profile";
import { createSourceRunner } from "@rezumi/resume/profile-sources";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { detectImportKind, ImportError } from "@/features/resume/import/read-file";
import { requireImportKind, useReadResumeFile } from "@/features/resume/import/use-read-resume-file";
import { client } from "@/libs/orpc/client";

/**
 * Runs the chosen sources side by side (`createSourceRunner`): each has its own state and its own Retry, and nothing
 * is saved here: results wait for review.
 */
export function useSourceRuns() {
	const readFile = useReadResumeFile();
	const ai = useAiSource();
	const [runs, setRuns] = useState<SourceRuns>({});

	const fetchSource = async (request: SourceRequest<File>): Promise<SourceResult> => {
		switch (request.id) {
			case "file": {
				const kind = requireImportKind(await detectImportKind(request.file));
				if (kind === "cover-letter-json")
					throw new ImportError(t`This is a cover letter. Add a resume or a LinkedIn export instead.`);
				return { data: profileFromResume(await readFile(request.file, kind)), photoUrl: null, notes: [] };
			}
			case "linkedin":
				return client.profile.sources.linkedin({ url: request.url });
			case "github":
				return client.profile.sources.github({ username: request.username });
			case "website":
				return client.profile.sources.website({ url: request.url, ...aiSourceFields(ai) });
		}
	};
	// The runner lives as long as the screen; each run and retry hands it this render's reader.
	const [runner] = useState(() =>
		createSourceRunner<File>({
			onChange: setRuns,
			// Reading a file or a website with AI can run out of credits or need a plan: the usual dialogs explain.
			onError: (error) => {
				if (!openPlanDialogForError(error)) openCreditsDialogForError(error);
			},
		}),
	);

	return {
		runs,
		run: (wanted: SourceRequest<File>[]) => runner.run(wanted, fetchSource),
		retry: (id: SourceId) => runner.retry(id, fetchSource),
	};
}
