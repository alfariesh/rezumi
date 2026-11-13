import type { PortfolioViewMessages } from "@rezumi/portfolio/view";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { pageLocaleOf, usePortfolioOwner, usePortfolioSource } from "./context";
import { useOwnOrigins, withOwnPicture } from "./pictures";
import { usePortfolioData } from "./store";
import { usePlanFeature } from "@/features/billing/plan";
import { orpc } from "@/libs/orpc/client";

/** The page's own words (default section titles, button labels) in its language. */
export function usePageMessages(): PortfolioViewMessages {
	const data = usePortfolioData();
	const source = usePortfolioSource();
	const locale = pageLocaleOf(data, source.designData);
	return useMemo(() => portfolioViewMessages(portfolioMessages(locale)), [locale]);
}

/** Which resume buttons the page would show: the resume's web page while it's public, its PDF unless it's locked. */
export function useResumeLinks(): { resume: boolean; resumePdf: boolean } {
	const { resume } = usePortfolioSource();
	const shown = Boolean(resume?.isPublic);
	return { resume: shown, resumePdf: shown && resume?.showDownloadButtons !== false && !resume?.hasPassword };
}

/**
 * The page as the renderer sees it, from the draft: which sections show, the accent and fonts "follow the resume"
 * resolves to, the title search engines get. Panels read it; the preview draws its own, debounced.
 */
export function useEditorView() {
	const data = usePortfolioData();
	const source = usePortfolioSource();
	const owner = usePortfolioOwner();
	const messages = usePageMessages();
	const origins = useOwnOrigins();
	const canHideCredit = usePlanFeature("hidePortfolioCredit");
	const { data: portfolio } = useQuery(orpc.portfolio.get.queryOptions());
	const contactFormAvailable = portfolio?.contactFormAvailable ?? false;
	const links = useResumeLinks();
	const showResume = links.resume;
	const showPdf = links.resumePdf;
	return useMemo(
		() =>
			buildPortfolioView({
				portfolio: { data },
				// A resume photo kept on another site shows no photo, as on the page (`./pictures.ts`).
				resume: source.data ? { data: withOwnPicture(source.data, origins), from: source.from ?? "resume" } : null,
				owner: { name: owner.name, username: owner.username },
				entitlements: { hidePortfolioCredit: canHideCredit },
				messages,
				fileUrl: (key) => `/${key}`,
				// Placeholders: panels only ask whether the buttons show.
				// "Save contact" shows in the inert preview; it leads nowhere there (Phase 13 4.1).
				links: { resume: showResume ? "#" : null, resumePdf: showPdf ? "#" : null, vcard: "#contact" },
				contactFormAvailable,
			}),
		[
			data,
			source.data,
			source.from,
			owner.name,
			owner.username,
			messages,
			origins,
			canHideCredit,
			contactFormAvailable,
			showResume,
			showPdf,
		],
	);
}
