import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { Button, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef } from "react";
import { formatMetric } from "@rezumi/portfolio/metric";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { BlockList, editWork } from "../blocks/block-list";
import { pageLocaleOf, usePortfolioOwner, useSourceResume } from "../editor/context";
import { ChoiceSelect, PanelGroup, TextInput, UrlInput } from "../editor/fields";
import { editPortfolio, usePortfolioData } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { ImageField } from "../images/image-field";
import { workMetrics } from "../metrics/metrics";
import { retitleWork } from "./works";
import { ChipInput } from "@/components/input/chip-input";
import { useConfirm } from "@/hooks/use-confirm";

const { text: max } = PORTFOLIO_LIMITS;

type WorkEditorProps = { workId: string };

/**
 * One work, opened from the Work section: its card (cover with focus point, title, summary, role, year, tags, the
 * metric it highlights, main link, featured, hidden) and its detail as blocks. The preview shows the detail meanwhile.
 */
export function WorkEditor({ workId }: WorkEditorProps) {
	const top = useRef<HTMLDivElement>(null);
	// Opened from far down the section list: start at the work's top.
	useEffect(() => {
		top.current?.scrollIntoView({ block: "start" });
	}, [workId]);
	const data = usePortfolioData();
	const source = useSourceResume();
	const owner = usePortfolioOwner();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const confirm = useConfirm();
	const work = data.works.items.find((entry) => entry.id === workId);
	if (!work) return null;

	const locale = pageLocaleOf(data, source.data);
	const title = work.title.trim() || t`Untitled work`;
	const metrics = workMetrics(work).filter((metric) => metric.label.trim());
	const update = (recipe: (draft: PortfolioWork) => void, key?: string) =>
		editWork(workId, (draft) => recipe(draft as PortfolioWork), key ? { key: `works.${workId}.${key}` } : undefined);

	const remove = async () => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`The work and its blocks leave the portfolio. You can undo this.`,
			confirmText: t`Delete work`,
		});
		if (!confirmed) return;
		openWork(null);
		editPortfolio(
			(draft) => {
				draft.works.items = draft.works.items.filter((entry) => entry.id !== workId);
			},
			{ structural: true },
		);
	};

	return (
		<div ref={top} className="grid scroll-mt-3 gap-3 p-3">
			<div className="flex items-center gap-2">
				<Button size="sm" variant="ghost" onPress={() => openWork(null)}>
					<Icon name="arrow-left" size={16} />
					<Trans>All sections</Trans>
				</Button>
				<span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
				{work.hidden && (
					<Chip size="sm" variant="soft">
						<Trans>Hidden</Trans>
					</Chip>
				)}
			</div>

			<PanelGroup icon="squares-four" title={<Trans>Card</Trans>}>
				<ImageField
					label={t`Cover picture`}
					value={work.cover}
					altSuggestion={work.title.trim()}
					description={t`Shown on the card and atop the detail. Landscape pictures fit best.`}
					onChange={(image) =>
						update((draft) => {
							if (image) draft.cover = image;
							else delete draft.cover;
						})
					}
					focus={{
						value: work.cover?.focus,
						onChange: (focus) =>
							update((draft) => {
								if (draft.cover) draft.cover.focus = focus;
							}, "focus"),
					}}
				/>
				<TextInput
					label={t`Title`}
					value={work.title}
					maxLength={max.workTitle}
					placeholder={t`Kopi Senja checkout redesign`}
					description={
						owner.username ? t`Address: ${window.location.host}/${owner.username}#work-${work.slug}` : undefined
					}
					onChange={(value) =>
						editPortfolio(
							(draft) => {
								const target = draft.works.items.find((entry) => entry.id === workId);
								if (target) retitleWork(draft, target as PortfolioWork, value);
							},
							{ key: `works.${workId}.title` },
						)
					}
				/>
				<TextInput
					label={t`Summary`}
					multiline
					rewrite="workSummary"
					value={work.summary}
					maxLength={max.workSummary}
					placeholder={t`What you made, for whom, and what changed.`}
					description={t`One or two sentences on the card. ${work.summary.length}/${max.workSummary}`}
					onChange={(value) =>
						update((draft) => {
							draft.summary = value;
						}, "summary")
					}
				/>
				<div className="grid gap-3 @sm:grid-cols-2">
					<TextInput
						label={t`Your role`}
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
					<span className="text-xs text-muted">
						<Trans>
							Up to {PORTFOLIO_LIMITS.tagsPerWork}, such as “UX research” or “Figma”. Press Enter or a comma after each.
						</Trans>
					</span>
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
					description={
						metrics.length
							? t`One result from this work's Metrics blocks, shown as a chip on its card.`
							: t`Add a Metrics block below to show a result on the card.`
					}
					onChange={(id) =>
						update((draft) => {
							if (id === "none") delete draft.highlightMetricId;
							else draft.highlightMetricId = id;
						})
					}
				/>
				<div className="grid gap-3 @sm:grid-cols-2">
					<UrlInput
						label={t`Main link (optional)`}
						value={work.primaryLink?.url}
						onChange={(url) =>
							update((draft) => {
								if (url) draft.primaryLink = { label: draft.primaryLink?.label ?? "", url };
								else delete draft.primaryLink;
							})
						}
					/>
					<TextInput
						label={t`Link text`}
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
				<SwitchRow
					isSelected={work.featured}
					onChange={(featured) =>
						update((draft) => {
							draft.featured = featured;
						})
					}
					label={t`Featured`}
					description={t`Layouts that make room for it show this work larger.`}
					className="items-start py-0"
				/>
				<SwitchRow
					isSelected={work.hidden}
					onChange={(hidden) =>
						update((draft) => {
							draft.hidden = hidden;
						})
					}
					label={t`Hide from the page`}
					description={t`Kept here, but visitors don't see it.`}
					className="items-start py-0"
				/>
			</PanelGroup>

			<PanelGroup icon="rows" title={<Trans>Detail</Trans>}>
				<BlockList work={work} locale={locale} />
			</PanelGroup>

			<Button variant="danger-soft" className="w-fit" onPress={() => void remove()}>
				<Icon name="trash" size={18} />
				<Trans>Delete work</Trans>
			</Button>
		</div>
	);
}
