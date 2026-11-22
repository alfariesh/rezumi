// Offers, a section of Applications (plans/mobile Phase 10; the web's offers.tsx): two saved offers side by side in
// their own currency and pay period, against the user's Preferences, what neither says yet, and Plan what to ask with
// the coach. Offers are saved from an application's workspace (Messages); this screen only reads them.
import type { Side } from "./comparison";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { defaultPair, sameTerms } from "@rezumi/career/offers";
import { useOfferClock } from "./clock";
import { Comparison } from "./comparison";
import { OpenQuestions } from "./open-questions";
import { useCareerProfile, useSavedOffers } from "./queries";
import { useOnline } from "@/api/online";
import { ApplicationsViewsRow } from "@/features/applications/views-row";
import { routes } from "@/routes";
import { TabTopBar } from "@/shell/tab-chrome";
import { useIsTablet } from "@/shell/use-is-tablet";
import { Alert, Button, EmptyState, IconButton, Screen, Skeleton, Typography, cx } from "@/ui";

export function OffersScreen() {
	const { t } = useLingui();
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Applications`} />
			<ApplicationsViewsRow current="offers" />
			<OffersBody />
		</View>
	);
}

export function OffersBody() {
	const { t } = useLingui();
	const router = useRouter();
	const tablet = useIsTablet();
	const online = useOnline();
	const query = useSavedOffers();
	const profile = useCareerProfile();
	const clock = useOfferClock();
	const [chosen, setChosen] = useState<Record<Side, string | undefined>>({ a: undefined, b: undefined });
	const refetch = () => Promise.allSettled([query.refetch(), profile.refetch()]);
	const offers = query.offers;

	if (!offers) {
		if (query.isError)
			return (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load your offers`}
					description={t`Check your connection and try again.`}
					action={{ label: t`Retry`, onPress: () => void refetch() }}
				/>
			);
		if (!online)
			return (
				<EmptyState
					kind="page"
					icon="cloud-slash"
					title={t`You're offline`}
					description={t`Saved offers show here once they've loaded.`}
				/>
			);
		return (
			<View accessible accessibilityLabel={t`Loading offers`} className="gap-4 p-4">
				<Skeleton variant="none" className="h-[520px] rounded-3xl" />
			</View>
		);
	}

	if (offers.length === 0)
		return (
			<Screen onRefresh={refetch}>
				<EmptyState
					kind="page"
					icon="scales"
					title={t`No offers to compare yet`}
					description={t`Offers are saved from an application's workspace: paste one into its Messages section.`}
					action={{ label: t`Open applications`, onPress: () => router.replace(routes.applications("list")) }}
				/>
			</Screen>
		);

	const exists = (id: string | undefined) => id !== undefined && offers.some((offer) => offer.id === id);
	const [first, second] = defaultPair(offers);
	// No distinct second offer leaves the right column empty, never a copy of the left.
	const aId = exists(chosen.a) ? chosen.a : first;
	const bId = exists(chosen.b) && chosen.b !== aId ? chosen.b : aId === second ? first : second;
	const left = offers.find((offer) => offer.id === aId);
	const right = offers.find((offer) => offer.id === bId && offer.id !== aId);
	const pair = [left, right].filter((offer) => offer !== undefined);

	return (
		<Screen onRefresh={refetch} testID="offers">
			<View className="flex-row items-center gap-2">
				<Typography type="body-sm" color="muted" className="flex-1">
					{t`Compared in their original currency and pay period. Comparing doesn't share anything with the coach.`}
				</Typography>
				<IconButton
					icon="arrows-left-right"
					label={t`Swap offers`}
					isDisabled={!left || !right}
					onPress={() => setChosen({ a: right?.id, b: left?.id })}
				/>
			</View>
			<Button onPress={() => router.push(routes.coach(pair.map((offer) => offer.id)))}>
				<Button.Label>{t`Plan what to ask`}</Button.Label>
			</Button>
			{query.isError || profile.isError ? (
				<Notice message={t`Couldn't refresh. This is what loaded last.`} retry={t`Retry`} onRetry={refetch} />
			) : null}
			{left && right && !sameTerms(left.data, right.data) ? (
				<Notice message={t`Different currencies or pay periods. No money difference is worked out.`} />
			) : null}
			<Comparison
				offers={offers}
				left={left}
				right={right}
				profile={profile.data}
				clock={clock}
				onChoose={(side, id) => setChosen(side === "a" ? { a: id, b: bId } : { a: aId, b: id })}
			/>
			<View className={tablet ? "flex-row items-start gap-4" : "gap-4"}>
				<Alert status="warning" className={cx(tablet && "flex-1")}>
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>{t`Totals aren't added up on purpose.`}</Alert.Title>
						<Alert.Description>
							{t`Bonus and equity depend on conditions, and equity value is uncertain for both. Read the original offer documents before comparing totals.`}
						</Alert.Description>
					</Alert.Content>
				</Alert>
				<View className={cx(tablet && "flex-1")}>
					<OpenQuestions offers={pair} priorities={profile.data?.priorities ?? ""} />
				</View>
			</View>
		</Screen>
	);
}

type NoticeProps = { message: string; retry?: string | undefined; onRetry?: (() => unknown) | undefined };

function Notice({ message, retry, onRetry }: NoticeProps) {
	return (
		<Alert status="warning">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
			{retry && onRetry ? (
				<Button size="sm" variant="secondary" onPress={() => void onRetry()}>
					<Button.Label>{retry}</Button.Label>
				</Button>
			) : null}
		</Alert>
	);
}
