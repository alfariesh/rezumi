import type { PlanSummary } from "@/features/billing/plan";
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { TRIAL_CREDITS } from "@rezumi/schema/billing";
import { SettingsPage } from "./layout";
import { useUserTime } from "@/features/applications/date";
import { creditCount, describeCreditEntry, useCreditHistory } from "@/features/billing/credits";
import { usePlanQuery } from "@/features/billing/plan";
import { PlanCard } from "@/features/billing/plan-card";
import { Button, EmptyState, ListRow, ListSection, Skeleton } from "@/ui";

export default function PlanScreen() {
	const { t, i18n } = useLingui();
	const query = usePlanQuery();
	const plan = query.data;
	const credits = plan?.credits;
	const history = useCreditHistory(Boolean(credits));
	const { timeZone } = useUserTime();
	const formatDate = (date: Date) => i18n.date(date, { dateStyle: "long", timeStyle: "short", timeZone });
	const formatDay = (date: Date) => i18n.date(date, { dateStyle: "medium", timeZone });
	const features = {
		premiumTemplates: { icon: "squares-four", label: t`Every template` },
		brandLogos: { icon: "code", label: t`Tool logos in skills` },
		wordOdtExport: { icon: "file-doc", label: t`Word and ODT downloads` },
		customStyles: { icon: "palette", label: t`Custom styles` },
		customFonts: { icon: "text-aa", label: t`Your own fonts` },
		automationApi: { icon: "plugs-connected", label: t`API and MCP for other apps` },
		premiumPortfolioThemes: { icon: "palette", label: t`All portfolio themes` },
		premiumHeroEffects: { icon: "sparkle", label: t`All portfolio intro effects` },
		hidePortfolioCredit: { icon: "eye-slash", label: t`Hide Rezumi credit` },
		customDomain: { icon: "globe", label: t`Custom domain` },
		detailedPortfolioStats: { icon: "chart-line-up", label: t`Detailed portfolio statistics` },
	} satisfies Record<keyof PlanSummary["features"], { icon: IconName; label: string }>;
	const entries = history.data
		? [
				...new Map(
					history.data.pages.flatMap((page) => page.items.map((item) => [`${item.type}:${item.id}`, item] as const)),
				).values(),
			]
		: undefined;
	const usage = (used: number, max: number | null) => (max === null ? t`${used} in use` : t`${used} of ${max}`);
	const refresh = () => Promise.allSettled([query.refetch(), ...(credits ? [history.refetch()] : [])]);

	return (
		<SettingsPage title={t`Plan`} onRefresh={refresh}>
			{query.isPending ? <Skeleton className="h-32 rounded-2xl" variant="none" /> : null}
			{query.isError ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load your plan.`}
					action={{ label: t`Try again`, onPress: () => void refresh() }}
				/>
			) : null}
			{plan && !plan.enabled ? (
				<ListSection>
					<ListRow title={t`Plans don't apply to your account yet, so everything is open.`} icon="seal-check" />
				</ListSection>
			) : null}
			{plan?.enabled ? (
				<>
					<PlanCard plan={plan} formatDate={formatDate} />
					<ListSection title={t`Documents`} footer={t`Documents in Trash don't count.`}>
						<ListRow
							title={t`Active resumes`}
							icon="file-text"
							value={usage(plan.limits.activeResumes.used, plan.limits.activeResumes.max)}
						/>
						<ListRow
							title={t`Active cover letters`}
							icon="envelope-simple"
							value={usage(plan.limits.activeCoverLetters.used, plan.limits.activeCoverLetters.max)}
						/>
					</ListSection>
					{credits ? (
						<>
							<ListSection
								title={t`Rezumi AI credits`}
								footer={t`Credits with the nearest expiry are used first. Your own AI connection never uses credits.`}
							>
								<ListRow
									title={creditCount(credits.balance)}
									icon="sparkle"
									description={
										credits.nextExpiry
											? t`${creditCount(credits.nextExpiry.credits)} expire on ${formatDate(credits.nextExpiry.at)}`
											: undefined
									}
								/>
								{credits.trial.available ? (
									<ListRow
										title={t`Trial credits`}
										icon="star"
										description={t`${creditCount(TRIAL_CREDITS.amount)} come with your first use of Rezumi AI, valid for ${TRIAL_CREDITS.validDays} days.`}
									/>
								) : null}
							</ListSection>
							<ListSection title={t`Credit history`}>
								{history.isPending ? <Skeleton className="m-3 h-12 rounded-xl" variant="none" /> : null}
								{history.isError ? (
									<EmptyState
										kind="inline"
										title={t`Couldn't load credit activity.`}
										action={{ label: t`Try again`, onPress: () => void history.refetch() }}
									/>
								) : null}
								{entries?.length === 0 ? <ListRow title={t`No credit activity yet.`} icon="clock" /> : null}
								{entries?.map((entry) => {
									const line = describeCreditEntry(entry, formatDay);
									return (
										<ListRow
											key={`${entry.type}:${entry.id}`}
											title={line.title}
											description={line.detail}
											icon={line.icon}
											value={line.amount}
										/>
									);
								})}
								{history.hasNextPage ? (
									<Button
										className="m-2"
										variant="ghost"
										isDisabled={history.isFetchingNextPage}
										onPress={() => void history.fetchNextPage()}
									>
										{history.isFetchingNextPage ? t`Loading…` : t`Show more`}
									</Button>
								) : null}
							</ListSection>
						</>
					) : null}
					<ListSection title={t`What's included`}>
						{(Object.keys(features) as (keyof typeof features)[]).map((feature) => (
							<ListRow
								key={feature}
								title={features[feature].label}
								icon={features[feature].icon}
								value={plan.features[feature] ? t`Included` : t`Not included`}
							/>
						))}
					</ListSection>
				</>
			) : null}
		</SettingsPage>
	);
}
