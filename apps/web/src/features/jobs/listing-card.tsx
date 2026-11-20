import type { useListingActions } from "./use-listing-actions";
import type { JobListingCard, JobListingMatch } from "@rezumi/schema/jobs/search";
import { Widget } from "@heroui-pro/react";
import { Button, buttonVariants, Chip, Dropdown, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { arrangementLabel, placeLabel, salaryLabel, seniorityLabel } from "./format";
import { listingLogoUrl, useLogoTint } from "./logo-color";
import { CompanyMark } from "@/features/applications/components/company-mark";
import { formatRelativeTime } from "@/libs/locale";

export type ListingActions = ReturnType<typeof useListingActions>;

type ListingFactsProps = { listing: JobListingCard; match?: JobListingMatch | undefined; className?: string };

/**
 * How its skills read against the Profile, then how it's worked, the listed pay, sponsorship and level, as small
 * chips; only what the listing states.
 */
export function ListingFacts({ listing, match, className }: ListingFactsProps) {
	const { i18n } = useLingui();
	const salary = salaryLabel(listing.salary, i18n.locale);
	const facts = [
		listing.workArrangement && {
			key: "arrangement",
			icon: "globe-simple",
			label: arrangementLabel(listing.workArrangement),
		},
		salary && { key: "salary", icon: "tag", label: salary },
		listing.visaSponsorship && { key: "visa", icon: "check-circle", label: t`Visa sponsorship` },
		listing.seniority && { key: "level", icon: "chart-line-up", label: seniorityLabel(listing.seniority) },
	].filter(
		(fact): fact is { key: string; icon: "globe-simple" | "tag" | "check-circle" | "chart-line-up"; label: string } =>
			Boolean(fact),
	);
	const matched = Boolean(match?.matched.length);
	if (facts.length === 0 && !matched) return null;
	return (
		<ul className={cn("flex flex-wrap gap-1.5", className)}>
			{matched && (
				<li>
					<MatchChip match={match} />
				</li>
			)}
			{facts.map((fact) => (
				<li key={fact.key}>
					<Chip size="sm" variant="soft" className="gap-1">
						<Icon name={fact.icon} size={14} />
						{fact.label}
					</Chip>
				</li>
			))}
		</ul>
	);
}

type MatchChipProps = { match: JobListingMatch | undefined };

/**
 * How many of the skills a listing names the person's Profile mentions (K8: free, no AI). Shown only when some do: a
 * "0 of 6" says more about an unfilled Profile than about the job, and the detail lists them either way.
 */
function MatchChip({ match }: MatchChipProps) {
	if (!match || match.matched.length === 0) return null;
	const matched = match.matched.length;
	const total = matched + match.missing.length;
	return (
		<Chip size="sm" variant="soft" color="success" className="gap-1 tabular-nums">
			<Icon name="list-checks" size={14} />
			<Chip.Label>
				<Trans comment="How many of the skills a job listing names appear in the person's Profile">
					Matches {matched} of {total} skills
				</Trans>
			</Chip.Label>
		</Chip>
	);
}

type ListingButtonsProps = { listing: JobListingCard; actions: ListingActions; size?: "sm" | "md" };

/**
 * Track (or the application it's tracked as), Tailor resume, and the original posting, which every listing links to
 * (the providers' rules: `02-teknis.md` section 13).
 */
export function ListingButtons({ listing, actions, size = "sm" }: ListingButtonsProps) {
	const applicationId = actions.applicationFor(listing.id);
	const pending = actions.isPending(listing.id);
	return (
		<div className="flex flex-wrap items-center gap-2">
			{applicationId ? (
				<Link
					to="/dashboard/applications/$applicationId/{-$tab}"
					params={{ applicationId }}
					className={buttonVariants({ size, variant: "secondary" })}
				>
					<Icon name="check-circle" size={16} className="text-success" />
					<Trans comment="A job listing saved to the person's applications; links to it">Tracked</Trans>
				</Link>
			) : (
				<Button size={size} variant="secondary" isPending={pending} onPress={() => void actions.track(listing)}>
					<Icon name="plus" size={16} />
					<Trans comment="Save a job listing to the person's applications">Track</Trans>
				</Button>
			)}
			<Button size={size} variant="ghost" isDisabled={pending} onPress={() => void actions.tailor(listing)}>
				<Icon name="sparkle" size={16} />
				<Trans>Tailor resume</Trans>
			</Button>
			<a
				href={listing.postingUrl}
				target="_blank"
				rel="noopener noreferrer"
				className={buttonVariants({ size, variant: "ghost" })}
			>
				<Trans>View original</Trans>
				<Icon name="arrow-square-out" size={16} />
				<span className="sr-only">
					<Trans>(opens in a new tab)</Trans>
				</span>
			</a>
		</div>
	);
}

type JobListingItemProps = {
	listing: JobListingCard;
	match: JobListingMatch | undefined;
	actions: ListingActions;
	/** The listing open beside the results (or in the sheet): its widget takes its logo's colour. */
	selected: boolean;
	onOpen: () => void;
};

/**
 * One listing in the results, as a widget that opens it (the dashboard's Widget: a header on the grey shell, the content
 * on white). The header holds the logo with the company and place; the content the role, what it states and when it was
 * posted. The open one's shell takes its logo's colour (the accent when there is no logo or it has no colour). Its
 * buttons live in the listing itself; Hide stays in the widget's menu.
 */
export function JobListingItem({ listing, match, actions, selected, onOpen }: JobListingItemProps) {
	const { i18n } = useLingui();
	const place = placeLabel(listing);
	const posted = listing.postedAt ? formatRelativeTime(listing.postedAt, i18n.locale) : null;
	const logo = listingLogoUrl(listing);
	const tint = useLogoTint(selected ? logo : null);
	const tracked = Boolean(actions.applicationFor(listing.id));

	return (
		<Widget
			role="article"
			aria-labelledby={`job-${listing.id}`}
			style={selected && tint ? { backgroundColor: tint.background, color: tint.foreground } : undefined}
			className={cn(
				"relative transition-colors duration-quick",
				// While the logo is read (a moment: it's already on screen), a grey that still reads as open.
				selected && tint === undefined && "bg-default-hover",
				selected && tint === null && "bg-accent text-accent-foreground",
			)}
		>
			<Widget.Header className="min-h-0 gap-x-2.5 py-2.5">
				<CompanyMark company={listing.company.name} logoUrl={logo} className="size-7 rounded-lg text-xs" />
				<p className={cn("min-w-0 flex-1 truncate text-sm font-medium", !selected && "text-muted")}>
					{[listing.company.name, place].filter(Boolean).join(" · ")}
				</p>
				<Dropdown>
					<IconButton
						icon="dots-three"
						variant="ghost"
						size="sm"
						label={t`More for ${listing.title}`}
						className={cn("relative z-10 -me-1.5", selected && "text-current hover:bg-current/10")}
					/>
					<Dropdown.Popover placement="bottom end">
						<Dropdown.Menu>
							<Dropdown.Item id="hide" textValue={t`Hide this job`} onAction={() => actions.hide(listing)}>
								<Icon name="eye-slash" size={16} />
								<Label>
									<Trans>Hide this job</Trans>
								</Label>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
			</Widget.Header>
			<Widget.Content className="grid gap-2.5 text-foreground">
				<h3 id={`job-${listing.id}`} className="text-base leading-snug font-semibold">
					{/* The whole widget opens the listing; its menu sits above this button. */}
					<button
						type="button"
						aria-current={selected || undefined}
						className="text-start outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-focus"
						onClick={onOpen}
					>
						{listing.title}
					</button>
				</h3>
				<ListingFacts listing={listing} match={match} />
				{(posted || tracked) && (
					<p className="flex items-center gap-1.5 text-body-xs text-muted">
						{tracked && (
							<span className="inline-flex items-center gap-1 font-medium text-success">
								<Icon name="check-circle" size={14} />
								<Trans comment="A job listing saved to the person's applications">Tracked</Trans>
							</span>
						)}
						{tracked && posted && " · "}
						{posted && <Trans>Posted {posted}</Trans>}
					</p>
				)}
			</Widget.Content>
		</Widget>
	);
}
