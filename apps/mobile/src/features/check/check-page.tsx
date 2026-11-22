import type { CheckIssue } from "./messages";
import type { CheckResult } from "./use-check";
import type { PageMapNode } from "@rezumi/pdf/page-map";
import type { CheckTarget } from "@rezumi/resume/check";
import { useLingui } from "@lingui/react/macro";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { findBlock, targetsMentioning } from "@rezumi/resume/check";
import { IssueStepper } from "./issue-stepper";
import { PagePins } from "./page-pins";
import { ParserView } from "./parser-view";
import { useParsedPdf } from "./use-parsed-pdf";
import { usePreview } from "@/preview/usePreview";
import { Alert, Button, IconButton, Segment, Sheet, Skeleton, Text } from "@/ui";

export type PageLens = "person" | "parser";

/** The first page showing the issue's block, else the first showing any of the term's blocks. */
function focusPage(nodes: readonly PageMapNode[], target: CheckTarget | null, terms: readonly CheckTarget[]) {
	if (target) return findBlock(nodes, target)?.page;
	const pages = terms.flatMap((term) => findBlock(nodes, term)?.page ?? []);
	return pages.length > 0 ? Math.min(...pages) : undefined;
}

type CheckPageSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	check: CheckResult;
	lens: PageLens;
	onLensChange: (lens: PageLens) => void;
	selected: string | null;
	onSelect: (key: string | null) => void;
	/** A job-match term whose blocks are tinted. */
	highlightTerm: string | null;
	locked: boolean;
	offline: boolean;
	onFix: (issue: CheckIssue) => void;
};

/**
 * The page in Check: "What a person sees" with numbered pins on the open issues (and the picked issue's fix), or
 * "What a parser reads", the text software gets out of the exported PDF.
 */
export function CheckPageSheet(props: CheckPageSheetProps) {
	const { check, lens, selected, onSelect, highlightTerm } = props;
	const { t } = useLingui();
	const [width, setWidth] = useState(0);
	const [pageIndex, setPageIndex] = useState(0);
	const issue = check.issues.find((entry) => entry.key === selected);
	const pages = useMemo(() => [pageIndex], [pageIndex]);
	const preview = usePreview(props.isOpen ? check.data : null, check.data.metadata.template, {
		pages,
		viewport: { width: Math.max(1, width), height: width * 1.5, offset: 0, zoom: 1 },
	});
	const result = preview.result;
	const pageCount = result?.pageCount ?? 1;
	const page = result?.pages.find((entry) => entry.index === pageIndex);
	const highlighted = useMemo(
		() => (highlightTerm ? targetsMentioning(check.data, highlightTerm) : []),
		[check.data, highlightTerm],
	);
	const [parserOptedIn, setParserOptedIn] = useState(false);
	// Owned here, not by the parser view, so switching views keeps the consent and the result.
	const parsed = useParsedPdf(
		!preview.rendering && !preview.error ? (result?.pdf ?? null) : null,
		check.data,
		props.isOpen && lens === "parser" && parserOptedIn && !props.offline,
	);

	// Opens on the page holding what the sheet was opened for: the picked issue's block, or the first block naming
	// the term. It waits for the current render's page map; turning pages by hand afterwards is left alone.
	const nodes = preview.rendering ? undefined : result?.pageMap.nodes;
	const focus = props.isOpen ? (selected ? `issue:${selected}` : highlightTerm ? `term:${highlightTerm}` : null) : null;
	const [shownFocus, setShownFocus] = useState<string | null>(null);
	if (focus !== shownFocus && (focus === null || nodes)) {
		setShownFocus(focus);
		const target = focus ? focusPage(nodes ?? [], issue?.target ?? null, selected ? [] : highlighted) : undefined;
		if (target !== undefined) setPageIndex(target);
	}
	// The resume got shorter while a later page was open.
	if (result && pageIndex > Math.max(0, result.pageCount - 1)) setPageIndex(Math.max(0, result.pageCount - 1));

	const select = (key: string | null) => {
		onSelect(key);
		const target = check.issues.find((entry) => entry.key === key)?.target;
		const block = target && result ? findBlock(result.pageMap.nodes, target) : undefined;
		if (block) setPageIndex(block.page);
	};

	return (
		<Sheet
			isOpen={props.isOpen}
			onOpenChange={props.onOpenChange}
			title={t`Page`}
			closeLabel={t`Close`}
			detents={[0.95]}
			testID="check-page"
		>
			<Segment
				accessibilityLabel={t`Page view`}
				value={lens}
				onValueChange={props.onLensChange}
				options={[
					{ value: "person", label: t`What a person sees`, icon: "file-text" },
					{ value: "parser", label: t`What a parser reads`, icon: "brackets-curly" },
				]}
			/>
			{lens === "parser" ? (
				<ParserView
					pdf={!preview.rendering && !preview.error ? (result?.pdf ?? null) : null}
					issues={check.issues}
					offline={props.offline}
					optedIn={parserOptedIn}
					onOptIn={() => setParserOptedIn(true)}
					parsed={parsed}
					onSelect={(key) => {
						props.onLensChange("person");
						select(key);
					}}
				/>
			) : (
				<View className="gap-3" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
					{issue ? (
						<IssueStepper
							issues={check.issues}
							issue={issue}
							locked={props.locked}
							onSelect={select}
							onFix={props.onFix}
						/>
					) : null}
					{highlightTerm ? <Text tone="muted">{t`Covered term: ${highlightTerm}`}</Text> : null}
					{preview.error ? (
						<Alert status="danger">
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Description>{t`Couldn't render this resume.`}</Alert.Description>
							</Alert.Content>
							<Button size="sm" variant="secondary" onPress={preview.retry}>
								<Button.Label>{t`Retry`}</Button.Label>
							</Button>
						</Alert>
					) : null}
					{page && width > 0 ? (
						<PagePins
							page={page}
							scale={width / page.width}
							blocks={result?.pageMap.nodes ?? []}
							issues={check.issues}
							selected={selected}
							highlighted={highlighted}
							onSelect={select}
						/>
					) : (
						<Skeleton variant="none" className="aspect-[1/1.414] w-full rounded-lg" />
					)}
					<View className="flex-row items-center gap-2">
						<IconButton
							icon="caret-left"
							label={t`Previous page`}
							isDisabled={pageIndex === 0}
							onPress={() => setPageIndex((value) => value - 1)}
						/>
						<Text tone="muted" tabular className="flex-1 text-center" accessibilityLiveRegion="polite">
							{t`Page ${pageIndex + 1} of ${pageCount}`}
						</Text>
						<IconButton
							icon="caret-right"
							label={t`Next page`}
							isDisabled={pageIndex + 1 >= pageCount}
							onPress={() => setPageIndex((value) => value + 1)}
						/>
					</View>
				</View>
			)}
		</Sheet>
	);
}
