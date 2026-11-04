import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { fnv1a } from "@rezumi/utils/string";
import { createResumePdfBlob } from "@/features/resume/export/pdf-document";
import { createPdfFirstPageImage, releaseThumbnailUrls } from "@/features/resume/preview/pdf-thumbnail";
import { enqueueThumbnailRender } from "@/features/resume/preview/resume-thumbnail.shared";

const QUERY_KEY = "template-thumbnail";
// Twice the gallery card (about 172 × 243 CSS px), so thumbnails stay sharp on high-density screens.
const SIZE = { width: 344, height: 486 };

/** A hash of the content, so a thumbnail re-renders only when the resume changes. */
const fingerprint = (data: ResumeData) =>
	fnv1a(JSON.stringify({ ...data, metadata: { ...data.metadata, template: null } })).toString(36);

export type ThumbnailContent = { hash: string; hasContent: boolean };

/** What every thumbnail keys on. The gallery works it out once per change and hands it to each card. */
export function thumbnailContent(data: ResumeData): ThumbnailContent {
	return {
		hash: fingerprint(data),
		// New resumes inherit account details; those alone don't show a template's section layout.
		hasContent: Boolean(
			buildMarkdown({ ...data, basics: defaultResumeData.basics }).trim() || (!data.picture.hidden && data.picture.url),
		),
	};
}

/**
 * A template's first page rendered from the user's own content, font and colour. Cached by template and
 * content; until it's ready the gallery shows the template's sample image, so the grid never jumps.
 */
export function useTemplateThumbnail(
	template: Template,
	data: ResumeData,
	enabled: boolean,
	content: ThumbnailContent = thumbnailContent(data),
) {
	const queryClient = useQueryClient();
	const { hash, hasContent } = content;

	useEffect(() => {
		releaseThumbnailUrls(queryClient, QUERY_KEY);
	}, [queryClient]);

	return useQuery({
		queryKey: [QUERY_KEY, template, hash],
		queryFn: ({ signal }) =>
			enqueueThumbnailRender(async () => {
				const pdf = await createResumePdfBlob({ ...data, metadata: { ...data.metadata, template } }, undefined, {
					signal,
				});
				return URL.createObjectURL(await createPdfFirstPageImage(pdf, SIZE, signal));
			}, signal),
		enabled: enabled && hasContent,
		// Mutations invalidate every query; the same template and content draw the same image, so never refetch.
		staleTime: "static",
		// Keep the previous image while the content changes, so thumbnails don't flash back to the sample.
		placeholderData: (previous) => (hasContent ? previous : undefined),
	});
}
