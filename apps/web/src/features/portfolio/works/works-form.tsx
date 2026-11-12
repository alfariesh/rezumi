import { Button, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { useRemovalFocus } from "../blocks/list-focus";
import { moveItem } from "../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { portfolioImageSrc } from "../images/image-field";
import { AddWorkDialog } from "./add-work/add-work-dialog";
import { usePortfolioLimits } from "./limits";
import { StorageMeter } from "./storage-meter";
import { workRoom } from "./works";
import { usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { useConfirm } from "@/hooks/use-confirm";

/**
 * Work: the list of works in page order, each opening its own editor. Hidden works stay listed; featured ones are
 * marked. "Add work" starts empty, from resume projects, from pictures or from a link, as far as the account's limit
 * allows.
 */
export function WorksForm() {
	const { works } = usePortfolioData();
	const limits = usePortfolioLimits();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const confirm = useConfirm();
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	const [adding, setAdding] = useState(false);
	const items = works.items;
	const plan = usePlan();
	const full = workRoom({ works }, limits.works) === 0;
	// Full because of the plan, not the technical limit: the button explains the plan instead of doing nothing.
	const planFull = full && Boolean(plan?.enabled) && limits.works < PORTFOLIO_LIMITS.works;

	const remove = async (id: string, title: string) => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`The work and its blocks leave the portfolio. You can undo this.`,
			confirmText: t`Delete work`,
		});
		if (!confirmed) return;
		const now = usePortfolioEditorStore.getState().portfolio?.data.works.items ?? [];
		const index = now.findIndex((work) => work.id === id);
		if (index !== -1) removed(index);
		editPortfolio(
			(draft) => {
				draft.works.items = draft.works.items.filter((work) => work.id !== id);
			},
			{ structural: true },
		);
	};

	return (
		<div className="grid gap-3">
			<ul className="grid gap-2">
				{items.map((work, index) => {
					const title = work.title.trim() || t`Untitled work`;
					return (
						<li key={work.id} {...itemProps} className="flex items-center gap-2 rounded-xl border border-separator p-2">
							<button
								type="button"
								onClick={() => openWork(work.id)}
								className="flex min-w-0 flex-1 cursor-(--cursor-interactive) items-center gap-3 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus"
							>
								{work.cover ? (
									<img
										src={portfolioImageSrc(work.cover)}
										alt=""
										className="size-12 shrink-0 rounded-lg object-cover"
										style={
											work.cover.focus
												? { objectPosition: `${work.cover.focus.x * 100}% ${work.cover.focus.y * 100}%` }
												: undefined
										}
									/>
								) : (
									<span className="grid size-12 shrink-0 place-items-center rounded-lg bg-default text-muted">
										<Icon name="image" size={20} />
									</span>
								)}
								<span className="grid min-w-0 gap-0.5">
									<span className={cn("truncate text-sm font-medium", work.hidden && "text-muted line-through")}>
										{title}
									</span>
									<span className="flex flex-wrap items-center gap-1 text-xs text-muted">
										{work.featured && (
											<Chip size="sm" variant="soft" color="accent">
												<Trans>Featured</Trans>
											</Chip>
										)}
										{work.hidden && (
											<Chip size="sm" variant="soft">
												<Trans>Hidden</Trans>
											</Chip>
										)}
										<Plural value={work.blocks.length} _0="No blocks yet" one="# block" other="# blocks" />
									</span>
								</span>
							</button>
							<div className="flex shrink-0 items-center">
								<IconButton
									icon={work.hidden ? "eye-slash" : "eye"}
									size="sm"
									aria-pressed={work.hidden}
									label={work.hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
									className={cn(work.hidden && "text-muted")}
									onPress={() =>
										editPortfolio((draft) => {
											const target = draft.works.items[index];
											if (target) target.hidden = !target.hidden;
										})
									}
								/>
								<IconButton
									icon="arrow-up"
									size="sm"
									label={t`Move ${title} up`}
									isDisabled={index === 0}
									onPress={() =>
										editPortfolio((draft) => moveItem(draft.works.items, index, index - 1), { structural: true })
									}
								/>
								<IconButton
									icon="arrow-down"
									size="sm"
									label={t`Move ${title} down`}
									isDisabled={index === items.length - 1}
									onPress={() =>
										editPortfolio((draft) => moveItem(draft.works.items, index, index + 1), { structural: true })
									}
								/>
								<IconButton
									icon="trash"
									size="sm"
									label={t`Delete ${title}`}
									className="text-danger"
									onPress={() => void remove(work.id, title)}
								/>
							</div>
						</li>
					);
				})}
			</ul>
			<div ref={fallbackRef} className="flex flex-wrap items-center gap-3">
				<Button
					variant="secondary"
					isDisabled={full && !planFull}
					onPress={() =>
						full && planFull
							? openPlanDialog({ kind: "limit", limit: "portfolioWorks", max: limits.works, used: items.length })
							: setAdding(true)
					}
				>
					<Icon name="plus" size={18} />
					<Trans>Add work</Trans>
				</Button>
				{items.length > 0 && (
					<span className="text-xs text-muted">
						{items.length}/{limits.works}
					</span>
				)}
			</div>
			<StorageMeter />
			{adding && <AddWorkDialog onClose={() => setAdding(false)} />}
		</div>
	);
}
