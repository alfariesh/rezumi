import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import type { FocusEvent, KeyboardEvent, PointerEvent } from "react";
import { Segment } from "@heroui-pro/react";
import { Label, Slider, Tag, TagGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useInView } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { templateLayouts } from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { isRTL } from "@rezumi/utils/locale";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { SEGMENT_ITEM } from "./style-groups";
import { useTemplateThumbnail } from "./thumbnails";
import { templates } from "@/dialogs/resume/template/data";
import { useResumeData, useResumeStore, useUpdateResumeData } from "@/features/resume/builder/draft";

type Filter = "all" | "one" | "two" | "ats";

const TEMPLATE_IDS = Object.keys(templates) as Template[];

const matchesFilter = (id: Template, filter: Filter) => {
	const layout = templateLayouts[id];
	if (filter === "one") return layout.columns === 1;
	if (filter === "two") return layout.columns === 2;
	if (filter === "ats") return layout.atsSafe;
	return true;
};

const layoutTags = (id: Template) => {
	const layout = templateLayouts[id];
	return [layout.columns === 1 ? t`One column` : t`Two columns`, layout.atsSafe ? t`ATS-safe` : null]
		.filter(Boolean)
		.join(" · ");
};

/** Applies a template with the page's cross-fade and an Undo toast. Font, size and colour carry across. */
function applyTemplate(template: Template) {
	const { resume, updateResumeData, undo } = useResumeStore.getState();
	useEditorStore.setState({ previewTemplate: null });
	if (!resume || resume.data.metadata.template === template) return;

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
	const data = useResumeData();
	const [filter, setFilter] = useState<Filter>("all");
	// Leaving Design (by shortcut, say) never leaves a preview on the page.
	useEffect(() => () => useEditorStore.setState({ previewTemplate: null }), []);
	if (!data) return null;

	const current = data.metadata.template;
	const shown = TEMPLATE_IDS.filter((id) => matchesFilter(id, filter));
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
						selected={id === current}
						onPreview={() => useEditorStore.setState({ previewTemplate: id === current ? null : id })}
					/>
				))}
			</div>

			{templateLayouts[current].columns === 2 && <SidebarPanel data={data} template={current} />}
		</div>
	);
}

type TemplateCardProps = { id: Template; data: ResumeData; selected: boolean; onPreview: () => void };

function TemplateCard({ id, data, selected, onPreview }: TemplateCardProps) {
	const ref = useRef<HTMLButtonElement>(null);
	// Only cards on or near the screen render, so a font or colour change doesn't re-render every template.
	const isInView = useInView(ref, { margin: "240px" });
	const { data: thumbnail } = useTemplateThumbnail(id, data, isInView);
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
				applyTemplate(id);
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
			</span>
			<span className="text-sm leading-4 font-medium">{metadata.name}</span>
			<span className="text-xs leading-4 text-muted">{layoutTags(id)}</span>
		</button>
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
