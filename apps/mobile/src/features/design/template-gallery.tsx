import type { GalleryFilter } from "./types";
// Design → Templates: every template, filtered by field of work and layout, drawn from the person's own resume. A
// press tries a template on the page (phones show the page above the grid while trying; tablets show it beside the
// panel); Apply makes it the resume's template, with Undo. Leaving the gallery puts the page back.
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { TEMPLATES, matchesFilter, suitsCareerField, templateName } from "@rezumi/resume/design-presets";
import {
	setPreviewTemplate,
	useApplyTemplate,
	useClearPreviewOnLeave,
	useDesignDraft,
	usePreviewTemplate,
	usePreviewedDraft,
} from "./draft";
import { GalleryFilters } from "./gallery-filters";
import { TemplatePreviewCaption } from "./preview-caption";
import { TemplateCard } from "./template-card";
import { useThumbnailContent } from "./thumbnails";
import { nativeEnvironment } from "@/draft/native";
import { isLabelledTemplate, usePlan } from "@/features/billing/plan";
import { ResumePage } from "@/preview/page";
import { useIsTablet } from "@/shell/use-is-tablet";
import { Button, EmptyState, Skeleton, Text, space } from "@/ui";

export function TemplateGallery({ id }: { id: string }) {
	const { t } = useLingui();
	const draft = useDesignDraft(id);
	const { data } = draft;
	const header = <Stack.Screen options={{ title: t`Templates` }} />;
	if (!data) {
		return (
			<View className="flex-1 flex-row flex-wrap gap-3 bg-background p-4" accessibilityLabel={t`Loading`}>
				{header}
				{[0, 1, 2, 3].map((index) => (
					<Skeleton key={index} variant="none" className="aspect-[210/297] w-[47%] rounded-xl" />
				))}
			</View>
		);
	}
	return (
		<>
			{header}
			<Gallery id={id} opened={data} />
		</>
	);
}

type GalleryProps = {
	id: string;
	/** The resume when the gallery opened: previews draw from it, so an edit elsewhere doesn't redraw them all. */
	opened: ResumeData;
};

function Gallery({ id, opened }: GalleryProps) {
	const { t } = useLingui();
	const tablet = useIsTablet();
	const draft = useDesignDraft(id);
	const previewed = usePreviewedDraft(draft);
	const data = draft.data;
	const plan = usePlan();
	const tried = usePreviewTemplate();
	const apply = useApplyTemplate();
	useClearPreviewOnLeave();
	const [filter, setFilter] = useState<GalleryFilter>({ field: "all", layout: "all" });
	const [width, setWidth] = useState(0);
	const [snapshot] = useState(opened);
	const content = useThumbnailContent(snapshot);
	if (!data) return null;

	const current = data.metadata.template;
	const disabled = draft.locked;
	const listed = TEMPLATES;
	const shown = listed.filter(
		(template) => matchesFilter(template, filter.layout) && suitsCareerField(template, filter.field),
	);
	const columns = width >= 560 ? 3 : 2;
	const cardWidth = width > 0 ? (width - space[4] * 2 - space[3] * (columns - 1)) / columns : 0;
	const tryOn = (template: Template) =>
		setPreviewTemplate(template === current || template === tried ? null : template);

	return (
		<View
			testID="template-gallery"
			className="flex-1 bg-background"
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
		>
			{!tablet && tried ? (
				// Phones: the page with the template on it, above the grid, while trying one.
				<View className="h-[45%] border-b border-separator bg-surface-secondary">
					<ResumePage id={id} draft={previewed} focused={nativeEnvironment.focused()} />
					<TemplatePreviewCaption />
				</View>
			) : null}
			<FlatList
				key={columns}
				className="flex-1"
				data={cardWidth > 0 ? shown : []}
				numColumns={columns}
				keyExtractor={(template) => template}
				contentContainerClassName="gap-4 p-4"
				columnWrapperClassName="gap-3"
				initialNumToRender={6}
				windowSize={5}
				ListHeaderComponent={
					<GalleryFilters filter={filter} onChange={setFilter} shown={shown.length} listed={listed.length} />
				}
				renderItem={({ item: template }) => (
					<TemplateCard
						id={template}
						content={content}
						width={cardWidth}
						selected={template === current}
						trying={template === tried}
						labelled={isLabelledTemplate(plan, template)}
						disabled={disabled}
						onPress={() => tryOn(template)}
					/>
				)}
				ListEmptyComponent={
					cardWidth > 0 ? (
						<EmptyState
							kind="filtered"
							title={t`No template matches both filters.`}
							action={{ label: t`Show all templates`, onPress: () => setFilter({ field: "all", layout: "all" }) }}
						/>
					) : undefined
				}
			/>
			{tried ? (
				<View className="flex-row items-center gap-3 border-t border-separator bg-surface px-4 py-3">
					<Text numberOfLines={2} className="flex-1" accessibilityLiveRegion="polite">
						{t`Trying ${templateName(tried)} on the page`}
					</Text>
					<Button variant="tertiary" onPress={() => setPreviewTemplate(null)}>
						<Button.Label>{t`Cancel`}</Button.Label>
					</Button>
					<Button variant="primary" isDisabled={disabled} onPress={() => apply(tried)}>
						<Button.Label>{t`Apply`}</Button.Label>
					</Button>
				</View>
			) : null}
		</View>
	);
}
