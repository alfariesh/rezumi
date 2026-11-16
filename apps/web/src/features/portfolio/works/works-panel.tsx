import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { ReactNode } from "react";
import { Button, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { useRemovalFocus } from "../blocks/list-focus";
import { moveItem } from "../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { portfolioImageSrc } from "../images/image-field";
import { AddWorkDialog } from "./add-work/add-work-dialog";
import { usePortfolioLimits } from "./limits";
import { StorageMeter } from "./storage-meter";
import { WorkDocument } from "./work-document";
import { workRoom } from "./works";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";
import { usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { useEditorStore } from "@/features/resume/editor/store";
import { useConfirm } from "@/hooks/use-confirm";

/**
 * Work's panel: every work as a card, in page order. Picking one opens it on the canvas to write in. Phones have no
 * canvas beside the panel, so there the picked work opens in the sheet, with a way back to the list.
 */
export function WorksPanel() {
	const phone = useBreakpoint() === "mobile";
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const exists = usePortfolioData().works.items.some((work) => work.id === openWorkId);

	if (phone && openWorkId && exists)
		return (
			<div className="grid gap-2 pt-2">
				<Button
					size="sm"
					variant="ghost"
					className="ms-2 w-fit"
					onPress={() => usePortfolioEditorUi.getState().openWork(null)}
				>
					<Icon name="arrow-left" size={16} />
					<Trans>All works</Trans>
				</Button>
				<WorkDocument key={openWorkId} workId={openWorkId} />
			</div>
		);

	return (
		<div className="grid gap-4 p-3">
			<WorksList />
		</div>
	);
}

/** Opens a work on the canvas; a tablet's panel drawer gets out of the way unless it's pinned beside the page. */
function openOnCanvas(id: string) {
	const ui = usePortfolioEditorUi.getState();
	ui.openWork(id);
	ui.setWorkView("edit");
	const editor = useEditorStore.getState();
	if (!editor.drawerPinned) useEditorStore.setState({ drawerOpen: false });
}

/**
 * The works in page order, each a card that opens it. Hidden works stay listed; featured ones are marked. "Add work"
 * starts empty, from resume projects, from pictures or from a link, as far as the account's limit allows.
 */
function WorksList() {
	const { works } = usePortfolioData();
	const limits = usePortfolioLimits();
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const confirm = useConfirm();
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	const [adding, setAdding] = useState(false);
	const items = works.items;
	const plan = usePlan();
	const full = workRoom({ works }, limits.works) === 0;
	// Full because of the plan, not the technical limit: the button explains the plan instead of doing nothing.
	const planFull = full && Boolean(plan?.enabled) && limits.works < PORTFOLIO_LIMITS.works;

	const add = () =>
		full && planFull
			? openPlanDialog({ kind: "limit", limit: "portfolioWorks", max: limits.works, used: items.length })
			: setAdding(true);

	const remove = async (id: string, title: string) => {
		const confirmed = await confirm(t`Delete “${title}”?`, {
			description: t`The work and its blocks leave the portfolio. You can undo this.`,
			confirmText: t`Delete work`,
		});
		if (!confirmed) return;
		const now = usePortfolioEditorStore.getState().portfolio?.data.works.items ?? [];
		const index = now.findIndex((work) => work.id === id);
		if (index !== -1) removed(index);
		// The open work goes: its neighbor opens in its place, so the canvas isn't left empty.
		const ui = usePortfolioEditorUi.getState();
		if (ui.openWorkId === id) {
			const next = now[index + 1] ?? now[index - 1];
			ui.openWork(next?.id ?? null);
		}
		editPortfolio(
			(draft) => {
				draft.works.items = draft.works.items.filter((work) => work.id !== id);
			},
			{ structural: true },
		);
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<span className="flex-1 text-xs text-muted">
					{items.length > 0 ? (
						<Trans>
							{items.length} of {limits.works} works
						</Trans>
					) : (
						<Trans>No works yet</Trans>
					)}
				</span>
				<Button size="sm" variant="secondary" isDisabled={full && !planFull} onPress={add}>
					<Icon name="plus" size={16} />
					<Trans>Add work</Trans>
				</Button>
			</div>

			{items.length === 0 && (
				<button
					type="button"
					onClick={add}
					className="grid cursor-(--cursor-interactive) justify-items-center gap-2 rounded-2xl border border-dashed border-separator px-4 py-8 text-center outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
				>
					<Icon name="squares-four" size={24} className="text-muted" />
					<span className="text-sm font-medium">
						<Trans>Add your first work</Trans>
					</span>
					<span className="text-xs text-muted">
						<Trans>Start empty, or from resume projects, pictures or a link.</Trans>
					</span>
				</button>
			)}

			<SortableProvider
				onMove={(id, target) => {
					const from = items.findIndex((work) => work.id === id);
					if (from !== -1)
						editPortfolio((draft) => moveItem(draft.works.items, from, target.index), { structural: true });
				}}
			>
				<ul className="grid gap-2">
					{items.map((work, index) => {
						const title = work.title.trim() || t`Untitled work`;
						return (
							<WorkRow
								key={work.id}
								id={work.id}
								index={index}
								title={title}
								selected={work.id === openWorkId}
								itemProps={itemProps}
							>
								<WorkCardButton work={work} title={title} selected={work.id === openWorkId} />
								<div className="flex shrink-0 items-center opacity-70 group-hover/work:opacity-100">
									<IconButton
										icon={work.hidden ? "eye-slash" : "eye"}
										size="sm"
										aria-pressed={work.hidden}
										label={work.hidden ? t`Show ${title} on the page` : t`Hide ${title} from the page`}
										className={cn(work.hidden && "text-muted")}
										onPress={() =>
											editPortfolio((draft) => {
												// By id: the list may have moved since this row was drawn (a drop, Undo).
												const target = draft.works.items.find((item) => item.id === work.id);
												if (target) target.hidden = !target.hidden;
											})
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
							</WorkRow>
						);
					})}
				</ul>
			</SortableProvider>
			<div ref={fallbackRef}>
				<StorageMeter />
			</div>
			{adding && <AddWorkDialog onClose={() => setAdding(false)} />}
		</>
	);
}

type WorkCardButtonProps = { work: PortfolioWork; title: string; selected: boolean };

/** What opens a work: its cover, title, and whether it's featured or hidden, with how far its story has come. */
function WorkCardButton({ work, title, selected }: WorkCardButtonProps) {
	return (
		<button
			type="button"
			aria-current={selected ? "true" : undefined}
			onClick={() => openOnCanvas(work.id)}
			className="flex min-w-0 flex-1 cursor-(--cursor-interactive) items-center gap-3 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-focus"
		>
			{work.cover ? (
				<img
					src={portfolioImageSrc(work.cover)}
					alt=""
					className="aspect-4/3 w-16 shrink-0 rounded-lg object-cover"
					style={
						work.cover.focus
							? { objectPosition: `${work.cover.focus.x * 100}% ${work.cover.focus.y * 100}%` }
							: undefined
					}
				/>
			) : (
				<span className="grid aspect-4/3 w-16 shrink-0 place-items-center rounded-lg bg-default text-muted">
					<Icon name="image" size={20} />
				</span>
			)}
			<span className="grid min-w-0 gap-1">
				<span className={cn("truncate text-sm font-medium", work.hidden && "text-muted line-through")}>{title}</span>
				{(work.role.trim() || work.date.trim()) && (
					<span className="truncate text-xs text-muted">
						{[work.role.trim(), work.date.trim()].filter(Boolean).join(" · ")}
					</span>
				)}
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
					<Plural value={work.blocks.length} _0="No story yet" one="# block" other="# blocks" />
				</span>
			</span>
		</button>
	);
}

type WorkRowProps = {
	id: string;
	index: number;
	title: string;
	/** Open on the canvas. */
	selected: boolean;
	/** Marks the row for `useRemovalFocus`. */
	itemProps: Record<string, string>;
	children: ReactNode;
};

/** One work in the list: a drag handle, then what opens the work and its buttons. */
function WorkRow({ id, index, title, selected, itemProps, children }: WorkRowProps) {
	const sortable = useSortableItem({ id, list: "works", index, label: title });
	return (
		<li {...itemProps}>
			<div
				{...sortable.dropTargetProps}
				className={cn(
					"group/work relative flex items-center gap-1 rounded-2xl border p-2 transition-colors duration-quick",
					selected ? "border-accent bg-accent-soft/40" : "border-separator hover:bg-default/60",
					sortable.isDragging && "opacity-50",
				)}
			>
				<SortableEdge edge={sortable.edge} />
				<SortableHandle item={sortable} label={t`Reorder ${title}`} className="h-12 w-6" />
				{children}
			</div>
		</li>
	);
}
