// One listing in the results (the web's listing-card.tsx): the company's logo or initial with the company and place,
// the role, what the listing states as small chips (its skills against the Profile first), when it was posted, and a
// tracked mark. Pressing the card opens the listing; Hide is in its menu (with Undo).
import type { ListingActions } from "./use-listing-actions";
import type { IconName } from "@/ui";
import type { JobListingCard, JobListingMatch } from "@rezumi/schema/jobs/search";
import { useLingui } from "@lingui/react/macro";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { placeLabel } from "@rezumi/career/jobs";
import { arrangementLabel, postedAgo, salaryLabel, seniorityLabel } from "./format";
import { Card, Chip, Icon, IconButton, Menu, Text, Typography, cx } from "@/ui";

// expo-image takes no className: the logo fills its tile and keeps the tile's rounding.
const logoSizes = { sm: { width: 28, height: 28, borderRadius: 8 }, md: { width: 44, height: 44, borderRadius: 12 } };

type CompanyMarkProps = { name: string; logoUrl: string | undefined; size?: "sm" | "md" };

/** The company's logo on a neutral tile (no colour read from it: that needs a canvas), else its initial. */
export function CompanyMark({ name, logoUrl, size = "sm" }: CompanyMarkProps) {
	const [failed, setFailed] = useState(false);
	const https = logoUrl?.startsWith("https://") ? logoUrl : undefined;
	return (
		<View
			className={cx(
				"items-center justify-center overflow-hidden bg-surface-secondary",
				size === "sm" ? "size-7 rounded-lg" : "size-11 rounded-xl",
			)}
		>
			{https && !failed ? (
				<Image
					source={{ uri: https }}
					contentFit="contain"
					style={logoSizes[size]}
					onError={() => setFailed(true)}
					accessibilityIgnoresInvertColors
				/>
			) : (
				<Text size={size === "sm" ? "xs" : "sm"} weight="semibold" tone="muted">
					{Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?"}
				</Text>
			)}
		</View>
	);
}

type ListingFactsProps = { listing: JobListingCard; match?: JobListingMatch | undefined };

/** Its skills against the Profile, then how it's worked, the listed pay, sponsorship and level: only what it states. */
export function ListingFacts({ listing, match }: ListingFactsProps) {
	const { t, i18n } = useLingui();
	const salary = salaryLabel(listing.salary, i18n.locale);
	const facts: { key: string; icon: IconName; label: string }[] = [];
	if (listing.workArrangement)
		facts.push({ key: "arrangement", icon: "globe-simple", label: arrangementLabel(listing.workArrangement) });
	if (salary) facts.push({ key: "salary", icon: "tag", label: salary });
	if (listing.visaSponsorship) facts.push({ key: "visa", icon: "check-circle", label: t`Visa sponsorship` });
	if (listing.seniority) facts.push({ key: "level", icon: "chart-line-up", label: seniorityLabel(listing.seniority) });
	const matched = match?.matched.length ?? 0;
	if (facts.length === 0 && matched === 0) return null;
	const total = matched + (match?.missing.length ?? 0);
	return (
		<View className="flex-row flex-wrap gap-1.5">
			{matched > 0 ? (
				<Chip size="sm" variant="soft" color="success">
					<Icon name="list-checks" size={14} tone="success" />
					<Chip.Label>{t`Matches ${matched} of ${total} skills`}</Chip.Label>
				</Chip>
			) : null}
			{facts.map((fact) => (
				<Chip key={fact.key} size="sm" variant="soft" color="default">
					<Icon name={fact.icon} size={14} tone="muted" />
					<Chip.Label>{fact.label}</Chip.Label>
				</Chip>
			))}
		</View>
	);
}

type ListingCardProps = {
	listing: JobListingCard;
	match: JobListingMatch | undefined;
	actions: ListingActions;
	/** The listing open beside the results on tablets. */
	selected: boolean;
	now: Date;
	onOpen: () => void;
};

export function ListingCard({ listing, match, actions, selected, now, onOpen }: ListingCardProps) {
	const { t, i18n } = useLingui();
	const place = placeLabel(listing);
	const tracked = Boolean(actions.applicationFor(listing.id));
	const posted = listing.postedAt ? postedAgo(listing.postedAt, now, i18n.locale) : null;
	const where = [listing.company.name, place].filter(Boolean).join(" · ");

	return (
		<Card className={cx("gap-0 p-0", selected && "bg-surface-secondary")} testID={`job-${listing.id}`}>
			<View className="flex-row items-center gap-2.5 ps-4 pe-1 pt-2">
				<CompanyMark name={listing.company.name} logoUrl={listing.company.logoUrl} />
				<Text size="sm" weight="medium" tone="muted" numberOfLines={1} className="flex-1">
					{where}
				</Text>
				<Menu>
					<Menu.Trigger asChild>
						<IconButton icon="dots-three" size="sm" label={t`More for ${listing.title}`} />
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Overlay />
						<Menu.Content presentation="popover" width={200}>
							<Menu.Item onPress={() => actions.hide(listing)}>
								<Icon name="eye-slash" size={16} />
								<Menu.ItemTitle>{t`Hide this job`}</Menu.ItemTitle>
							</Menu.Item>
						</Menu.Content>
					</Menu.Portal>
				</Menu>
			</View>
			<Pressable
				onPress={onOpen}
				accessibilityRole="button"
				accessibilityState={{ selected }}
				accessibilityHint={t`Opens the job`}
				className="gap-2.5 px-4 pt-1 pb-4"
			>
				<Typography.Heading type="h6">{listing.title}</Typography.Heading>
				<ListingFacts listing={listing} match={match} />
				{posted || tracked ? (
					<View className="flex-row flex-wrap items-center gap-1.5">
						{tracked ? (
							<>
								<Icon name="check-circle" size={14} tone="success" />
								<Text size="xs" weight="medium" tone="success">
									{t({ message: "Tracked", comment: "A job listing saved to the person's applications" })}
								</Text>
								{posted ? (
									<Text size="xs" tone="muted" accessibilityElementsHidden importantForAccessibility="no">
										{"·"}
									</Text>
								) : null}
							</>
						) : null}
						{posted ? (
							<Text size="xs" tone="muted">
								{posted}
							</Text>
						) : null}
					</View>
				) : null}
			</Pressable>
		</Card>
	);
}
