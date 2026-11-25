import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { Button, ToggleButton, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { formatMetric } from "@rezumi/portfolio/metric";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { AiRewriteMenu } from "../ai/rewrite-menu";
import { BlockList, editWork } from "../blocks/block-list";
import { blockRoom, insertBlocksAt, newTextBlock } from "../blocks/blocks";
import { pageLocaleOf, usePortfolioSource } from "../editor/context";
import { ChoiceSelect, TextInput, UrlInput } from "../editor/fields";
import { editPortfolio, lastSavedData, usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { ImageField, portfolioImageSrc } from "../images/image-field";
import { workMetrics } from "../metrics/metrics";
import { focusTextBlock, focusWorkSummary } from "./doc-focus";
import { WorkAddress } from "./work-address";
import { retitleWork } from "./works";
import { ChipInput } from "@/components/input/chip-input";
import { useConfirm } from "@/hooks/use-confirm";

const { text: max } = PORTFOLIO_LIMITS;

type Update = (recipe: (draft: PortfolioWork) => void, key?: string) => void;

type WorkDocumentProps = { workId: string };

/**
 * One work as a document to write (Work in the editor): the cover, a big title, the one-line summary, its details
 * folded into a line, then the story as blocks that read like the page. On a phone (in the sheet) the blocks keep
 * their framed cards, whose controls don't need room beside the text.
 */
export function WorkDocument({ workId }: WorkDocumentProps) {
	const data = usePortfolioData();
	const source = usePortfolioSource();
	const phone = useBreakpoint() === "mobile";
	const work = data.works.items.find((entry) => entry.id === workId);
	if (!work) return null;

	const locale = pageLocaleOf(data, source.designData);
	const update: Update = (recipe, key) =>
		editWork(workId, (draft) => recipe(draft as PortfolioWork), key ? { key: `works.${workId}.${key}` } : undefined);

	return (
		<div data-work-doc={workId} className={cn("grid gap-6", phone && "px-3 pb-6")}>
			<WorkStatus work={work} update={update} />
			<Cover work={work} update={update} />

			<div className="grid gap-3">
				<TitleInput work={work} />
				<SummaryInput work={work} update={update} inline={phone} />
			</div>

			<Details work={work} locale={locale} update={update} />

			<hr className="border-separator" />

			<section aria-label={t`Story`} className="grid gap-2">
				<BlockList work={work} locale={locale} appearance={phone ? "panel" : "document"} />
			</section>
		</div>
	);
}

type PartProps = { work: PortfolioWork; update: Update };

/** The top of the document: whether the work is featured and shown, and Delete. */
function WorkStatus({ work, update }: PartProps) {
	const confirm = useConfirm();
	const title = work.title.trim() || t`Untitled work`;

	const remove = async () => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`The work and its blocks leave the portfolio. You can undo this.`,
			confirmText: t`Delete work`,
		});
		if (!confirmed) return;
		// Its neighbor opens in its place, so the canvas isn't left empty.
		const items = usePortfolioEditorStore.getState().portfolio?.data.works.items ?? [];
		const index = items.findIndex((entry) => entry.id === work.id);
		usePortfolioEditorUi.getState().openWork(items[index + 1]?.id ?? items[index - 1]?.id ?? null);
		editPortfolio(
			(draft) => {
				draft.works.items = draft.works.items.filter((entry) => entry.id !== work.id);
			},
			{ structural: true },
		);
	};

	return (
		<div className="flex flex-wrap items-center gap-1">
			<ToggleButton
				size="sm"
				variant="ghost"
				isSelected={work.featured}
				onChange={(featured) =>
					update((draft) => {
						draft.featured = featured;
					})
				}
				className={cn("gap-1.5 text-xs", work.featured ? "text-accent" : "text-muted")}
			>
				<Icon name="star" size={16} variant={work.featured ? "duotone" : "stroke"} />
				<Trans>Featured</Trans>
			</ToggleButton>
			<ToggleButton
				size="sm"
				variant="ghost"
				isSelected={work.hidden}
				onChange={(hidden) =>
					update((draft) => {
						draft.hidden = hidden;
					})
				}
				className={cn("gap-1.5 text-xs", work.hidden ? "text-warning" : "text-muted")}
			>
				<Icon name={work.hidden ? "eye-slash" : "eye"} size={16} />
				{work.hidden ? <Trans>Hidden from the page</Trans> : <Trans>Shown on the page</Trans>}
			</ToggleButton>
			<span className="flex-1" />
			<Tooltip>
				<Tooltip.Trigger>
					<Button
						size="sm"
						variant="ghost"
						isIconOnly
						aria-label={t`Delete ${title}`}
						className="text-muted hover:text-danger"
						onPress={() => void remove()}
					>
						<Icon name="trash" size={16} />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					<Trans>Delete work</Trans>
				</Tooltip.Content>
			</Tooltip>
		</div>
	);
}

/**
 * The cover: shown wide, as on the work's card, with Edit for its focus point, description and file. Without one,
 * the picture field takes its place.
 */
function Cover({ work, update }: PartProps) {
	const [editing, setEditing] = useState(false);
	const cover = work.cover;

	if (cover && !editing)
		return (
			<div className="group/cover relative overflow-hidden rounded-2xl">
				<img
					src={portfolioImageSrc(cover, false)}
					alt={cover.alt}
					className="aspect-video w-full object-cover"
					style={cover.focus ? { objectPosition: `${cover.focus.x * 100}% ${cover.focus.y * 100}%` } : undefined}
				/>
				<Button
					size="sm"
					variant="secondary"
					className="absolute end-3 bottom-3 opacity-0 shadow-overlay transition-opacity duration-quick group-focus-within/cover:opacity-100 group-hover/cover:opacity-100 pointer-coarse:opacity-100"
					onPress={() => setEditing(true)}
				>
					<Icon name="image" size={16} />
					<Trans>Edit cover</Trans>
				</Button>
			</div>
		);

	return (
		<div className="grid gap-2">
			<ImageField
				label={t`Cover picture`}
				uploadKey={`works.${work.id}.cover`}
				value={cover}
				altSuggestion={work.title.trim()}
				onChange={(image, typing) =>
					update(
						(draft) => {
							if (image) draft.cover = image;
							else delete draft.cover;
						},
						typing ? "cover.alt" : undefined,
					)
				}
				focus={{
					value: cover?.focus,
					onChange: (focus) =>
						update((draft) => {
							if (draft.cover) draft.cover.focus = focus;
						}, "focus"),
				}}
			/>
			{editing && (
				<Button size="sm" variant="secondary" className="w-fit" onPress={() => setEditing(false)}>
					<Icon name="check" size={16} />
					<Trans>Done</Trans>
				</Button>
			)}
		</div>
	);
}

// The text size is set on a wrapper and inherited: touch screens give every field `max(16px, 1em)` (globals.css, so
// iOS doesn't zoom in), which a size utility on the field itself can't beat but an inherited `1em` follows.
const BARE_FIELD =
	"w-full resize-none bg-transparent outline-none field-sizing-content placeholder:text-muted/70 focus-visible:outline-none";

/** The title, as big as on the page. Renaming moves the work's address along until the address is set by hand. */
function TitleInput({ work }: { work: PortfolioWork }) {
	return (
		<div className="text-3xl leading-tight font-semibold tracking-tight">
			<textarea
				rows={1}
				value={work.title}
				maxLength={max.workTitle}
				aria-label={t`Title`}
				placeholder={t`Name this work`}
				data-doc-part="title"
				// A title is one line: Enter moves on to the summary instead of breaking it.
				onKeyDown={(event) => {
					if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
					event.preventDefault();
					focusWorkSummary(work.id);
				}}
				onChange={(event) => {
					const value = event.currentTarget.value.replace(/\s*\n\s*/g, " ");
					editPortfolio(
						(draft) => {
							const target = draft.works.items.find((entry) => entry.id === work.id);
							if (target) retitleWork(draft, target as PortfolioWork, value, lastSavedData());
						},
						{ key: `works.${work.id}.title` },
					);
				}}
				className={BARE_FIELD}
			/>
		</div>
	);
}

type SummaryInputProps = PartProps & {
	/** AI under the field instead of beside it: a phone's sheet has no room at the side. */
	inline: boolean;
};

/** The summary under the title: what the work's card says. AI can shorten or polish it. */
function SummaryInput({ work, update, inline }: SummaryInputProps) {
	const change = (value: string) =>
		update((draft) => {
			draft.summary = value;
		}, "summary");

	return (
		<div className="group/summary relative text-lg leading-relaxed">
			<textarea
				rows={1}
				value={work.summary}
				maxLength={max.workSummary}
				aria-label={t`Summary`}
				data-doc-part="summary"
				placeholder={t`One or two lines: what you made, for whom, and what changed.`}
				// The card shows one paragraph: Enter moves on into the story.
				onKeyDown={(event) => {
					if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
					event.preventDefault();
					startStory(work);
				}}
				onChange={(event) => change(event.currentTarget.value)}
				className={cn(BARE_FIELD, "text-muted")}
			/>
			<span
				className={
					inline
						? "flex justify-end"
						: "absolute -end-14 top-0.5 opacity-0 transition-opacity duration-quick group-focus-within/summary:opacity-100 group-hover/summary:opacity-100 has-[[aria-expanded=true]]:opacity-100 pointer-coarse:opacity-100"
				}
			>
				<AiRewriteMenu field="workSummary" value={work.summary} onResult={change} />
			</span>
			{work.summary.length >= max.workSummary * 0.8 && (
				<span className="block text-end text-xs leading-4 text-muted tabular-nums">
					{work.summary.length}/{max.workSummary}
				</span>
			)}
		</div>
	);
}

type DetailsProps = PartProps & { locale: string };

/**
 * The work's details (role, year, tags, address, main link, the metric on its card) folded into one line under the
 * summary; it opens to edit them, so the page starts on the writing.
 */
function Details({ work, locale, update }: DetailsProps) {
	const [open, setOpen] = useState(false);
	const regionId = useId();
	const metrics = workMetrics(work).filter((metric) => metric.label.trim());
	const facts = [
		work.role.trim(),
		work.date.trim(),
		...work.tags.slice(0, 3).map((tag) => `#${tag}`),
		work.primaryLink ? t`Link` : "",
	].filter(Boolean);

	return (
		<div className="grid gap-3">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={regionId}
				onClick={() => setOpen(!open)}
				className="flex min-w-0 cursor-(--cursor-interactive) items-center gap-2 rounded-lg py-1 text-start text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
			>
				<Icon name="sliders-horizontal" size={16} className="shrink-0" />
				<span className="min-w-0 flex-1 truncate">
					{facts.length ? facts.join(" · ") : <Trans>Role, year, tags and link</Trans>}
				</span>
				{work.tags.length > 3 && (
					<span className="shrink-0 text-xs">
						<Plural value={work.tags.length - 3} one="+# tag" other="+# tags" />
					</span>
				)}
				<Icon
					name="caret-down"
					size={14}
					className={cn("shrink-0 transition-transform duration-quick", open && "rotate-180")}
				/>
			</button>
			{open && (
				<div id={regionId} className="grid gap-4 rounded-2xl bg-default/50 p-4">
					<div className="grid gap-3 @lg:grid-cols-2">
						<TextInput
							label={t`Your role`}
							icon="briefcase"
							value={work.role}
							maxLength={max.workRole}
							placeholder={t`Lead designer`}
							onChange={(value) =>
								update((draft) => {
									draft.role = value;
								}, "role")
							}
						/>
						<TextInput
							label={t`Year`}
							icon="calendar-blank"
							value={work.date}
							maxLength={max.workDate}
							placeholder={t`2025 or Jan–Mar 2025`}
							onChange={(value) =>
								update((draft) => {
									draft.date = value;
								}, "date")
							}
						/>
					</div>
					<div className="grid gap-1.5">
						<span className="text-sm font-medium">
							<Trans>Tags</Trans>
						</span>
						<ChipInput
							allowCommas
							aria-label={t`Tags`}
							value={work.tags}
							onChange={(tags) =>
								update((draft) => {
									draft.tags = [...new Set(tags.map((tag) => tag.trim().slice(0, max.tag)).filter(Boolean))].slice(
										0,
										PORTFOLIO_LIMITS.tagsPerWork,
									);
								})
							}
						/>
					</div>
					<div className="grid gap-3 @lg:grid-cols-2">
						<UrlInput
							label={t`Main link (optional)`}
							value={work.primaryLink?.url}
							onChange={(url) =>
								update((draft) => {
									if (url) draft.primaryLink = { label: draft.primaryLink?.label ?? "", url };
									else delete draft.primaryLink;
								}, "primaryLink.url")
							}
						/>
						<TextInput
							label={t`Link text`}
							icon="text-t"
							value={work.primaryLink?.label ?? ""}
							maxLength={max.buttonLabel}
							placeholder={t`See the live site`}
							isDisabled={!work.primaryLink}
							onChange={(label) =>
								update((draft) => {
									if (draft.primaryLink) draft.primaryLink.label = label;
								}, "link.label")
							}
						/>
					</div>
					<ChoiceSelect
						label={t`Metric on the card`}
						value={work.highlightMetricId ?? "none"}
						options={[
							{ id: "none", label: t`None` },
							...metrics.map((metric) => ({
								id: metric.id,
								label: `${formatMetric(metric, locale)} ${metric.label.trim()}`,
							})),
						]}
						onChange={(id) =>
							update((draft) => {
								if (id === "none") delete draft.highlightMetricId;
								else draft.highlightMetricId = id;
							})
						}
					/>
					<WorkAddress work={work} />
				</div>
			)}
		</div>
	);
}

/** From the summary into the story: the first text block, or a new paragraph at its start when there's none. */
function startStory(work: PortfolioWork) {
	const text = work.blocks.find((block) => block.type === "text");
	if (text) {
		focusTextBlock(text.id);
		return;
	}
	if (blockRoom(work) === 0) return;
	const block = newTextBlock();
	editWork(work.id, (draft) => void insertBlocksAt(draft as PortfolioWork, { after: null }, [block]), {
		structural: true,
	});
	focusTextBlock(block.id);
}
