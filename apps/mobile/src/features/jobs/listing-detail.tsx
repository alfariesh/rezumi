// A listing in full (the web's listing-sheet.tsx): the provider's description as plain text (never HTML: it's
// untrusted data), what it asks for, its skills against the Profile, the company, Your fit, and its buttons. In a
// sheet over the results on phones, beside them on tablets. "View original" is always there (the providers' rules:
// lowongan 02-teknis section 13): it opens the posting in the system browser, the one to apply through.
import type { ListingActions } from "./use-listing-actions";
import type { JobListingCard, JobListingMatch } from "@rezumi/schema/jobs/search";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { openBrowserAsync } from "expo-web-browser";
import { ScrollView, View } from "react-native";
import { placeLabel } from "@rezumi/career/jobs";
import { postedAgo, sourceLabel } from "./format";
import { CompanyMark, ListingFacts } from "./listing-card";
import { ListingFit } from "./listing-fit";
import { isGone, useListing } from "./queries";
import { Button, Chip, Icon, Sheet, Skeleton, Text, Typography, showToast } from "@/ui";

type ListingButtonsProps = { listing: JobListingCard; actions: ListingActions };

/** Track (or Tracked, which opens the application), Tailor resume, View original. */
export function ListingButtons({ listing, actions }: ListingButtonsProps) {
	const { t } = useLingui();
	const applicationId = actions.applicationFor(listing.id);
	const pending = actions.isPending(listing.id);
	const openOriginal = () => {
		if (!/^https?:\/\//i.test(listing.postingUrl)) return;
		void openBrowserAsync(listing.postingUrl).catch(() =>
			showToast({ title: t`Couldn't open the posting. Try again.` }),
		);
	};
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			{applicationId ? (
				<Button
					size="sm"
					variant="secondary"
					onPress={() => actions.openApplication(applicationId)}
					testID="job-tracked"
				>
					<Icon name="check-circle" size={16} tone="success" />
					<Button.Label>
						{t({ message: "Tracked", comment: "A job listing saved to the person's applications" })}
					</Button.Label>
				</Button>
			) : (
				<Button
					size="sm"
					variant="primary"
					isDisabled={pending}
					onPress={() => void actions.track(listing)}
					testID="job-track"
				>
					<Icon name="plus" size={16} tone="accent-foreground" />
					<Button.Label>
						{t({ message: "Track", comment: "Save a job listing to the person's applications" })}
					</Button.Label>
				</Button>
			)}
			<Button size="sm" variant="secondary" isDisabled={pending} onPress={() => void actions.tailor(listing)}>
				<Icon name="sparkle" size={16} tone="accent" />
				<Button.Label>{t`Tailor resume`}</Button.Label>
			</Button>
			<Button
				size="sm"
				variant="ghost"
				onPress={openOriginal}
				accessibilityHint={t`Opens in the browser`}
				testID="job-original"
			>
				<Button.Label>{t`View original`}</Button.Label>
				<Icon name="arrow-square-out" size={16} tone="muted" />
			</Button>
		</View>
	);
}

/** A provider's skill and its name in the match: the match reads "sql-server" as "sql server". */
const sameSkill = (matched: string, skill: string) =>
	matched.toLocaleLowerCase() === skill.replace(/[-_]+/g, " ").trim().toLocaleLowerCase();

type ListingDetailProps = {
	listing: JobListingCard;
	match: JobListingMatch | undefined;
	actions: ListingActions;
	now: Date;
};

export function ListingDetail({ listing, match, actions, now }: ListingDetailProps) {
	const { t, i18n } = useLingui();
	const place = placeLabel(listing);
	const source = sourceLabel(listing);
	const posted = listing.postedAt ? postedAgo(listing.postedAt, now, i18n.locale) : null;
	const { company } = listing;
	const companyFacts = [company.industry, company.size && t`${company.size} employees`].filter(Boolean).join(" · ");

	return (
		<View className="gap-6">
			<View className="gap-4">
				<View className="flex-row items-start gap-3">
					<CompanyMark name={company.name} logoUrl={company.logoUrl} size="md" />
					<View className="flex-1 gap-0.5">
						<Typography.Heading type="h5" accessibilityRole="header">
							{listing.title}
						</Typography.Heading>
						<Typography type="body-sm" className="text-muted">
							{[company.name, place].filter(Boolean).join(" · ")}
						</Typography>
					</View>
				</View>
				<ListingFacts listing={listing} match={match} />
				{posted || source ? (
					<Text size="xs" tone="muted">
						{[posted, source].filter(Boolean).join(" · ")}
					</Text>
				) : null}
				<ListingButtons listing={listing} actions={actions} />
			</View>
			<View className="gap-6 border-t border-separator pt-5">
				<ListingFit listing={listing} />
				{listing.requirementsSummary ? (
					<Section title={t`What they ask for`}>
						<Typography type="body-sm">{listing.requirementsSummary}</Typography>
					</Section>
				) : null}
				{listing.skills.length > 0 ? (
					<Section title={t`Skills`}>
						{match ? <SkillMatch match={match} /> : null}
						<View className="flex-row flex-wrap gap-1.5">
							{listing.skills.slice(0, 30).map((skill) => {
								const inProfile = match?.matched.some((name) => sameSkill(name, skill)) ?? false;
								return (
									<Chip
										key={skill}
										size="sm"
										variant="soft"
										color={inProfile ? "success" : "default"}
										accessibilityLabel={inProfile ? t`${skill} (in your Profile)` : skill}
									>
										{inProfile ? <Icon name="check" size={14} tone="success" /> : null}
										<Chip.Label>{skill}</Chip.Label>
									</Chip>
								);
							})}
						</View>
					</Section>
				) : null}
				<Description id={listing.id} />
				{companyFacts || company.domain ? (
					<Section title={t`About ${company.name}`}>
						{companyFacts ? (
							<Typography type="body-sm" className="text-muted">
								{companyFacts}
							</Typography>
						) : null}
						{company.domain ? (
							<Text mono tone="muted">
								{company.domain}
							</Text>
						) : null}
					</Section>
				) : null}
				<Text size="xs" tone="muted">
					{t`Listings come from job data providers and may change. The original posting is the one to apply through.`}
				</Text>
			</View>
		</View>
	);
}

type SectionProps = { title: string; children: ReactNode };

function Section({ title, children }: SectionProps) {
	return (
		<View className="gap-2">
			<Typography.Heading type="h6" accessibilityRole="header">
				{title}
			</Typography.Heading>
			{children}
		</View>
	);
}

type SkillMatchProps = { match: JobListingMatch };

/** The free match in words: how many of the main skills the Profile mentions, without AI. */
function SkillMatch({ match }: SkillMatchProps) {
	const { t } = useLingui();
	const matched = match.matched.length;
	const total = matched + match.missing.length;
	return (
		<Typography type="body-sm" className="text-muted">
			{matched === 0
				? t`Your Profile doesn't mention these skills yet. Add the ones you have to your Profile, and matches show here.`
				: t`Your Profile mentions ${matched} of the ${total} main skills this job names. A word match, without AI: check your fit for a closer look.`}
		</Typography>
	);
}

type DescriptionProps = { id: string };

/** The provider's description, as written: paragraphs and line breaks only. */
function Description({ id }: DescriptionProps) {
	const { t } = useLingui();
	const detail = useListing(id);
	return (
		<Section title={t`About the job`}>
			{detail.data ? (
				detail.data.description ? (
					<Typography type="body-sm" selectable>
						{detail.data.description}
					</Typography>
				) : (
					<Typography type="body-sm" className="text-muted">
						{t`The provider has no description for this job. The original posting has the details.`}
					</Typography>
				)
			) : isGone(detail.error) ? (
				<Typography type="body-sm" className="text-muted">
					{t`This listing isn't available anymore. The original posting may still have the details.`}
				</Typography>
			) : detail.isError ? (
				<View className="flex-row flex-wrap items-center gap-2">
					<Typography type="body-sm" className="text-muted">
						{t`The description couldn't be loaded.`}
					</Typography>
					<Button size="sm" variant="secondary" onPress={() => void detail.refetch()}>
						<Button.Label>{t`Try again`}</Button.Label>
					</Button>
				</View>
			) : (
				<View className="gap-2" accessibilityLabel={t`Loading the description`}>
					{Array.from({ length: 6 }, (_, index) => (
						<Skeleton key={index} className="h-4 rounded-md" variant="none" />
					))}
				</View>
			)}
		</Section>
	);
}

type ListingSheetProps = {
	listing: JobListingCard | null;
	match: JobListingMatch | undefined;
	actions: ListingActions;
	now: Date;
	onClose: () => void;
	/** Once the sheet has finished sliding away: present the next screen from here. */
	onDidDismiss?: (() => void) | undefined;
};

/** The listing over the results on phones; tablets show it beside them. */
export function ListingSheet({ listing, match, actions, now, onClose, onDidDismiss }: ListingSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet
			isOpen={listing !== null}
			onOpenChange={(open) => !open && onClose()}
			title={t`Job details`}
			closeLabel={t`Close`}
			onDidDismiss={onDidDismiss}
			testID="job-sheet"
		>
			{listing ? <ListingDetail key={listing.id} listing={listing} match={match} actions={actions} now={now} /> : null}
		</Sheet>
	);
}

type ListingPaneProps = Omit<ListingSheetProps, "onClose" | "onDidDismiss" | "listing"> & { listing: JobListingCard };

/** The listing beside the results on tablets, scrolling on its own. */
export function ListingPane({ listing, match, actions, now }: ListingPaneProps) {
	const { t } = useLingui();
	return (
		<ScrollView
			className="flex-1 rounded-2xl bg-surface"
			contentContainerClassName="p-5"
			accessibilityLabel={t`Job details`}
		>
			<ListingDetail key={listing.id} listing={listing} match={match} actions={actions} now={now} />
		</ScrollView>
	);
}
