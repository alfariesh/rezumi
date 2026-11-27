import type { SiteImportProgress } from "./site-import";
import type { SourceId, SourceRequest, SourceRuns } from "@rezumi/resume/profile-sources";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import type { WebsiteImportResult } from "@rezumi/schema/profile/website-import";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { profileFromResume } from "@rezumi/resume/profile";
import { createSourceRunner } from "@rezumi/resume/profile-sources";
import { importSite } from "./site-import";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { detectImportKind, ImportError } from "@/features/resume/import/read-file";
import { requireImportKind, useReadResumeFile } from "@/features/resume/import/use-read-resume-file";
import { client } from "@/libs/orpc/client";

/** The website import of the latest run: its progress while it runs, then its result (the work drafts). */
export type SiteImportState = { key: string; progress: SiteImportProgress | null; result: WebsiteImportResult | null };

/**
 * Runs the chosen sources side by side (`createSourceRunner`): each has its own state and its own Retry, and nothing
 * is saved here: results wait for review. A website the person owns is imported (`websiteImport`): its progress and
 * its work drafts come with `site`; only one import runs at a time, and one no longer wanted (or the screen closing)
 * stops it, so its credits come back.
 */
export function useSourceRuns() {
	const readFile = useReadResumeFile();
	const ai = useAiSource();
	const [runs, setRuns] = useState<SourceRuns>({});
	const [site, setSite] = useState<SiteImportState | null>(null);
	const siteRun = useRef<{ key: string; controller: AbortController } | null>(null);

	useEffect(() => () => siteRun.current?.controller.abort(), []);

	const stopSite = (keep?: string) => {
		if (siteRun.current && siteRun.current.key !== keep) {
			siteRun.current.controller.abort();
			siteRun.current = null;
		}
	};

	const fetchSite = async (key: string, url: string): Promise<SourceResult> => {
		siteRun.current?.controller.abort();
		const current = { key, controller: new AbortController() };
		siteRun.current = current;
		const update = (next: SiteImportState) => {
			if (siteRun.current === current) setSite(next);
		};
		update({ key, progress: null, result: null });
		const result = await importSite(
			url,
			aiSourceFields(ai),
			(progress) => update({ key, progress, result: null }),
			current.controller.signal,
		);
		update({ key, progress: null, result });
		return result.profile;
	};

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
				if (request.own) return fetchSite(request.key, request.url);
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

	const website = runs.website;
	return {
		runs,
		/** The import behind the website's run, while that run is the latest one. */
		site: site && website?.key === site.key ? site : null,
		run: (wanted: SourceRequest<File>[]) => {
			const own = wanted.find((request) => request.id === "website" && request.own);
			stopSite(own?.key);
			runner.run(wanted, fetchSource);
		},
		retry: (id: SourceId) => runner.retry(id, fetchSource),
	};
}
