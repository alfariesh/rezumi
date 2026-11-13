import type { SourceId, SourceRequest, SourceRun, SourceRuns } from "./model";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { t } from "@lingui/core/macro";
import { useRef, useState } from "react";
import { profileFromResume } from "@rezumi/resume/profile";
import { keepRequested, requestsToRun } from "./model";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { detectImportKind, ImportError } from "@/features/resume/import/read-file";
import { requireImportKind, useReadResumeFile } from "@/features/resume/import/use-read-resume-file";
import { client } from "@/libs/orpc/client";

/**
 * Runs the chosen sources side by side. Each has its own state (loading, done or failed) and its own Retry; a newer
 * run of a source drops what an older one brings back. Nothing is saved here: results wait for review.
 */
export function useSourceRuns() {
	const readFile = useReadResumeFile();
	const ai = useAiSource();
	const [runs, setRuns] = useState<SourceRuns>({});
	const attempts = useRef(new Map<SourceId, number>());
	const requests = useRef(new Map<SourceId, SourceRequest>());
	// The latest runs, for what to start when Continue is pressed; every change goes through `update`.
	const latest = useRef<SourceRuns>({});
	const update = (change: (previous: SourceRuns) => SourceRuns) => {
		latest.current = change(latest.current);
		setRuns(latest.current);
	};

	const fetchSource = async (request: SourceRequest): Promise<SourceResult> => {
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

	const settle = (id: SourceId, attempt: number, run: SourceRun) => {
		if (attempts.current.get(id) !== attempt) return;
		update((previous) => ({ ...previous, [id]: run }));
	};

	const start = (request: SourceRequest) => {
		const attempt = (attempts.current.get(request.id) ?? 0) + 1;
		attempts.current.set(request.id, attempt);
		requests.current.set(request.id, request);
		update((previous) => ({ ...previous, [request.id]: { status: "loading", key: request.key } }));
		fetchSource(request).then(
			(result) => settle(request.id, attempt, { status: "done", key: request.key, result }),
			(error: unknown) => {
				if (attempts.current.get(request.id) !== attempt) return;
				// Reading a file or a website with AI can run out of credits or need a plan: the usual dialogs explain.
				if (!openPlanDialogForError(error)) openCreditsDialogForError(error);
				settle(request.id, attempt, { status: "failed", key: request.key, error });
			},
		);
	};

	return {
		runs,
		/** Starts what's new, changed or failed in `wanted`, and forgets sources no longer wanted. */
		run: (wanted: SourceRequest[]) => {
			const pending = requestsToRun(wanted, latest.current);
			const kept = new Set(wanted.map((request) => request.id));
			// A source cleared while it runs: its answer no longer matches the latest attempt, so it's dropped.
			for (const [id, attempt] of attempts.current) if (!kept.has(id)) attempts.current.set(id, attempt + 1);
			update((previous) => keepRequested(previous, wanted));
			for (const request of pending) start(request);
		},
		retry: (id: SourceId) => {
			const request = requests.current.get(id);
			if (request) start(request);
		},
	};
}
