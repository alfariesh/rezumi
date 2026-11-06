import type { PortfolioViewMessages } from "@rezumi/portfolio/view";
import { useMemo } from "react";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { pageLocaleOf, usePortfolioOwner, useSourceResume } from "./context";
import { usePortfolioData } from "./store";

/** The page's own words (default section titles, button labels) in its language. */
export function usePageMessages(): PortfolioViewMessages {
	const data = usePortfolioData();
	const source = useSourceResume();
	const locale = pageLocaleOf(data, source.data);
	return useMemo(() => portfolioViewMessages(portfolioMessages(locale)), [locale]);
}

/**
 * The page as the renderer sees it, from the draft: which sections show, the accent and fonts "follow the resume"
 * resolves to, the title search engines get. Panels read it; the preview draws its own, debounced.
 */
export function useEditorView() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const owner = usePortfolioOwner();
	const messages = usePageMessages();
	return useMemo(
		() =>
			buildPortfolioView({
				portfolio: { data },
				resume: source.data ? { data: source.data } : null,
				owner: { name: owner.name, username: owner.username },
				entitlements: { hidePortfolioCredit: false },
				messages,
				fileUrl: (key) => `/${key}`,
			}),
		[data, source.data, owner.name, owner.username, messages],
	);
}
