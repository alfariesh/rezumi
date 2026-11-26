import type { PortfolioEditContext } from "./types";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import { sanitizePortfolioHtml } from "../rich-text";
import { runPortfolioEdits } from "./apply";

// The edit engine every AI path changes a portfolio through (Phase 14, `.agents/docs/plans/portfolio/phase-14-asisten-ai.md`
// §3): the in-app assistant (strict, on the run's working copy), MCP (strict, in a transaction) and the editor (replaying
// resolved edits on its store, one Undo step per call). Pure and runtime-neutral: it runs in the browser and on the server.

export type {
	AppliedPortfolioEdit,
	FailedPortfolioEdit,
	PortfolioAiViewInput,
	PortfolioEditContext,
	PortfolioEditPlan,
	PortfolioEditResult,
	PortfolioPlanFeature,
	PortfolioUpload,
} from "./types";
export type { PortfolioPlanParts } from "./plan";
export type { PlacedPortfolioImage } from "./images";

/** Strict inputs are sanitized before they become resolved edits. Native replay only consumes resolved edits. */
export function applyPortfolioEdits(
	data: PortfolioData,
	edits: readonly PortfolioEdit[],
	context: PortfolioEditContext,
) {
	return context.mode === "strict"
		? runPortfolioEdits(data, edits, { ...context, mode: "strict", sanitizeHtml: sanitizePortfolioHtml })
		: runPortfolioEdits(data, edits, { ...context, mode: "replay" });
}
export { portfolioFeaturesNeeded } from "./plan";
export { placedPortfolioImages } from "./images";
export { portfolioEditItemName } from "./lists";
export { portfolioAiView, PORTFOLIO_THEME_CHARACTER } from "./view";
export { PORTFOLIO_EDIT_GUIDE } from "./guide";

/** A work, as the engine's helpers see it; exported for the web's change labels. */
export type { PortfolioWork } from "@rezumi/schema/portfolio/data";
