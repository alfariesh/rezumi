import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/libs/orpc/client";

type PortfolioVisibility = { isPublic: boolean; suspendedAt: Date | string | null };

/**
 * Whether visitors can open the portfolio: published and not taken down. The server decides the same way before it
 * serves the page (`portfolioOwnsProfilePath`), so the editor, the dashboard and Share never call a page live that
 * answers "not found".
 */
export function isPortfolioLive(portfolio: PortfolioVisibility | null | undefined): boolean {
	return Boolean(portfolio?.isPublic && !portfolio.suspendedAt);
}

/**
 * After the portfolio was made, deleted, published or its settings changed: everything read about it (the editor's
 * copy, the menu's and Share's status) is read again, and so are resumes, whose Share panel says what the short link
 * opens.
 */
export function invalidatePortfolioQueries(queryClient: QueryClient): Promise<void> {
	return Promise.all([
		queryClient.invalidateQueries({ queryKey: orpc.portfolio.key() }),
		queryClient.invalidateQueries({ queryKey: orpc.resume.list.key() }),
	]).then(() => undefined);
}
