import type {
	SiteWorksEvent,
	WebsiteImportEvent,
	WebsiteImportResult,
	WorkDraft,
} from "@rezumi/schema/profile/website-import";
import type { ProjectItem } from "@rezumi/schema/resume/data";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { importedDrafts, initialDraftChoice, toggleDraft } from "@rezumi/portfolio/site-import";
import { PLANS } from "@rezumi/schema/billing";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { usePlan } from "@/features/billing/plan";
import { orpc, streamClient } from "@/libs/orpc/client";

/**
 * Importing a person's own website (`.agents/docs/plans/impor-website`): the import streams its progress and ends with
 * a Profile draft and work drafts; saving the chosen works streams the pictures it copies. Shared by onboarding, the
 * Profile's fill dialog and the portfolio editor's "Import from your website".
 */

/** Where an import is while it runs. */
export type SiteImportProgress = Exclude<WebsiteImportEvent, { type: "done" }>;

/** Where saving works is while it runs. */
export type SiteWorksProgress = Exclude<SiteWorksEvent, { type: "done" }>;

/** What saving works did. */
export type SiteWorksDone = Extract<SiteWorksEvent, { type: "done" }>;

type AiFields = { aiSource?: "rezumi" | "own"; idempotencyKey?: string };

// This tab's last import, so a reload or a second try at the same address picks its result up instead of paying (or
// spending the free import) again. The server keeps results a day and only for their own account.
const LAST_IMPORT_KEY = "rezumi.website-import";

function lastImport(url: string): string | null {
	try {
		const stored = JSON.parse(sessionStorage.getItem(LAST_IMPORT_KEY) ?? "null") as { url?: unknown; runId?: unknown };
		return stored && stored.url === url && typeof stored.runId === "string" ? stored.runId : null;
	} catch {
		return null;
	}
}

function rememberImport(url: string, runId: string) {
	try {
		sessionStorage.setItem(LAST_IMPORT_KEY, JSON.stringify({ url, runId }));
	} catch {
		// Without storage a reload imports again: nothing else depends on it.
	}
}

/**
 * Imports the site at `url`, reporting each step, and resolves with its result. This tab's finished import of the
 * same address is used again while the server still keeps it.
 */
export async function importSite(
	url: string,
	ai: AiFields,
	onProgress: (progress: SiteImportProgress) => void,
	signal: AbortSignal,
): Promise<WebsiteImportResult> {
	const kept = lastImport(url);
	if (kept) {
		const result = await streamClient.profile.sources
			.websiteImportResult({ runId: kept }, { signal })
			.catch((error: unknown) => {
				if (signal.aborted) throw error;
				return null;
			});
		if (result) return result;
	}

	onProgress({ type: "reading" });
	const events = await streamClient.profile.sources.websiteImport({ url, own: true, ...ai }, { signal });
	for await (const event of events) {
		if (event.type !== "done") {
			onProgress(event);
			continue;
		}
		rememberImport(url, event.result.runId);
		return event.result;
	}
	// The stream ended without its result: the connection dropped before the end.
	throw new TypeError("The website import ended early.");
}

/** Saves the chosen works of an import to the portfolio, reporting the pictures it copies, and resolves with what it did. */
export async function saveSiteWorks(
	runId: string,
	workIds: string[],
	onProgress: (progress: SiteWorksProgress) => void,
	signal?: AbortSignal,
): Promise<SiteWorksDone> {
	const events = await streamClient.portfolio.importSiteWorks({ runId, workIds }, signal ? { signal } : {});
	for await (const event of events) {
		if (event.type === "done") return event;
		onProgress(event);
	}
	throw new TypeError("Saving the works ended early.");
}

/**
 * Whether portfolios are open to the account, how many more works it may hold and which drafts it already has, for
 * the review of an import's works. Until the portfolio's answer is in, the plan's limit stands in.
 */
export function useSiteWorksRoom(
	drafts: readonly WorkDraft[],
	projects: readonly Pick<ProjectItem, "id" | "name" | "website">[],
) {
	const plan = usePlan();
	const { data } = useQuery(orpc.portfolio.get.queryOptions());
	const planMax = plan?.enabled ? PLANS[plan.planId].limits.portfolioWorks : PORTFOLIO_LIMITS.works;
	const max = data?.limits.works ?? planMax;
	const works = data?.portfolio?.data.works.items ?? [];
	return {
		/** Works the plan still allows. */
		room: Math.max(0, max - works.length),
		max,
		/** The room is the plan's, so upgrading makes more. */
		planLimited: Boolean(plan?.enabled) && max < PORTFOLIO_LIMITS.works,
		hasPortfolio: Boolean(data?.portfolio),
		published: Boolean(data?.portfolio?.isPublic),
		imported: importedDrafts(drafts, works, projects),
	};
}

/**
 * Which of an import's drafts are ticked: at first every new one the portfolio has room for; then what the person
 * picks, within the room. A new import starts over.
 */
export function useDraftChoice(
	result: Pick<WebsiteImportResult, "runId" | "works"> | null,
	imported: ReadonlySet<string>,
	room: number,
) {
	const [picked, setPicked] = useState<{ runId: string; chosen: Set<string> } | null>(null);
	const drafts = result?.works ?? [];
	const chosen = picked && picked.runId === result?.runId ? picked.chosen : initialDraftChoice(drafts, imported, room);
	return {
		chosen,
		toggle: (id: string, selected: boolean) => {
			if (result) setPicked({ runId: result.runId, chosen: toggleDraft(chosen, id, selected, { imported, room }) });
		},
		/** The chosen drafts' IDs, in the site's order. */
		ids: () => drafts.filter((draft) => chosen.has(draft.id)).map((draft) => draft.id),
	};
}
