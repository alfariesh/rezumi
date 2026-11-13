import type { ResumeData } from "@rezumi/schema/resume/data";
import type { CareerField, Template } from "@rezumi/schema/templates";
import type { FocusEvent, KeyboardEvent } from "react";
import { CellSlider, Segment } from "@heroui-pro/react";
import { Button, Tag, TagGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { applyTemplatePreset, hasTemplatePreset } from "@rezumi/resume/template-preset";
import {
	careerFields,
	templateCareerFields,
	templateLayouts,
	templateLineup,
	templatePresets,
} from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { isRTL } from "@rezumi/utils/locale";
import { useEditorStore } from "../store";
import { SEGMENT_ITEM } from "./style-groups";
import { TemplateCard } from "./template-card";
import { thumbnailContent } from "./thumbnails";
import { CellSelectField } from "@/components/input/select-field";
import { careerFieldNames, templates } from "@/dialogs/resume/template/data";
import { isLabelledTemplate, isLockedTemplate, usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { useResumeData, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";

type Filter = "all" | "one" | "two" | "ats";

// The lineup only: a resume on a former template keeps it, but it is no longer offered.
const TEMPLATE_IDS: readonly Template[] = templateLineup;

const matchesFilter = (id: Template, filter: Filter) => {
	const layout = templateLayouts[id];
	if (filter === "one") return layout.columns === 1;
	if (filter === "two") return layout.columns === 2;
	if (filter === "ats") return layout.atsSafe;
	return true;
};

const suitsField = (id: Template, field: CareerField | "all") =>
	field === "all" || (templateCareerFields[id] as readonly CareerField[]).includes(field);

/**
 * Applies a template with the page's cross-fade and an Undo toast. Font, size and colour carry across. A template the
 * plan doesn't open explains itself instead; previewing it still works.
 */
function applyTemplate(template: Template, locked: boolean) {
	const { resume, updateResumeData, undo } = useResumeStore.getState();
	useEditorStore.setState({ previewTemplate: null });
	if (!resume || resume.data.metadata.template === template) return;
	if (locked) return openPlanDialog({ kind: "feature", feature: "premiumTemplates" });

	updateResumeData(
		(draft) => {
			draft.metadata.template = template;
		},
		{ newStep: true },
	);
	toast.add({
		description: t`Template changed to ${templates[template].name}`,
		actionProps: { children: t`Undo`, onClick: undo },
	});
}

type TemplateGroupProps = {
	/** Phones: one horizontal strip of cards in the bottom sheet, instead of the two-column grid. */
	layout?: "grid" | "strip";
};

/**
 * Template: filter chips, then thumbnails drawn from the user's own content. Hovering or focusing one (holding
 * it, on touch) previews it on the page; leaving the cards or pressing Esc restores the page; a click applies it.
 */
export function TemplateGroup({ layout = "grid" }: TemplateGroupProps) {
	const { i18n } = useLingui();
	const data = useResumeData();
	const plan = usePlan();
	const [filter, setFilter] = useState<Filter>("all");
	const [field, setField] = useState<CareerField | "all">("all");
	// Leaving Design (by shortcut, say) never leaves a preview on the page.
	useEffect(() => () => useEditorStore.setState({ previewTemplate: null }), []);
	if (!data) return null;

	const current = data.metadata.template;
	const content = thumbnailContent(data);
	const shown = TEMPLATE_IDS.filter((id) => matchesFilter(id, filter) && suitsField(id, field));
	const filters: { id: Filter; label: string }[] = [
		{ id: "all", label: t`All` },
		{ id: "one", label: t`One column` },
		{ id: "two", label: t`Two columns` },
		{ id: "ats", label: t`ATS-safe` },
	];

	const onGridBlur = (event: FocusEvent<HTMLDivElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null))
			useEditorStore.setState({ previewTemplate: null });
	};
	const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Escape" || !useEditorStore.getState().previewTemplate) return;
		event.stopPropagation();
		useEditorStore.setState({ previewTemplate: null });
	};

	return (
		<div className="grid gap-3">
			<CellSelectField
				label={t`Field of work`}
				value={field}
				onChange={(value) => setField(value as CareerField | "all")}
				options={[
					{ value: "all", label: t`All fields` },
					...careerFields.map((id) => ({ value: id, label: i18n._(careerFieldNames[id]) })),
				]}
			/>

			{/* Chips rather than a segmented control: they wrap, so the four filters fit a 300px panel in any language. */}
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
				<TagGroup
					aria-label={t`Show templates`}
					selectionMode="single"
					disallowEmptySelection
					size="sm"
					selectedKeys={[filter]}
					onSelectionChange={(keys) => {
						const [key] = keys === "all" ? [] : [...keys];
						if (key) setFilter(key as Filter);
					}}
				>
					<TagGroup.List>
						{filters.map((option) => (
							<Tag key={option.id} id={option.id}>
								{option.label}
							</Tag>
						))}
					</TagGroup.List>
				</TagGroup>
				<span className="text-xs text-muted tabular-nums">
					<Trans>
						{shown.length} of {TEMPLATE_IDS.length} shown
					</Trans>
				</span>
			</div>

			{/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- listens for Esc and pointer exit from the cards; each card is a button. */}
			<div
				className={
					layout === "grid"
						? "grid grid-cols-2 gap-3"
						: "-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-2.5 *:w-28 *:shrink-0 *:snap-start"
				}
				onPointerLeave={() => useEditorStore.setState({ previewTemplate: null })}
				onBlur={onGridBlur}
				onKeyDown={onGridKeyDown}
			>
				{shown.map((id) => (
					<TemplateCard
						key={id}
						id={id}
						data={data}
						content={content}
						selected={id === current}
						labelled={isLabelledTemplate(plan, id)}
						locked={isLockedTemplate(plan, id)}
						onChoose={() => applyTemplate(id, isLockedTemplate(plan, id))}
						onPreview={() => useEditorStore.setState({ previewTemplate: id === current ? null : id })}
						onPreviewEnd={() => useEditorStore.setState({ previewTemplate: null })}
					/>
				))}
			</div>
			{shown.length === 0 && (
				<p className="text-body-sm text-muted">
					<Trans>No template matches both filters. Try All.</Trans>
				</p>
			)}

			<PresetPanel data={data} template={current} />

			{templateLayouts[current].columns === 2 && <SidebarPanel data={data} template={current} />}
		</div>
	);
}

type PresetPanelProps = { data: ResumeData; template: Template };

/**
 * The template's own look (`templatePresets`): its fonts and accent, shown before it's applied. Switching templates
 * keeps the user's fonts and colours; this applies the designed ones, with Undo.
 */
function PresetPanel({ data, template }: PresetPanelProps) {
	const updateResumeData = useUpdateResumeData();
	const preset = templatePresets[template];
	const name = templates[template].name;
	const inUse = hasTemplatePreset(data, template);
	const fonts =
		preset.heading.fontFamily === preset.body.fontFamily
			? preset.heading.fontFamily
			: `${preset.heading.fontFamily} · ${preset.body.fontFamily}`;

	const apply = () => {
		updateResumeData((draft) => applyTemplatePreset(draft, template), { newStep: true });
		toast.add({
			description: t`${name} style applied`,
			actionProps: { children: t`Undo`, onClick: () => useResumeStore.getState().undo() },
		});
	};

	return (
		<div className="grid gap-3 rounded-xl bg-surface-secondary p-4">
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className="size-6 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15"
					style={{ backgroundColor: preset.primary }}
				/>
				<div className="grid min-w-0 flex-1">
					<p className="text-sm font-medium">
						<Trans>{name} style</Trans>
					</p>
					<p className="truncate text-xs text-muted">{fonts}</p>
				</div>
			</div>
			<Button variant="secondary" size="sm" className="w-fit" isDisabled={inUse} onPress={apply}>
				<Icon name={inUse ? "check" : "palette"} size={16} />
				{inUse ? <Trans>Style in use</Trans> : <Trans>Use {name} style</Trans>}
			</Button>
		</div>
	);
}

type SidebarPanelProps = { data: ResumeData; template: Template };

/** Two-column templates: the sidebar's side and width. Write moves sections between columns. */
function SidebarPanel({ data, template }: SidebarPanelProps) {
	const updateResumeData = useUpdateResumeData();
	// The side the page shows now: the chosen one, else the template's own (mirrored on right-to-left pages).
	const ownSide = templateLayouts[template].sidebarSide ?? "left";
	const shownOwnSide = isRTL(data.metadata.page.locale) ? (ownSide === "left" ? "right" : "left") : ownSide;
	const side = data.metadata.layout.sidebarSide ?? shownOwnSide;
	const width = data.metadata.layout.sidebarWidth;

	return (
		<div className="grid gap-4 rounded-xl bg-surface-secondary p-4">
			<p className="text-sm font-medium">
				<Trans>Sidebar</Trans>
			</p>
			<Segment
				aria-label={t`Sidebar side`}
				selectedKey={side}
				onSelectionChange={(key) =>
					updateResumeData(
						(draft) => {
							draft.metadata.layout.sidebarSide = key === "right" ? "right" : "left";
						},
						{ newStep: true },
					)
				}
				className="w-full"
			>
				<Segment.Item id="left" className={SEGMENT_ITEM}>
					<Trans>Left</Trans>
				</Segment.Item>
				<Segment.Item id="right" className={SEGMENT_ITEM}>
					<Trans>Right</Trans>
				</Segment.Item>
			</Segment>
			<CellSlider
				aria-label={t`Width`}
				minValue={10}
				maxValue={50}
				step={1}
				value={width}
				onChange={(value) =>
					updateResumeData(
						(draft) => {
							draft.metadata.layout.sidebarWidth = Array.isArray(value) ? (value[0] ?? width) : value;
						},
						{ coalesceKey: "design.sidebarWidth" },
					)
				}
			>
				<CellSlider.Track>
					<CellSlider.Fill />
					<CellSlider.Thumb />
					<CellSlider.Label>
						<Trans>Width</Trans>
					</CellSlider.Label>
					{/* The stored width: Advanced allows fractions the 1% steps here round away. */}
					<CellSlider.Output>{width}%</CellSlider.Output>
				</CellSlider.Track>
			</CellSlider>
		</div>
	);
}
