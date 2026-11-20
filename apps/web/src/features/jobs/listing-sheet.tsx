import type { ListingActions } from "./listing-card";
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { Sheet } from "@heroui-pro/react";
import { Button, Chip, ScrollShadow, Skeleton, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { placeLabel, sourceLabel } from "./format";
import { ListingButtons, ListingFacts } from "./listing-card";
import { CompanyMark } from "@/features/applications/components/company-mark";
import { useClosingValue } from "@/hooks/use-closing-value";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";
import { renderAsSpan } from "@/libs/typography";

type JobListingSheetProps = {
	listing: JobListingCard | null;
	actions: ListingActions;
	onOpenChange: (open: boolean) => void;
};

/**
 * A listing in full, beside the results (from the bottom on phones): the provider's description as plain text (never
 * HTML: it's untrusted data), what it asks for, the company, and the same buttons as its card.
 */
export function JobListingSheet({ listing, actions, onOpenChange }: JobListingSheetProps) {
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
						{shown && <ListingDetail key={shown.id} listing={shown} actions={actions} />}
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}

type ListingDetailProps = { listing: JobListingCard; actions: ListingActions };

function ListingDetail({ listing, actions }: ListingDetailProps) {
	const { i18n } = useLingui();
	const detail = useQuery({ ...orpc.jobs.listing.queryOptions({ input: { id: listing.id } }), staleTime: 10 * 60_000 });
	const place = placeLabel(listing);
	const source = sourceLabel(listing);
	const posted = listing.postedAt ? formatRelativeTime(listing.postedAt, i18n.locale) : null;
	const { company } = listing;
	const companyFacts = [company.industry, company.size && t`${company.size} employees`].filter(Boolean).join(" · ");

	return (
		<ScrollShadow hideScrollBar className="h-full overflow-y-auto">
			<header className="grid gap-4 px-5 pt-5 pb-4">
				<div className="flex items-start gap-3 pe-8">
					<CompanyMark company={company.name} logoUrl={company.logoUrl ?? null} className="size-11 rounded-xl" />
					<div className="grid min-w-0 flex-1 gap-0.5">
						<Sheet.Heading>{listing.title}</Sheet.Heading>
						<p className="text-body-sm text-muted">{[company.name, place].filter(Boolean).join(" · ")}</p>
					</div>
				</div>
				<ListingFacts listing={listing} />
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
						<ul className="flex flex-wrap gap-1.5">
							{listing.skills.slice(0, 30).map((skill) => (
								<li key={skill}>
									<Chip size="sm" variant="soft">
										{skill}
									</Chip>
								</li>
							))}
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
