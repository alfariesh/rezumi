import type { ListingActions } from "./listing-card";
import type { JobListingCard, JobListingMatch } from "@rezumi/schema/jobs/search";
import { Sheet } from "@heroui-pro/react";
import { Button, Chip, ScrollShadow, Skeleton, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { placeLabel, sourceLabel } from "./format";
import { ListingButtons, ListingFacts } from "./listing-card";
import { ListingFit } from "./listing-fit";
import { listingLogoUrl } from "./logo-color";
import { CompanyMark } from "@/features/applications/components/company-mark";
import { useClosingValue } from "@/hooks/use-closing-value";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";
import { renderAsH2, renderAsSpan } from "@/libs/typography";

type JobListingSheetProps = {
	listing: JobListingCard | null;
	/** Listing id → its skills against the Profile, from the search results. */
	matches: Record<string, JobListingMatch>;
	actions: ListingActions;
	onOpenChange: (open: boolean) => void;
};

/**
 * A listing in full over the results, on screens too narrow for the panel beside them (from the bottom on phones).
 */
export function JobListingSheet({ listing, matches, actions, onOpenChange }: JobListingSheetProps) {
	const phone = useBreakpoint() === "mobile";
	const [shown, onOpenChangeComplete] = useClosingValue(listing);

	return (
		<Sheet
			isOpen={Boolean(listing)}
			onOpenChange={onOpenChange}
			onAnimationEnd={onOpenChangeComplete}
			placement={phone ? "bottom" : "right"}
		>
			<Sheet.Backdrop>
				<Sheet.Content className={phone ? "h-svh" : "w-full sm:max-w-[520px]"}>
					<Sheet.Dialog className="bg-surface">
						{phone && <Sheet.Handle />}
						<Sheet.CloseTrigger aria-label={t`Close`} />
						{shown && (
							<ListingDetail key={shown.id} listing={shown} match={matches[shown.id]} actions={actions} inSheet />
						)}
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}

type ListingDetailProps = {
	listing: JobListingCard;
	match: JobListingMatch | undefined;
	actions: ListingActions;
	/** In the sheet (its heading names the dialog, and its close button sits top right), else in the panel. */
	inSheet?: boolean;
};

/**
 * A listing in full: the provider's description as plain text (never HTML: it's untrusted data), what it asks for, the
 * company, its fit, and its buttons. Shown in the panel beside the results on wide screens, in the sheet on others.
 */
export function ListingDetail({ listing, match, actions, inSheet = false }: ListingDetailProps) {
	const { i18n } = useLingui();
	const detail = useQuery({
		...orpc.jobs.listing.queryOptions({ input: { id: listing.id } }),
		staleTime: 10 * 60_000,
		// A listing that is gone stays gone.
		retry: (failures, error) => !(error instanceof ORPCError && error.code === "NOT_FOUND") && failures < 2,
	});
	const place = placeLabel(listing);
	const source = sourceLabel(listing);
	const posted = listing.postedAt ? formatRelativeTime(listing.postedAt, i18n.locale) : null;
	const { company } = listing;
	const companyFacts = [company.industry, company.size && t`${company.size} employees`].filter(Boolean).join(" · ");

	return (
		<ScrollShadow hideScrollBar className="h-full overflow-y-auto">
			<header className="grid gap-4 px-5 pt-5 pb-4">
				<div className={cn("flex items-start gap-3", inSheet && "pe-8")}>
					<CompanyMark company={company.name} logoUrl={listingLogoUrl(listing)} className="size-11 rounded-xl" />
					<div className="grid min-w-0 flex-1 gap-0.5">
						{inSheet ? (
							<Sheet.Heading>{listing.title}</Sheet.Heading>
						) : (
							<Typography type="h4" render={renderAsH2}>
								{listing.title}
							</Typography>
						)}
						<p className="text-body-sm text-muted">{[company.name, place].filter(Boolean).join(" · ")}</p>
					</div>
				</div>
				<ListingFacts listing={listing} match={match} />
				{(posted || source) && (
					<p className="text-body-xs text-muted">
						{posted && <Trans>Posted {posted}</Trans>}
						{posted && source && " · "}
						{source}
					</p>
				)}
				<ListingButtons listing={listing} actions={actions} size="md" />
			</header>

			<div className="grid gap-6 border-t border-separator px-5 pt-5 pb-8">
				<ListingFit listing={listing} />
				{listing.requirementsSummary && (
					<section className="grid gap-2">
						<Typography type="h5" render={renderAsSpan}>
							<Trans>What they ask for</Trans>
						</Typography>
						<p className="text-body-sm text-pretty">{listing.requirementsSummary}</p>
					</section>
				)}
				{listing.skills.length > 0 && (
					<section className="grid gap-2">
						<Typography type="h5" render={renderAsSpan}>
							<Trans>Skills</Trans>
						</Typography>
						{match ? <SkillMatch match={match} /> : null}
						<ul className="flex flex-wrap gap-1.5">
							{listing.skills.slice(0, 30).map((skill) => {
								const inProfile = match?.matched.some((name) => sameSkill(name, skill)) ?? false;
								return (
									<li key={skill}>
										<Chip size="sm" variant="soft" color={inProfile ? "success" : "default"} className="gap-1">
											{inProfile && <Icon name="check" size={14} />}
											<Chip.Label>{skill}</Chip.Label>
											{inProfile && (
												<span className="sr-only">
													<Trans>(in your Profile)</Trans>
												</span>
											)}
										</Chip>
									</li>
								);
							})}
						</ul>
					</section>
				)}
				<section className="grid gap-2" aria-busy={detail.isPending}>
					<Typography type="h5" render={renderAsSpan}>
						<Trans>About the job</Trans>
					</Typography>
					{detail.data ? (
						detail.data.description ? (
							// Plain text from the provider, kept as written: paragraphs and line breaks only.
							<p className="text-body-sm text-pretty whitespace-pre-line">{detail.data.description}</p>
						) : (
							<p className="text-body-sm text-muted">
								<Trans>The provider has no description for this job. The original posting has the details.</Trans>
							</p>
						)
					) : detail.error instanceof ORPCError && detail.error.code === "NOT_FOUND" ? (
						<p className="text-body-sm text-muted">
							<Trans>This listing isn't available anymore. The original posting may still have the details.</Trans>
						</p>
					) : detail.isError ? (
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-body-sm text-muted">
								<Trans>The description couldn't be loaded.</Trans>
							</p>
							<Button size="sm" variant="secondary" onPress={() => void detail.refetch()}>
								<Trans>Try again</Trans>
							</Button>
						</div>
					) : (
						<div className="grid gap-2">
							{Array.from({ length: 6 }, (_, index) => (
								<Skeleton key={index} className="h-4 rounded-md" />
							))}
						</div>
					)}
				</section>
				{(companyFacts || company.domain) && (
					<section className="grid gap-1">
						<Typography type="h5" render={renderAsSpan}>
							<Trans>About {company.name}</Trans>
						</Typography>
						{companyFacts && <p className="text-body-sm text-muted">{companyFacts}</p>}
						{company.domain && <p className="text-body-sm text-muted">{company.domain}</p>}
					</section>
				)}
				<p className="text-body-xs text-muted">
					<Trans>
						Listings come from job data providers and may change. The original posting is the one to apply through.
					</Trans>
				</p>
			</div>
		</ScrollShadow>
	);
}

/** A provider's skill and its name in the match: the match reads "sql-server" as "sql server". */
const sameSkill = (matched: string, skill: string) =>
	matched.toLocaleLowerCase() === skill.replace(/[-_]+/g, " ").trim().toLocaleLowerCase();

type SkillMatchProps = { match: JobListingMatch };

/** The free match in words: how many of the main skills the Profile mentions, without AI. */
function SkillMatch({ match }: SkillMatchProps) {
	const matched = match.matched.length;
	const total = matched + match.missing.length;
	return (
		<p className="text-body-sm text-pretty text-muted">
			{matched === 0 ? (
				<Trans>
					Your Profile doesn't mention these skills yet. Add the ones you have to your Profile, and matches show here.
				</Trans>
			) : (
				<Trans>
					Your Profile mentions {matched} of the {total} main skills this job names. A word match, without AI: check
					your fit for a closer look.
				</Trans>
			)}
		</p>
	);
}
