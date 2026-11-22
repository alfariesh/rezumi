import type { CheckIssue } from "./messages";
import type { CheckResult } from "./use-check";
import { useLingui } from "@lingui/react/macro";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { findBlock, targetsMentioning } from "@rezumi/resume/check";
import { IssueStepper } from "./issue-stepper";
import { PagePins } from "./page-pins";
import { ParserView } from "./parser-view";
import { usePreview } from "@/preview/usePreview";
import { Alert, Button, IconButton, Segment, Sheet, Skeleton, Text } from "@/ui";

export type PageLens = "person" | "parser";

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
	const highlighted = highlightTerm ? targetsMentioning(check.data, highlightTerm) : [];

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
