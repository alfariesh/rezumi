import type { ResumeDraftStore } from "@/draft/types";
import type { PageMapNode } from "@rezumi/pdf/page-map";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { fitResume } from "./fit";
import { OverflowCard, PageNotice, SelectionBar, ZoomBar } from "./page-parts";
import { usePageZoom, ZoomViewport } from "./use-page-zoom";
import { usePreview } from "./usePreview";
import { PageImage } from "@/preview/page-image";
import { routes } from "@/routes";
import { Button, Skeleton, Text, size, space } from "@/ui";

export type ResumePageProps = {
	id: string;
	draft: Pick<ResumeDraftStore, "data" | "update" | "locked" | "undo">;
	focused?: boolean | undefined;
	/** What the page renders, when it differs from the draft (the Assistant's pending edits marked). Fit and editing use the draft. */
	previewData?: ResumeDraftStore["data"] | undefined;
	/** The zoom bar's full-screen button: opens the pages full screen, or closes it when `fullScreen` is set. */
	onFullScreen?: (() => void) | undefined;
	fullScreen?: boolean | undefined;
};

/**
 * The resume's pages rendered on the device: pinch or double-tap to zoom, tap to pick an entry and edit it, Fit when the
 * content runs over. The draft store's owner and the shell around it stay with the caller.
 */
export function ResumePage({ id, draft, focused, previewData, onFullScreen, fullScreen }: ResumePageProps) {
	const router = useRouter();
	const { t } = useLingui();
	const window = useWindowDimensions();
	const [viewport, setViewport] = useState({ width: window.width, height: window.height });
	const zoomController = usePageZoom();
	const { zoom, step, change } = zoomController;
	const [offset, setOffset] = useState(0);
	const [rows, setRows] = useState<Record<number, { y: number; height: number }>>({});
	const [selected, setSelected] = useState<{ node: PageMapNode; data: ResumeDraftStore["data"] } | null>(null);
	const selection = selected?.data === draft.data ? selected.node : null;
	const [fitting, setFitting] = useState(false);
	const [fitFailed, setFitFailed] = useState(false);
	const [fitApplied, setFitApplied] = useState(false);
	const latestData = useRef(draft.data);
	useLayoutEffect(() => {
		latestData.current = draft.data;
	}, [draft.data]);
	const mounted = useRef(true);
	const { data } = draft;
	const fitWidth = Math.max(size.hit, viewport.width - space[8]);
	const measured = Object.entries(rows)
		.filter(
			([, row]) => (row.y + row.height) * (zoom ?? 1) >= offset && row.y * (zoom ?? 1) <= offset + viewport.height,
		)
		.map(([index]) => Number(index));
	const shown = previewData ?? data;
	const preview = usePreview(shown, shown?.metadata.template, {
		focused,
		pages: Object.keys(rows).length > 0 ? measured : [0],
		viewport: { width: fitWidth, height: viewport.height, offset, zoom: zoom ?? 1 },
	});
	const { result } = preview;
	const displayScale = fitWidth / (result?.pageMap.pages[0]?.width ?? 595.28);
	const pageSizes = result?.pageMap.pages ?? [];

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const fit = async () => {
		if (!data || fitting || draft.locked) return;
		setFitting(true);
		setFitFailed(false);
		try {
			const fitted = await fitResume(data, () => mounted.current && latestData.current === data);
			if (!mounted.current || latestData.current !== data) return;
			let applied = false;
			draft.update(
				(value) => {
					// A newer edit can reach the store before React commits its next render.
					if (JSON.stringify(value) !== JSON.stringify(data)) return;
					value.metadata = fitted.data.metadata;
					applied = true;
				},
				{ newStep: true },
			);
			if (applied) {
				setFitApplied(true);
				setFitFailed(!fitted.fits);
			}
		} catch {
			if (mounted.current) setFitFailed(true);
		} finally {
			if (mounted.current) setFitting(false);
		}
	};
	const authored = Math.max(1, data?.metadata.layout.pages.length ?? 1);
	const overflow = result && result.pageCount > authored;
	const currentPage = Math.min(
		result?.pageCount ?? 1,
		Number(Object.entries(rows).find(([, row]) => (row.y + row.height) * (zoom ?? 1) > offset)?.[0] ?? 0) + 1,
	);
	const selectAt = (page: number, x: number, y: number) => {
		// Nearest header/item wins within a 44 pt target; section boxes never steal their entries' taps.
		const candidates = result?.pageMap.nodes.filter((node) => node.page === page && node.kind !== "section") ?? [];
		let selected: PageMapNode | null = null;
		let best = Number.POSITIVE_INFINITY;
		for (const node of candidates) {
			const dx = Math.max(node.x * displayScale - x, 0, x - (node.x + node.width) * displayScale);
			const dy = Math.max(node.y * displayScale - y, 0, y - (node.y + node.height) * displayScale);
			const distance = Math.hypot(dx, dy);
			if (distance <= size.hit / 2 && distance < best) {
				selected = node;
				best = distance;
			}
		}
		setSelected(selected ? { node: selected, data } : null);
	};
	// Opens the picked entry (a header opens Basics) in the editor, the way Write does; full screen closes first, so the
	// entry never stacks over the full-screen modal.
	const edit = () => {
		const target =
			selection?.kind === "item"
				? routes.entry(id, selection.sectionId, selection.itemId)
				: routes.entry(id, "basics", "basics");
		if (fullScreen && router.canDismiss()) router.dismiss();
		router.push(target);
	};

	return (
		<View className="flex-1 bg-surface-secondary" onLayout={(event) => setViewport(event.nativeEvent.layout)}>
			{preview.error ? (
				<PageNotice
					status="danger"
					message={t`Couldn't render the preview. Retry, or try another template or font in Design.`}
					onRetry={preview.retry}
				/>
			) : null}
			{result?.hasTextLoss ? (
				<PageNotice
					status="warning"
					message={
						result.lostCharacters.length > 0
							? t`Some characters couldn't be drawn: ${result.lostCharacters.join(", ")}. Choose another font in Design.`
							: t`Some text couldn't be drawn. Choose another font in Design.`
					}
				/>
			) : null}
			{fitFailed ? (
				<PageNotice status="warning" message={t`Content still runs over. Hide a section or shorten entries.`} />
			) : null}
			{fitApplied ? (
				<Button
					variant="ghost"
					size="sm"
					className="self-start"
					onPress={() => {
						draft.undo();
						setFitApplied(false);
						setFitFailed(false);
					}}
				>
					{t`Undo fit`}
				</Button>
			) : null}
			{!result && !preview.error ? (
				<View className="items-center gap-3 p-4">
					<Skeleton variant="none" className="aspect-[0.707] w-full rounded-sm" />
					<Text tone="muted">{data ? t`Rendering preview…` : t`Loading resume…`}</Text>
				</View>
			) : null}
			<ZoomViewport controller={zoomController} width={viewport.width} pageWidth={fitWidth} onScroll={setOffset}>
				<View className="items-center gap-8">
					{pageSizes.map((page, index) => {
						const image = result?.pages.find((entry) => entry.index === index);
						const box = { width: page.width * displayScale, height: page.height * displayScale };
						const highlight =
							selection?.page === index
								? {
										left: selection.x * displayScale,
										top: selection.y * displayScale,
										width: selection.width * displayScale,
										height: selection.height * displayScale,
									}
								: null;
						return (
							<View
								key={index}
								className="gap-2"
								onLayout={(event) => {
									const { y: rowY, height } = event.nativeEvent.layout;
									const y = rowY + space[4];
									setRows((previous) =>
										previous[index]?.y === y && previous[index]?.height === height
											? previous
											: { ...previous, [index]: { y, height } },
									);
								}}
							>
								<Text size="xs" tone="muted" className="text-center">{t`Page ${index + 1}`}</Text>
								{index === 0 && overflow ? (
									<OverflowCard
										authored={authored}
										disabled={draft.locked || preview.rendering}
										fitting={fitting}
										onFit={() => void fit()}
										maxWidth={box.width}
									/>
								) : null}
								<GestureDetector
									gesture={Gesture.Tap()
										.requireExternalGestureToFail(zoomController.doubleTap)
										.runOnJS(true)
										.onEnd((event, success) => {
											if (success) selectAt(index, event.x, event.y);
										})}
								>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={t`Select an entry on page ${index + 1}`}
										accessibilityActions={(result?.pageMap.nodes ?? [])
											.filter((node) => node.page === index && node.kind !== "section")
											.map((node, entry) => ({ name: node.key, label: t`Select entry ${entry + 1}` }))}
										onAccessibilityAction={(event) => {
											const node = result?.pageMap.nodes.find(
												(value) => value.key === event.nativeEvent.actionName && value.page === index,
											);
											if (node) setSelected({ node, data });
										}}
										onAccessibilityTap={() => selectAt(index, box.width / 2, box.height / 2)}
										className="bg-paper shadow-surface"
										style={box}
									>
										{image ? <PageImage uri={image.uri} style={box} accessible={false} /> : null}
										{highlight ? (
											<View
												pointerEvents="none"
												className="absolute border border-accent bg-accent-soft"
												style={highlight}
											/>
										) : null}
									</Pressable>
								</GestureDetector>
							</View>
						);
					})}
				</View>
			</ZoomViewport>
			{selection ? (
				<SelectionBar header={selection.kind === "header"} onEdit={edit} onClear={() => setSelected(null)} />
			) : null}
			<ZoomBar
				zoom={zoom}
				onStep={step}
				onReset={() => change(1)}
				currentPage={currentPage}
				pageCount={result?.pageCount ?? 1}
				onFullScreen={onFullScreen}
				fullScreen={fullScreen}
			/>
		</View>
	);
}
