import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { DOCUMENT_PLAN_FEATURE_KEYS, TRIAL_CREDITS } from "@rezumi/schema/billing";
import { orpc } from "@/api/client";
import { creditCount, describeCreditEntry, useRecentCredits } from "@/features/billing/credits";
import { canShowPlans, getPlanName, usePlan } from "@/features/billing/plan";
import { PaidPlanCard } from "@/features/billing/plan-card";
import { SettingsGroup, SettingsPage } from "@/features/settings/layout";
import { useProfile } from "@/features/settings/queries";
import { routes } from "@/routes";
import { Icon, ListRow, Skeleton, Text, useTheme } from "@/ui";

// The account's timezone; until one is chosen it reads UTC, and Rezumi sells in Indonesia, so dates show in WIB.
const planTimeZone = (timezone: string | null | undefined) =>
	timezone && timezone !== "UTC" ? timezone : "Asia/Jakarta";

/**
 * Plan (Android): the account's plan, until when, what comes next, its document usage, what's included and its Rezumi
 * AI credits. No prices, buttons or links to buy: plans are sold on the web only. iOS has no such screen until In-App
 * Purchase exists.
 */
export default function MembershipScreen() {
	const { t, i18n } = useLingui();
	const { colors, space } = useTheme();
	const plan = usePlan();
	const profile = useProfile();
	const queryClient = useQueryClient();
	const history = useRecentCredits(canShowPlans() && Boolean(plan?.credits));
	if (!canShowPlans()) return <Redirect href={routes.settings()} />;

	const timeZone = planTimeZone(profile.data?.timezone);
	const formatDate = (date: Date) =>
		date.toLocaleString(i18n.locale, {
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
			timeZoneName: "short",
		});
	const formatDay = (date: Date) =>
		date.toLocaleDateString(i18n.locale, { day: "numeric", month: "short", year: "numeric", timeZone });
	const features: Record<(typeof DOCUMENT_PLAN_FEATURE_KEYS)[number], { icon: IconName; label: string }> = {
		premiumTemplates: { icon: "squares-four", label: t`Every template` },
		brandLogos: { icon: "code", label: t`Tool logos in skills` },
		wordOdtExport: { icon: "file-doc", label: t`Word and ODT downloads` },
		customStyles: { icon: "palette", label: t`Custom styles` },
		customFonts: { icon: "text-aa", label: t`Your own fonts` },
		automationApi: { icon: "plugs-connected", label: t`API and MCP for other apps` },
	};
	const usage = (used: number, max: number | null) => (max === null ? t`${used} in use` : t`${used} of ${max}`);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: orpc.billing.summary.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.billing.creditHistory.key() }),
		]);
	const credits = plan?.credits;

	return (
		<SettingsPage title={t`Plan`} onRefresh={refresh}>
			{!plan ? (
				<Skeleton height={160} />
			) : !plan.enabled ? (
				<SettingsGroup>
					<ListRow title={t`Plans don't apply to your account yet, so everything is open.`} leading="seal-check" />
				</SettingsGroup>
			) : (
				<>
					{plan.planId === "free" ? (
						<SettingsGroup
							title={t`Your plan`}
							note={t`When a plan ends, nothing is locked or deleted: every document stays open to edit, share and download as a PDF.`}
						>
							<ListRow
								title={getPlanName(plan.planId)}
								subtitle={
									plan.currentPeriodEndsAt ? t`Active until ${formatDate(plan.currentPeriodEndsAt)}` : t`No end date`
								}
								leading="seal-check"
							/>
							{plan.upcoming.map((next) => (
								<ListRow
									key={`${next.planId}-${next.startsAt.toISOString()}`}
									title={t`Then ${getPlanName(next.planId)}`}
									subtitle={t`From ${formatDate(next.startsAt)} until ${formatDate(next.endsAt)}`}
									leading="calendar-blank"
								/>
							))}
						</SettingsGroup>
					) : (
						<View style={{ gap: space.s2 }}>
							<PaidPlanCard plan={plan} formatDate={formatDate} />
							<Text variant="callout" color="ink3">
								{t`When a plan ends, nothing is locked or deleted: every document stays open to edit, share and download as a PDF.`}
							</Text>
						</View>
					)}
					<SettingsGroup title={t`Documents`} note={t`Documents in Trash don't count.`}>
						<ListRow
							title={t`Active resumes`}
							leading="file-text"
							value={usage(plan.limits.activeResumes.used, plan.limits.activeResumes.max)}
						/>
						<ListRow
							title={t`Active cover letters`}
							leading="envelope-simple"
							value={usage(plan.limits.activeCoverLetters.used, plan.limits.activeCoverLetters.max)}
						/>
					</SettingsGroup>
					{credits && (
						<SettingsGroup
							title={t`Rezumi AI credits`}
							note={t`Credits are used soonest-expiring first. They can't be moved to another account or exchanged for money. Your own AI connection never uses credits.`}
						>
							<ListRow
								title={creditCount(credits.balance)}
								subtitle={
									credits.nextExpiry
										? t`${creditCount(credits.nextExpiry.credits)} expire on ${formatDate(credits.nextExpiry.at)}`
										: t`No credits to spend right now`
								}
								leading="sparkle"
							/>
							{credits.trial.available && (
								<ListRow
									title={t`Trial credits`}
									subtitle={t`${creditCount(TRIAL_CREDITS.amount)} come with your first use of Rezumi AI, valid for ${TRIAL_CREDITS.validDays} days.`}
									leading="star"
								/>
							)}
						</SettingsGroup>
					)}
					{credits && (
						<SettingsGroup title={t`Recent activity`}>
							{!history ? (
								<Skeleton height={56} />
							) : history.items.length === 0 ? (
								<ListRow title={t`No credit activity yet.`} leading="clock" />
							) : (
								history.items.map((entry) => {
									const line = describeCreditEntry(entry, formatDay);
									return (
										<ListRow
											key={entry.id}
											title={line.title}
											subtitle={line.detail}
											leading={line.icon}
											value={line.amount}
										/>
									);
								})
							)}
						</SettingsGroup>
					)}
					<SettingsGroup title={t`What's included`}>
						{DOCUMENT_PLAN_FEATURE_KEYS.map((feature, index) => (
							<View key={feature}>
								{/* Android rows have no rules by default; this list keeps the web's, starting under the text. */}
								{index > 0 ? (
									<View
										style={{
											height: StyleSheet.hairlineWidth,
											backgroundColor: colors.line,
											marginStart: space.s4 + 20 + space.s4,
										}}
									/>
								) : null}
								<ListRow
									title={features[feature].label}
									leading={features[feature].icon}
									trailing={
										<View accessible accessibilityLabel={plan.features[feature] ? t`Included` : t`Not included`}>
											<Icon
												name={plan.features[feature] ? "check" : "lock"}
												size={18}
												color={plan.features[feature] ? colors.accent : colors.ink3}
											/>
										</View>
									}
								/>
							</View>
						))}
					</SettingsGroup>
					{/* Google Play allows saying where plans are sold, without a link, button or price. */}
					<Text variant="callout" color="ink3">
						{t`Plans can be bought on the rezumi.app website.`}
					</Text>
				</>
			)}
		</SettingsPage>
	);
}
