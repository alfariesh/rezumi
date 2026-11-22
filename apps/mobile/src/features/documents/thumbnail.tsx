// A document's first page on white paper: a resume's real page, drawn once per edit through the thumbnail queue and
// kept on the device (thumbnail-store), or drawn live from an unsynced draft open on this device; a letter's page
// as lines, like the web (letters have no thumbnail render). Only visible cards draw.
import type { DocumentSummary } from "./filter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { PixelRatio, View } from "react-native";
import { readStoredThumbnail, storeThumbnail } from "./thumbnail-store";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { useResumeStore } from "@/draft/runtime";
import { A4_WIDTH_PT, enqueueThumbnail, renderFirstPage, thumbnailPixelWidth } from "@/preview/thumbnail-queue";
import { usePreview } from "@/preview/usePreview";
import { Icon, cx } from "@/ui";

type ThumbnailProps = {
	document: DocumentSummary;
	/** Draws only while the card is on screen; off screen it keeps the last image. */
	visible: boolean;
	/** The small page beside a list row; otherwise the page fills its card's width. */
	compact?: boolean | undefined;
};

const fill = { width: "100%", height: "100%" } as const;

export function Thumbnail({ document, visible, compact = false }: ThumbnailProps) {
	// Decorative: the card around it carries the document's name.
	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			className={cx(
				"overflow-hidden border border-border bg-paper",
				compact ? "h-14 w-10 rounded-md" : "aspect-[210/297] w-full rounded-lg",
			)}
			testID={`thumbnail-${document.id}`}
		>
			{document.type === "letter" ? (
				<LetterLines compact={compact} />
			) : (
				<ResumePage document={document} visible={visible} compact={compact} />
			)}
		</View>
	);
}

type ResumePageProps = { document: DocumentSummary; visible: boolean; compact: boolean };

function ResumePage({ document, visible, compact }: ResumePageProps) {
	const session = useSession();
	const queryClient = useQueryClient();
	const [width, setWidth] = useState(0);
	const signedIn = visible && session.status === "signed-in";
	const { server } = session;
	const draftData = useResumeStore((state) => (state.document?.id === document.id ? state.data : undefined));
	const pixelWidth = thumbnailPixelWidth(width);
	const stored = useQuery({
		queryKey: ["resume-thumbnail", server, document.id, document.updatedAt.getTime(), pixelWidth],
		queryFn: ({ queryKey, signal }) => {
			// The same edit at the same width is the same image: a refetch keeps it.
			const kept = queryClient.getQueryData<string>(queryKey) ?? readStoredThumbnail(server, document, pixelWidth);
			if (kept) return kept;
			return enqueueThumbnail(async () => {
				const { data } = await orpc.resume.getById.call({ id: document.id }, { signal });
				return renderFirstPage(data, pixelWidth, (uri) => storeThumbnail(server, document, pixelWidth, uri));
			}, signal);
		},
		enabled: signedIn && pixelWidth > 0 && !draftData,
		staleTime: Number.POSITIVE_INFINITY,
	});
	// An unsynced draft open on this device is drawn live instead: it is newer than anything stored.
	const preview = usePreview(signedIn && width > 0 ? (draftData ?? null) : null, undefined, {
		pages: [0],
		scale: Math.max(0.1, (width / A4_WIDTH_PT) * PixelRatio.get()),
	});
	const page = draftData ? preview.result?.pages[0]?.uri : stored.data;
	return (
		<View className="flex-1" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
			{page ? (
				<Image source={{ uri: page }} contentFit="contain" style={fill} />
			) : (
				<View className="flex-1 items-center justify-center">
					<Icon name="file-text" size={compact ? 16 : 24} tone="muted" />
				</View>
			)}
		</View>
	);
}

type LetterLinesProps = { compact: boolean };

/** A letter's page drawn from lines: sender, date, then paragraphs. The paper is white in both themes. */
function LetterLines({ compact }: LetterLinesProps) {
	const lines = compact ? 4 : 7;
	return (
		<View className={cx("flex-1", compact ? "gap-1 p-1.5" : "gap-1.5 p-[14%]")}>
			<View className="h-1.5 w-2/5 rounded-sm bg-black/20" />
			{compact ? null : <View className="mb-3 h-1 w-3/5 rounded-sm bg-black/10" />}
			<View className="h-1 w-1/3 rounded-sm bg-black/15" />
			{Array.from({ length: lines }, (_, index) => (
				<View key={index} className={cx("h-1 rounded-sm bg-black/10", index % 3 === 2 ? "w-4/5" : "w-full")} />
			))}
		</View>
	);
}
