import type { WorkDraft } from "@rezumi/schema/profile/website-import";
import { Button, Checkbox } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { ENTER_CLASS, stagger } from "@/libs/motion";

type SiteWorksReviewProps = {
	works: WorkDraft[];
	chosen: ReadonlySet<string>;
	onToggle: (id: string, selected: boolean) => void;
	/** Drafts the portfolio already has: marked, and not ticked. */
	imported: ReadonlySet<string>;
	/** Works the plan still allows. */
	room: number;
	/** The plan's limit, when upgrading makes more room. */
	planLimit: number | null;
	/** Whether the account has a portfolio yet: without one, saving makes it, unpublished. */
	hasPortfolio: boolean;
	/** Whether that portfolio is published: added works show on it at once. */
	published: boolean;
	index?: number;
};

/**
 * "Works from your site": each work an import found as a card, the new ones ticked. A plan's room caps how many can be
 * ticked, with the way to upgrade; works the portfolio has are marked. Nothing is saved here.
 */
export function SiteWorksReview(props: SiteWorksReviewProps) {
	const { works, chosen, onToggle, imported, room, planLimit, hasPortfolio, published, index = 0 } = props;
	const titleId = useId();
	const fresh = works.filter((work) => !imported.has(work.id));
	const kept = chosen.size;
	const full = kept >= room;
	// More new works than room: some stay unticked unless the plan grows.
	const capped = planLimit !== null && fresh.length > room;

	return (
		<section
			aria-labelledby={titleId}
			className={cn(ENTER_CLASS, "grid gap-1 rounded-xl bg-surface-secondary p-2 fields-on-card")}
			style={stagger(index)}
		>
			<div className="flex items-center gap-2 px-2 py-1.5">
				<Icon name="squares-four" size={18} className="text-muted" />
				<span id={titleId} className="text-sm font-semibold">
					<Trans>Works from your site</Trans>
				</span>
				<span className="ms-auto text-xs text-muted tabular-nums">
					<Trans>
						{kept} of {works.length}
					</Trans>
				</span>
			</div>
			<ul className="grid gap-0.5">
				{works.map((work) => (
					<li key={work.id}>
						<DraftRow
							work={work}
							included={chosen.has(work.id)}
							imported={imported.has(work.id)}
							blocked={!chosen.has(work.id) && full}
							onToggle={onToggle}
						/>
					</li>
				))}
			</ul>
			{capped && (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-default px-3 py-2">
					<p className="min-w-0 flex-1 text-body-xs text-muted">
						<Plural
							value={planLimit}
							one="Your plan holds # work in the portfolio. Upgrade to add them all."
							other="Your plan holds # works in the portfolio. Upgrade to add them all."
						/>
					</p>
					<Button
						size="sm"
						variant="secondary"
						onPress={() =>
							openPlanDialog({ kind: "limit", limit: "portfolioWorks", max: planLimit, used: planLimit - room })
						}
					>
						<Trans>Upgrade</Trans>
					</Button>
				</div>
			)}
			<div className="grid gap-0.5 px-2 pt-1 pb-1">
				<p className="text-body-xs text-muted">
					{published ? (
						<Trans>Works are added to your published portfolio and show on it right away.</Trans>
					) : hasPortfolio ? (
						<Trans>Works are added to your portfolio. It isn't published, so nobody sees them yet.</Trans>
					) : (
						<Trans>Works go into a new portfolio that isn't published. You decide when to publish it.</Trans>
					)}
				</p>
				<p className="text-body-xs text-muted">
					<Trans>Pictures are copied to your portfolio's storage and count toward its space.</Trans>
				</p>
			</div>
		</section>
	);
}

type DraftRowProps = {
	work: WorkDraft;
	included: boolean;
	imported: boolean;
	/** Can't be ticked: the plan's room is used. */
	blocked: boolean;
	onToggle: (id: string, selected: boolean) => void;
};

/** One work: its cover, title, role and year, summary and how many pictures come along; details open below. */
function DraftRow({ work, included, imported, blocked, onToggle }: DraftRowProps) {
	const [open, setOpen] = useState(false);
	const detailId = useId();
	const pictures = (work.cover ? 1 : 0) + work.gallery.length;
	const meta = [work.role, work.date].map((part) => part.trim()).filter(Boolean);
	const dimmed = !included || imported;

	return (
		<div className="grid gap-1 rounded-lg">
			<div className="flex items-start gap-1">
				<Checkbox
					isSelected={included}
					isDisabled={imported || blocked}
					onChange={(selected) => onToggle(work.id, selected)}
					className="min-w-0 flex-1 rounded-lg px-2 py-1.5"
				>
					<Checkbox.Content className="w-full items-start">
						<Checkbox.Control className="mt-0.5">
							<Checkbox.Indicator />
						</Checkbox.Control>
						<span className={cn("flex min-w-0 flex-1 gap-3 transition-opacity duration-quick", dimmed && "opacity-60")}>
							<Cover work={work} />
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="text-sm font-medium break-words">{work.title}</span>
								{meta.length > 0 && <span className="truncate text-body-xs text-muted">{meta.join(" · ")}</span>}
								{work.summary && <span className="line-clamp-1 text-body-xs text-muted">{work.summary}</span>}
								<span className="text-body-xs text-muted">
									{imported ? (
										<Trans>Already in your portfolio</Trans>
									) : (
										<Plural value={pictures} _0="No pictures" one="# picture" other="# pictures" />
									)}
								</span>
							</span>
						</span>
					</Checkbox.Content>
				</Checkbox>
				<IconButton
					icon="caret-down"
					size="sm"
					variant="ghost"
					label={open ? t`Hide details of ${work.title}` : t`Show details of ${work.title}`}
					aria-expanded={open}
					aria-controls={detailId}
					className={cn("mt-1 shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")}
					onPress={() => setOpen((value) => !value)}
				/>
			</div>
			{open && <DraftDetail id={detailId} work={work} />}
		</div>
	);
}

type CoverProps = { work: WorkDraft };

/** The work's cover as the site shows it (it's copied only when saved), or a placeholder. */
function Cover({ work }: CoverProps) {
	const [failed, setFailed] = useState(false);
	if (!work.cover || failed)
		return (
			<span className="grid aspect-4/3 w-16 shrink-0 place-items-center self-start rounded-md bg-default text-muted">
				<Icon name="image" size={20} />
			</span>
		);
	return (
		<img
			src={work.cover.url}
			alt=""
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={() => setFailed(true)}
			className="aspect-4/3 w-16 shrink-0 self-start rounded-md bg-default object-cover"
		/>
	);
}

type DraftDetailProps = { id: string; work: WorkDraft };

/** The rest of a work, read only: its whole summary, tags, a strip of its pictures, and its page on the site. */
function DraftDetail({ id, work }: DraftDetailProps) {
	const pictures = [work.cover, ...work.gallery].flatMap((picture) => (picture ? [picture] : []));
	return (
		<div id={id} className={cn(ENTER_CLASS, "grid gap-2 ps-9 pe-2 pb-2")}>
			{work.summary && <p className="text-body-sm">{work.summary}</p>}
			{work.tags.length > 0 && <p className="text-body-xs text-muted">{work.tags.join(" · ")}</p>}
			{pictures.length > 0 && (
				<ul className="flex gap-2 overflow-x-auto pb-1" aria-label={t`Pictures`}>
					{pictures.map((picture) => (
						<li key={picture.url} className="shrink-0">
							<img
								src={picture.url}
								alt={picture.alt}
								loading="lazy"
								referrerPolicy="no-referrer"
								className="aspect-4/3 h-16 rounded-md bg-default object-cover"
							/>
						</li>
					))}
				</ul>
			)}
			<a
				href={work.sourceUrl}
				target="_blank"
				rel="noreferrer noopener"
				className="flex w-fit items-center gap-1 text-body-xs text-muted underline-offset-2 hover:underline"
			>
				<Icon name="arrow-square-out" size={14} />
				<span className="truncate" dir="ltr">
					{work.sourceUrl.replace(/^https?:\/\//, "")}
				</span>
			</a>
		</div>
	);
}
