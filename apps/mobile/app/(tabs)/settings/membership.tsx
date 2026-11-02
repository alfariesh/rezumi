import type { PlanFeature } from "@/features/billing/plan";
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { View } from "react-native";
import { PLAN_FEATURE_KEYS } from "@rezumi/schema/billing";
import { orpc } from "@/api/client";
import { canShowPlans, getPlanName, usePlan } from "@/features/billing/plan";
import { SettingsGroup, SettingsPage } from "@/features/settings/layout";
import { useProfile } from "@/features/settings/queries";
import { routes } from "@/routes";
import { Icon, ListRow, Skeleton, Text, useTheme } from "@/ui";

// The account's timezone; until one is chosen it reads UTC, and Rezumi sells in Indonesia, so dates show in WIB.
const planTimeZone = (timezone: string | null | undefined) =>
	timezone && timezone !== "UTC" ? timezone : "Asia/Jakarta";

/**
 * Plan (Android): the account's plan, until when, what comes next, its document usage and what's included. No prices,
 * buttons or links to buy: plans are sold on the web only. iOS has no such screen until In-App Purchase exists.
 */
export default function MembershipScreen() {
	const { t, i18n } = useLingui();
	const { colors } = useTheme();
	const plan = usePlan();
	const profile = useProfile();
	const queryClient = useQueryClient();
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
	const features: Record<PlanFeature, { icon: IconName; label: string }> = {
		premiumTemplates: { icon: "squares-four", label: t`Every template` },
		wordOdtExport: { icon: "file-doc", label: t`Word and ODT downloads` },
		customStyles: { icon: "palette", label: t`Custom styles` },
		customFonts: { icon: "text-aa", label: t`Your own fonts` },
		automationApi: { icon: "plugs-connected", label: t`API and MCP for other apps` },
	};
	const usage = (used: number, max: number | null) => (max === null ? t`${used} in use` : t`${used} of ${max}`);
	const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.billing.summary.key() });

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
					<SettingsGroup title={t`What's included`}>
						{PLAN_FEATURE_KEYS.map((feature) => (
							<ListRow
								key={feature}
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
