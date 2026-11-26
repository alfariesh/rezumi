import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { assignChanged } from "@rezumi/portfolio/editing";
import { editPortfolio, usePortfolioEditorStore } from "./store";

export function editPortfolioTo(next: PortfolioData): void {
	const current = usePortfolioEditorStore.getState().portfolio?.data;
	if (!current) return;
	editPortfolio((draft) => assignChanged(draft, current, next), { structural: true });
}
