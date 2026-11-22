// Template previews drawn from the person's own resume by the native renderer, one at a time, cached on the device by
// content and template. Until one is ready (or when the resume holds nothing beyond its account details) the card
// shows the template's sample picture from the server.
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { hasTemplatePreviewContent } from "@rezumi/resume/design-presets";
import {
	readStoredTemplateThumbnail,
	storeTemplateThumbnail,
	templateThumbnailKey,
} from "@/features/documents/thumbnail-store";
import { enqueueThumbnail, renderFirstPage, thumbnailPixelWidth } from "@/preview/thumbnail-queue";

/** What every preview keys on: worked out once per gallery and handed to each card. */
export type ThumbnailContent = { data: ResumeData; key: string; hasContent: boolean };

export function useThumbnailContent(data: ResumeData): ThumbnailContent {
	return useMemo(
		() => ({ data, key: templateThumbnailKey(data), hasContent: hasTemplatePreviewContent(data) }),
		[data],
	);
}

/**
 * The first page in `template`, drawn `width` points wide, as a file URI; undefined until drawn. A card that unmounts
 * before its turn (scrolled away) gives its slot to the cards on screen: the query consumes its signal.
 */
export function useTemplateThumbnail(template: Template, content: ThumbnailContent, width: number) {
	const queryClient = useQueryClient();
	const pixelWidth = thumbnailPixelWidth(width);
	const queryKey = ["template-thumbnail", template, content.key, pixelWidth];
	return useQuery({
		queryKey,
		queryFn: ({ signal }) => {
			const kept =
				queryClient.getQueryData<string>(queryKey) ?? readStoredTemplateThumbnail(content.key, template, pixelWidth);
			if (kept) return kept;
			return enqueueThumbnail(
				() =>
					renderFirstPage(
						content.data,
						pixelWidth,
						(uri) => storeTemplateThumbnail(content.key, template, pixelWidth, uri),
						template,
					),
				signal,
			);
		},
		enabled: content.hasContent && pixelWidth > 0,
		staleTime: Number.POSITIVE_INFINITY,
		// A failed render keeps the sample picture.
		retry: false,
	}).data;
}
