import type { RouterOutput } from "@/libs/orpc/client";
import type { EditOptions } from "@rezumi/portfolio/editing";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { createPortfolioEditor } from "@rezumi/portfolio/editing";
import { cancelPortfolioTasks } from "./tasks";
import { getPlanProblem } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { client } from "@/libs/orpc/client";

export type PortfolioRecord = NonNullable<RouterOutput["portfolio"]["get"]["portfolio"]>;
export type { PortfolioSaveStatus } from "@rezumi/portfolio/editing";
export { PORTFOLIO_SAVE_DELAY_MS } from "@rezumi/portfolio/editing";

export const { store: usePortfolioEditorStore, lastSavedData } = createPortfolioEditor<PortfolioRecord>({
	read: () => client.portfolio.get(),
	update: (input, signal) => client.portfolio.update(input, { signal }),
	normalize: async (data) => {
		const { sanitizePortfolioData } = await import("@rezumi/portfolio/rich-text");
		return JSON.parse(JSON.stringify(sanitizePortfolioData(data)));
	},
	onOnline: (retry) => {
		if (typeof window === "undefined") return () => {};
		window.addEventListener("online", retry);
		return () => window.removeEventListener("online", retry);
	},
	planProblem: (error) => {
		const problem = getPlanProblem(error);
		if (!problem) return;
		return { key: problem.kind === "feature" ? problem.feature : problem.limit, show: () => openPlanDialog(problem) };
	},
	cancelTasks: cancelPortfolioTasks,
});

/** The portfolio data being edited. Only use inside the editor, where a portfolio is always loaded. */
export function usePortfolioData(): PortfolioData {
	const data = usePortfolioEditorStore((state) => state.portfolio?.data);
	if (!data) throw new Error("No portfolio is open in the editor.");
	return data;
}

export function usePortfolioRecord(): PortfolioRecord {
	const portfolio = usePortfolioEditorStore((state) => state.portfolio);
	if (!portfolio) throw new Error("No portfolio is open in the editor.");
	return portfolio;
}

export const editPortfolio = (recipe: (draft: Draft<PortfolioData>) => void, options?: EditOptions) =>
	usePortfolioEditorStore.getState().edit(recipe, options);
