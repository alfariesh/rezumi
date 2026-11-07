import type { ResumeData } from "@rezumi/schema/resume/data";
import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { ownPictureUrl } from "@rezumi/utils/own-picture";

// The pictures a portfolio page may show, decided by the same rule as the public page (`ownPictureUrl`, `02-teknis.md`
// section 20): only this app's own uploads. A resume photo kept on another site shows no photo, in the preview as on
// the page.

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
