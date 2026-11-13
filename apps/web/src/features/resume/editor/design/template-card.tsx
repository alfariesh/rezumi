import type { ThumbnailContent } from "./thumbnails";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import type { PointerEvent } from "react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useInView } from "motion/react";
import { useRef } from "react";
import { templateLayouts } from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { useTemplateThumbnail } from "./thumbnails";
import { templateSample, templates } from "@/dialogs/resume/template/data";

const layoutTags = (id: Template) => {
	const layout = templateLayouts[id];
	return [layout.columns === 1 ? t`One column` : t`Two columns`, layout.atsSafe ? t`ATS-safe` : null]
		.filter(Boolean)
		.join(" · ");
};

// Touch has no hover: holding a card this long previews it instead.
const HOLD_TO_PREVIEW_MS = 400;

type TemplateCardProps = {
	id: Template;
	data: ResumeData;
	content: ThumbnailContent;
	selected: boolean;
	/** Outside the free templates, while plans apply to the account. */
	labelled: boolean;
	/** The plan doesn't open it: it previews, but choosing it explains the plan. */
	locked: boolean;
	onChoose: () => void;
	/** Hover, focus or a held touch shows it somewhere bigger (the builder's page); without it, a press just chooses. */
	onPreview?: (() => void) | undefined;
	/** A held touch let go, after previewing. */
	onPreviewEnd?: (() => void) | undefined;
};

/**
 * A template's card: its first page drawn from the person's own content (the sample page until that's ready), its
 * name and layout. The builder's Design panel and onboarding's first resume both use it.
 */
export function TemplateCard(props: TemplateCardProps) {
	const { id, data, content, selected, labelled, locked, onChoose, onPreview, onPreviewEnd } = props;
	const ref = useRef<HTMLButtonElement>(null);
	// Only cards on or near the screen render, so a font or colour change doesn't re-render every template.
	const isInView = useInView(ref, { margin: "240px" });
	const { data: thumbnail } = useTemplateThumbnail(id, data, isInView, content);
	const metadata = templates[id];
	const { i18n } = useLingui();
	const hold = useRef<{ timer?: number; previewing: boolean }>({ previewing: false });

	const endHold = () => {
		window.clearTimeout(hold.current.timer);
		if (hold.current.previewing) onPreviewEnd?.();
	};

	// A raw button: hover and hold preview the template and a press chooses it, which a HeroUI Button's press
	// handling would fold together.
	return (
		<button
			ref={ref}
			type="button"
			aria-pressed={selected}
			onPointerEnter={(event: PointerEvent) => {
				if (event.pointerType !== "touch") onPreview?.();
			}}
			onPointerDown={(event: PointerEvent) => {
				if (event.pointerType !== "touch" || !onPreview) return;
				hold.current.previewing = false;
				hold.current.timer = window.setTimeout(() => {
					hold.current.previewing = true;
					onPreview();
				}, HOLD_TO_PREVIEW_MS);
			}}
			onPointerUp={endHold}
			onPointerCancel={endHold}
			// A long press shows the preview; it doesn't open the system menu or choose the template.
			onContextMenu={(event) => {
				if (onPreview) event.preventDefault();
			}}
			onFocus={() => onPreview?.()}
			onClick={() => {
				if (hold.current.previewing) {
					hold.current.previewing = false;
					return;
				}
				onChoose();
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
				<img
					src={thumbnail ?? templateSample(id, i18n.locale).image}
					alt=""
					className="size-full object-cover object-top"
				/>
				{selected && (
					<span className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
						<Icon name="check" size={14} />
					</span>
				)}
				{labelled && !selected && <PlanBadge locked={locked} />}
			</span>
			<span className="text-sm leading-4 font-medium">{metadata.name}</span>
			<span className="text-xs text-muted">{layoutTags(id)}</span>
		</button>
	);
}

type PlanBadgeProps = { locked: boolean };

/** "Plus" on a premium template's corner, with a lock while the plan doesn't open it. */
export function PlanBadge({ locked }: PlanBadgeProps) {
	return (
		<span className="absolute end-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
			{locked && <Icon name="lock" size={12} aria-hidden />}
			Plus
			{locked && <span className="sr-only">{t`Not in your plan`}</span>}
		</span>
	);
}
