import type { PlanSummary } from "@/features/billing/plan";
import type { WebMcpTool } from "@/libs/webmcp";
import type { PortfolioAiViewInput, PortfolioEditPlan } from "@rezumi/portfolio/edits";
import { t } from "@lingui/core/macro";
import { useEffect, useMemo } from "react";
import z from "zod";
import { portfolioEditsInputSchema } from "@rezumi/schema/portfolio/edits";
import { toastAiChange } from "../ai/apply";
import { isPortfolioLive } from "../status";
import { usePortfolioLimits } from "../works/limits";
import { editPortfolioTo } from "./assign";
import { usePortfolioSource } from "./context";
import { usePortfolioUrl } from "./publish-panel";
import { usePortfolioEditorStore } from "./store";
import { getPlanName, usePlan } from "@/features/billing/plan";
import { defineWebMcpTool, useWebMcpTools } from "@/libs/webmcp";

// The portfolio editor's tools for the browser's AI agent (WebMCP), like the resume editor's (`resume/editor/webmcp.ts`):
// the agent reads the portfolio as the in-app assistant does and changes it with the same edits, on the editor's data,
// as one undo step. The editor's autosave saves them. The edit engine (and the rich-text cleaner it brings) loads with
// the first call, not with the editor.
const loadEngine = () => import("@rezumi/portfolio/edits");

/** What the tools read besides the editor's data, as the editor knows it now. */
export type PortfolioToolContext = {
	source: PortfolioAiViewInput["source"];
	plan: PortfolioEditPlan;
	status: PortfolioAiViewInput["status"];
};

/** What the account's plan lets an edit choose, for refusing it before the save would; null while plans don't apply. */
export function portfolioEditPlan(plan: PlanSummary | undefined, maxWorks: number): PortfolioEditPlan {
	if (!plan?.enabled) return null;
	const { premiumPortfolioThemes, premiumHeroEffects, hidePortfolioCredit } = plan.features;
	return {
		maxWorks,
		features: { premiumPortfolioThemes, premiumHeroEffects, hidePortfolioCredit },
		name: getPlanName(plan.planId),
	};
}

/** The portfolio this editor has open, as on screen: with edits that haven't reached the server yet. */
function openPortfolio() {
	const portfolio = usePortfolioEditorStore.getState().portfolio;
	if (!portfolio) throw new Error("The portfolio is no longer open in the editor.");
	return portfolio;
}

export function createPortfolioTools(read: () => PortfolioToolContext): readonly WebMcpTool[] {
	const readPortfolio = defineWebMcpTool({
		name: "portfolio_read",
		title: "Read portfolio",
		description: [
			"Get the portfolio open in this editor, exactly as on screen (including changes not saved yet): its theme and",
			"design, intro, About, works with their blocks, services, testimonials, clients, custom sections, section order",
			"and titles, the resume's career sections (read-only, for hiding items), contact switches, the images it can",
			"place and its limits, with every item's id. `guide` explains the edits portfolio_edit takes. Read it first.",
		].join(" "),
		input: z.object({}),
		annotations: { readOnlyHint: true, untrustedContentHint: true },
		execute: async () => {
			const { portfolioAiView, PORTFOLIO_EDIT_GUIDE } = await loadEngine();
			const { data } = openPortfolio();
			const { source, plan, status } = read();
			return { view: portfolioAiView({ data, source, plan, uploads: [], status }), guide: PORTFOLIO_EDIT_GUIDE };
		},
	});

	const editPortfolio = defineWebMcpTool({
		name: "portfolio_edit",
		title: "Edit portfolio",
		description: [
			"Change the portfolio open in this editor with edits (set, add, update, remove, move) addressed by the ids",
			"portfolio_read returns; its `guide` describes every list, field and value. Edits apply in order, each whole or",
			"not at all: the result lists what applied (with new ids) and what failed, and why. The page updates at once,",
			"the changes save automatically, and the user can undo them as one step. Never invent facts, numbers, clients",
			"or testimonials. Publishing, the address and the password are the user's, in the editor's Publish tab.",
		].join(" "),
		input: portfolioEditsInputSchema,
		execute: async ({ edits }) => {
			const { applyPortfolioEdits } = await loadEngine();
			// Read after the engine loaded, so edits made meanwhile aren't overwritten.
			const { data } = openPortfolio();
			const result = applyPortfolioEdits(data, edits, { mode: "strict", plan: read().plan });
			if (result.applied.length > 0) {
				editPortfolioTo(result.data);
				toastAiChange(t`Your browser's AI agent changed your portfolio.`);
			}
			return {
				applied: result.applied.map(({ index, id, ref, summary }) => ({
					index,
					summary,
					...(id ? { id } : {}),
					...(ref ? { ref } : {}),
				})),
				failed: result.failed,
				note:
					result.applied.length > 0
						? "The changes show on the page and save automatically. The user can undo them as one step."
						: "Nothing was changed.",
			};
		},
	});

	return [readPortfolio, editPortfolio];
}

/** What the tools read besides the data, kept current by the open editor (`usePortfolioWebMcpTools`). */
let toolContext: PortfolioToolContext = {
	source: { from: "resume", name: null, resume: null },
	plan: null,
	status: { published: false, url: null },
};

/** One set of tools for every visit: they read the editor's store and `toolContext` when called. */
let portfolioTools: readonly WebMcpTool[] | null = null;
const getPortfolioTools = () => (portfolioTools ??= createPortfolioTools(() => toolContext));

/** Offers the open portfolio to the browser's AI agent while the editor is mounted. */
export function usePortfolioWebMcpTools() {
	const source = usePortfolioSource();
	const plan = usePlan();
	const { works } = usePortfolioLimits();
	const live = usePortfolioEditorStore((state) => isPortfolioLive(state.portfolio));
	const url = usePortfolioUrl();
	const from = source.from ?? "resume";
	const name = source.resume?.name ?? null;
	const resume = source.data;
	const editPlan = useMemo(() => portfolioEditPlan(plan, works), [plan, works]);

	useEffect(() => {
		toolContext = { source: { from, name, resume }, plan: editPlan, status: { published: live, url } };
	}, [from, name, resume, editPlan, live, url]);

	useWebMcpTools(getPortfolioTools());
}
