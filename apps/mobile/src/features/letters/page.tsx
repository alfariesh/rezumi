// The letter as it prints, rendered on the device with the native PDF engine: sender header, recipient block and date,
// greeting, body, sign-off and signature. A draft being written shows in place of the body until it's kept.
import type { ResumeData } from "@rezumi/schema/resume/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, View } from "react-native";
import { coverLetterTextToHtml } from "@rezumi/resume/cover-letter";
import { LETTER_RENDER_OPTIONS, letterPageData, useLetterWords } from "./compose";
import { useLetterDrafting } from "./drafting";
import { useLetterStore } from "@/draft";
import { nativeEnvironment } from "@/draft/native";
import { PageImage } from "@/preview/page-image";
import { usePageZoom, ZoomViewport } from "@/preview/use-page-zoom";
import { usePreview } from "@/preview/usePreview";
import { Alert, Button, IconButton, Skeleton, Text, size, space, useReducedMotion } from "@/ui";

/** A rendered page at its display size, on paper white (never inverts) with the surface shadow. */
const pageStyle = (width: number, height: number) => [{ width, height }, PAPER] as const;
const PAPER = { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)" };

/** A4 in PDF points, the size to lay out before the first render lands. */
const A4 = { width: 595.28, height: 841.89 };

/** The latest value, at most every `ms`: a streaming draft re-renders the page a few times a second, not per word. */
function useThrottled<T>(value: T, ms: number) {
	const [shown, setShown] = useState(value);
	const last = useRef(0);
	useEffect(() => {
		const timeout = setTimeout(
			() => {
				last.current = Date.now();
				setShown(value);
			},
			Math.max(0, last.current + ms - Date.now()),
		);
		return () => clearTimeout(timeout);
	}, [value, ms]);
	return shown;
}

function Notice({ status, message, action }: { status: "warning" | "danger"; message: string; action?: () => void }) {
	const { t } = useLingui();
	return (
		<View className="gap-2 p-4 pb-0">
			<Alert status={status}>
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Description>{message}</Alert.Description>
				</Alert.Content>
			</Alert>
			{action ? (
				<Button size="sm" variant="secondary" className="self-start" onPress={action}>
					{t`Retry`}
				</Button>
			) : null}
		</View>
	);
}

type LetterPagesProps = { data: ResumeData | null; zoomBar?: boolean | undefined };

/** The pages of a letter's render data, with errors, text loss and a zoom bar. Also shows read-only versions. */
export function LetterPages({ data, zoomBar = true }: LetterPagesProps) {
	const { t } = useLingui();
	const [width, setWidth] = useState(0);
	const zoomController = usePageZoom();
	const { zoom, step, change } = zoomController;
	const pageWidth = Math.max(size.hit, width - space[8]);
	const [firstWidth, setFirstWidth] = useState(A4.width);
	const displayScale = pageWidth / firstWidth;
	const preview = usePreview(width ? data : null, undefined, {
		focused: nativeEnvironment.focused(),
		renderOptions: LETTER_RENDER_OPTIONS,
		scale: Math.min(6, Math.max(0.1, displayScale * (zoom ?? 1) * PixelRatio.get())),
	});
	const { result } = preview;
	// Letter and free-form pages differ from A4; the scale follows the rendered width.
	const renderedWidth = result?.pages[0]?.width;
	if (renderedWidth && renderedWidth !== firstWidth) setFirstWidth(renderedWidth);
	const placeholder = { width: pageWidth, height: (pageWidth * A4.height) / A4.width };

	return (
		<View className="flex-1 bg-surface-secondary" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
			{preview.error ? (
				<Notice
					status="danger"
					message={t`Couldn't render the preview. Retry, or try another template or font in Design.`}
					action={preview.retry}
				/>
			) : null}
			{result?.hasTextLoss ? (
				<Notice
					status="warning"
					message={
						result.lostCharacters.length > 0
							? t`Some characters couldn't be drawn: ${result.lostCharacters.join(", ")}. Choose another font in Design.`
							: t`Some text couldn't be drawn. Choose another font in Design.`
					}
				/>
			) : null}
			<ZoomViewport controller={zoomController} width={width} pageWidth={pageWidth}>
				<View accessibilityLabel={t`Letter page`} className="items-center gap-6">
					{!result ? (
						preview.error ? null : (
							<View className="items-center gap-3">
								<Skeleton variant="none" className="rounded-sm" style={placeholder} />
								<Text tone="muted">{t`Rendering preview…`}</Text>
							</View>
						)
					) : (
						result.pages.map((page) => (
							<View key={page.index} className="gap-2">
								<Text size="xs" tone="muted" className="text-center">{t`Page ${page.index + 1}`}</Text>
								<PageImage
									uri={page.uri}
									accessibilityLabel={t`Letter page ${page.index + 1}`}
									style={pageStyle(page.width * displayScale, page.height * displayScale)}
								/>
							</View>
						))
					)}
				</View>
			</ZoomViewport>
			{zoomBar ? (
				<View className="flex-row items-center justify-around border-t border-separator bg-surface p-1">
					<IconButton
						icon="minus"
						variant="ghost"
						label={t`Zoom out`}
						isDisabled={(zoom ?? 1) <= 0.6}
						onPress={() => step(-0.1)}
					/>
					<Button variant="ghost" size="sm" onPress={() => change(1)}>
						{zoom === null ? t`Fit` : t`${Math.round(zoom * 100)}%`}
					</Button>
					<IconButton
						icon="plus"
						variant="ghost"
						label={t`Zoom in`}
						isDisabled={(zoom ?? 1) >= 1.5}
						onPress={() => step(0.1)}
					/>
					<Text size="xs" tone="muted">
						{plural(result?.pageCount ?? 1, { one: "# page", other: "# pages" })}
					</Text>
				</View>
			) : null}
		</View>
	);
}

export function LetterPage({ id }: { id: string }) {
	const letter = useLetterStore((state) => (state.document?.id === id ? state.document : null));
	const words = useLetterWords(letter?.style.metadata.page.locale);
	const draft = useLetterDrafting((state) => state.draft);
	const reducedMotion = useReducedMotion();
	// Reduced motion puts the whole draft on the page at once.
	const draftText =
		draft.phase === "ready" || (draft.phase === "streaming" && !reducedMotion) ? draft.text || null : null;
	const shownDraft = useThrottled(draftText, 400);

	const data = useMemo(() => {
		if (!letter || !words) return null;
		return letterPageData(shownDraft ? { ...letter, content: coverLetterTextToHtml(shownDraft) } : letter, words);
	}, [letter, words, shownDraft]);

	if (!letter)
		return (
			<View className="flex-1 items-center bg-surface-secondary p-4">
				<Skeleton variant="none" className="aspect-[0.707] w-full rounded-sm" />
			</View>
		);
	return <LetterPages data={data} />;
}
