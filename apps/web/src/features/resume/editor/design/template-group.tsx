import type { ThumbnailContent } from "./thumbnails";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { CareerField, Template } from "@rezumi/schema/templates";
import type { FocusEvent, KeyboardEvent, PointerEvent } from "react";
import { NativeSelect, Segment } from "@heroui-pro/react";
import { Button, Label, Slider, Tag, TagGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useInView } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
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
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { SEGMENT_ITEM } from "./style-groups";
import { thumbnailContent, useTemplateThumbnail } from "./thumbnails";
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

const layoutTags = (id: Template) => {
	const layout = templateLayouts[id];
	return [layout.columns === 1 ? t`One column` : t`Two columns`, layout.atsSafe ? t`ATS-safe` : null]
		.filter(Boolean)
		.join(" · ");
};

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

// Touch has no hover: holding a card this long previews it instead.
const HOLD_TO_PREVIEW_MS = 400;

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
			<NativeSelect variant="secondary" fullWidth>
				<NativeSelect.Trigger
					aria-label={t`Field of work`}
					value={field}
					onChange={(event) => setField(event.target.value as CareerField | "all")}
				>
					<NativeSelect.Option value="all">{t`All fields`}</NativeSelect.Option>
					{careerFields.map((id) => (
						<NativeSelect.Option key={id} value={id}>
							{i18n._(careerFieldNames[id])}
						</NativeSelect.Option>
					))}
					<NativeSelect.Indicator />
				</NativeSelect.Trigger>
			</NativeSelect>

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
						onPreview={() => useEditorStore.setState({ previewTemplate: id === current ? null : id })}
					/>
				))}
			</div>
			{shown.length === 0 && (
				<p className="text-sm text-muted">
					<Trans>No template matches both filters. Try All.</Trans>
				</p>
			)}

			<PresetPanel data={data} template={current} />

			{templateLayouts[current].columns === 2 && <SidebarPanel data={data} template={current} />}
		</div>
	);
}

type TemplateCardProps = {
	id: Template;
	data: ResumeData;
	content: ThumbnailContent;
	selected: boolean;
	/** Outside the free templates, while plans apply to the account. */
	labelled: boolean;
	/** The plan doesn't open it: it previews, but applying it explains the plan. */
	locked: boolean;
	onPreview: () => void;
};

function TemplateCard({ id, data, content, selected, labelled, locked, onPreview }: TemplateCardProps) {
	const ref = useRef<HTMLButtonElement>(null);
	// Only cards on or near the screen render, so a font or colour change doesn't re-render every template.
	const isInView = useInView(ref, { margin: "240px" });
	const { data: thumbnail } = useTemplateThumbnail(id, data, isInView, content);
	const metadata = templates[id];
	const hold = useRef<{ timer?: number; previewing: boolean }>({ previewing: false });

	const endHold = () => {
		window.clearTimeout(hold.current.timer);
		if (hold.current.previewing) useEditorStore.setState({ previewTemplate: null });
	};

	// A raw button: hover and hold preview the template and a press applies it, which a HeroUI Button's press
	// handling would fold together.
	return (
		<button
			ref={ref}
			type="button"
			aria-pressed={selected}
			onPointerEnter={(event: PointerEvent) => {
				if (event.pointerType !== "touch") onPreview();
			}}
			onPointerDown={(event: PointerEvent) => {
				if (event.pointerType !== "touch") return;
				hold.current.previewing = false;
				hold.current.timer = window.setTimeout(() => {
					hold.current.previewing = true;
					onPreview();
				}, HOLD_TO_PREVIEW_MS);
			}}
			onPointerUp={endHold}
			onPointerCancel={endHold}
			// A long press shows the preview; it doesn't open the system menu or apply the template.
			onContextMenu={(event) => event.preventDefault()}
			onFocus={onPreview}
			onClick={() => {
				if (hold.current.previewing) {
					hold.current.previewing = false;
					return;
				}
				applyTemplate(id, locked);
			}}
			className="group/card grid cursor-(--cursor-interactive) gap-1.5 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
		>
			{/* The paper is white in both themes; the inset hairline sits over the image so it shows on white pages. */}
			<span
				className={cn(
					"relative block aspect-page overflow-hidden rounded-xl bg-white transition-[translate,scale] duration-quick ease-enter group-hover/card:-translate-y-0.5 group-active/card:scale-[0.98]",
					"after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-black/5 after:ring-inset dark:after:ring-white/10",
					selected && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
				)}
			>
				<img src={thumbnail ?? metadata.imageUrl} alt="" className="size-full object-cover object-top" />
				{selected && (
					<span className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
						<Icon name="check" size={14} />
					</span>
				)}
				{labelled && !selected && <PlanBadge locked={locked} />}
			</span>
			<span className="text-sm leading-4 font-medium">{metadata.name}</span>
			<span className="text-xs leading-4 text-muted">{layoutTags(id)}</span>
		</button>
	);
}

type PlanBadgeProps = { locked: boolean };

/** "Plus" on a premium template's corner, with a lock while the plan doesn't open it. */
export function PlanBadge({ locked }: PlanBadgeProps) {
	return (
		<span className="absolute end-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-xs leading-4 font-medium text-white">
			{locked && <Icon name="lock" size={12} aria-hidden />}
			Plus
			{locked && <span className="sr-only">{t`Not in your plan`}</span>}
		</span>
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
			<p className="text-xs leading-4 text-muted">
				<Trans>
					The fonts, accent color, entry layout, skill keywords and photo shape {name} was designed with. Your content
					stays.
				</Trans>
			</p>
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
	const titleId = useId();

	return (
		<div className="grid gap-4 rounded-xl bg-surface-secondary p-4">
			<p id={titleId} className="text-sm font-medium">
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
			<Slider
				aria-labelledby={titleId}
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
				<Label>
					<Trans>Width</Trans>
				</Label>
				{/* The stored width: Advanced allows fractions the 1% steps here round away. */}
				<Slider.Output className="text-muted">{width}%</Slider.Output>
				<Slider.Track>
					<Slider.Fill />
					<Slider.Thumb />
				</Slider.Track>
			</Slider>
		</div>
	);
}
