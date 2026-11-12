import type { ResumeData } from "@rezumi/schema/resume/data";
import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { ownPictureUrl } from "@rezumi/utils/own-picture";

// The pictures a portfolio page may show, decided by the same rule as the public page (`ownPictureUrl`, `02-teknis.md`
// section 20): only this app's own uploads. A resume photo kept on another site shows no photo, in the preview as on
// the page.

/** A portfolio's PDF on this app (`documents/portfolio/<id>.pdf`), the one other stored file a page links to. */
const OWN_PORTFOLIO_PDF_PATH = /^\/(?:api\/)?uploads\/[\w-]+\/documents\/portfolio\/[\w-]+\.pdf$/;

/**
 * The address the preview may use for one of this app's stored files: a picture (`ownPictureUrl`) or a portfolio's
 * PDF, which the PDF card links to. The published page decides with the same rule (`portfolioFileAddress` on the
 * server), so the preview's PDF card has its link as the page's does.
 */
export function ownFileUrl(source: string, origins: readonly string[]): string | undefined {
	const picture = ownPictureUrl(source, origins);
	if (picture) return picture;
	const [base] = origins;
	if (!base) return undefined;
	let url: URL;
	try {
		url = new URL(source.trim(), base);
	} catch {
		return undefined;
	}
	if (!origins.includes(url.origin) || url.search || url.hash || url.username || url.password) return undefined;
	return OWN_PORTFOLIO_PDF_PATH.test(url.pathname) ? url.href : undefined;
}

/** The resume as the page may use it: its photo only when it's one of this app's uploads. */
export function withOwnPicture(resume: ResumeData, origins: readonly string[]): ResumeData {
	const { url } = resume.picture;
	if (!url.trim() || ownPictureUrl(url, origins)) return resume;
	return { ...resume, picture: { ...resume.picture, url: "" } };
}

/** The origins this app's uploads are served from: the one the editor runs on, and its alias (`APP_ALIAS_URL`). */
export function useOwnOrigins(): readonly string[] {
	const aliasUrl = useRouterState({
		select: (state): string | undefined => state.matches.at(-1)?.context.flags?.aliasUrl,
	});
	return useMemo(() => {
		const origins = [window.location.origin];
		try {
			if (aliasUrl) origins.push(new URL(aliasUrl).origin);
		} catch {
			// A malformed alias adds nothing.
		}
		return origins;
	}, [aliasUrl]);
}
