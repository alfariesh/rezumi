import type { PlanFeature, PlanSummary } from "./plan";
import type { IconName } from "@rezumi/ui/components/icon";
import { ProgressBar, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { PLAN_FEATURE_KEYS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { getPlanName } from "./plan";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsRow, SettingsSection } from "@/features/settings/section";
import { orpc } from "@/libs/orpc/client";

// The account's timezone; until one is chosen it reads UTC, and Rezumi sells in Indonesia, so dates show in WIB.
const planTimeZone = (timezone: string | null | undefined) =>
	timezone && timezone !== "UTC" ? timezone : "Asia/Jakarta";

const featureCopy = (): Record<PlanFeature, { icon: IconName; label: string }> => ({
	premiumTemplates: { icon: "squares-four", label: t`Every template` },
	wordOdtExport: { icon: "file-doc", label: t`Word and ODT downloads` },
	customStyles: { icon: "palette", label: t`Custom styles` },
	customFonts: { icon: "text-aa", label: t`Your own fonts` },
	automationApi: { icon: "plugs-connected", label: t`API and MCP for other apps` },
});

type UsageRowProps = { icon: IconName; label: string; usage: PlanSummary["limits"]["activeResumes"] };

function UsageRow({ icon, label, usage }: UsageRowProps) {
	const max = usage.max ?? usage.used;
	return (
		<SettingsRow
			icon={icon}
			title={label}
			description={usage.max === null ? t`${usage.used} in use` : t`${usage.used} of ${usage.max}`}
		>
			{usage.max !== null && (
				<ProgressBar aria-label={label} value={Math.min(usage.used, max)} maxValue={Math.max(max, 1)} className="w-32">
					<ProgressBar.Track>
						<ProgressBar.Fill />
					</ProgressBar.Track>
				</ProgressBar>
			)}
		</SettingsRow>
	);
}

/**
 * Plan: what the account has now, until when, what comes next, how much of its limits it uses and what's included.
 * Read-only: buying comes later, from the web only.
 */
export function PlanSettings() {
	const { session } = useRouteContext({ from: "/dashboard" });
	const { data: plan, isPending } = useQuery(orpc.billing.summary.queryOptions());
	const timeZone = planTimeZone(session.user.timezone);
	const formatDate = (date: Date) =>
		date.toLocaleString(undefined, {
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
			timeZoneName: "short",
		});

	if (isPending) return <Skeleton role="status" aria-label={t`Loading your plan…`} className="h-64 rounded-2xl" />;

	if (!plan?.enabled)
		return (
			<>
				<PageHeader title={<Trans>Plan</Trans>} />
				<SettingsSection title={<Trans>Your plan</Trans>}>
					<p className="text-sm text-muted">
						<Trans>Plans don't apply to your account yet, so everything is open.</Trans>
					</p>
				</SettingsSection>
			</>
		);

	const features = featureCopy();

	return (
		<>
			<PageHeader title={<Trans>Plan</Trans>} />

			<SettingsSection
				divided
				title={<Trans>Your plan</Trans>}
				footer={
					<Trans>
						When a plan ends, nothing is locked or deleted: every document stays open to edit, share and download as a
						PDF.
					</Trans>
				}
			>
				<SettingsRow
					icon="seal-check"
					title={getPlanName(plan.planId)}
					description={
						plan.currentPeriodEndsAt ? (
							<Trans>Active until {formatDate(plan.currentPeriodEndsAt)}</Trans>
						) : (
							<Trans>No end date</Trans>
						)
					}
				/>
				{plan.upcoming.map((next) => (
					<SettingsRow
						key={`${next.planId}-${next.startsAt.toISOString()}`}
						icon="calendar-blank"
						title={<Trans>Then {getPlanName(next.planId)}</Trans>}
						description={
							<Trans>
								From {formatDate(next.startsAt)} until {formatDate(next.endsAt)}
							</Trans>
						}
					/>
				))}
			</SettingsSection>

			<SettingsSection
				divided
				title={<Trans>Documents</Trans>}
				description={<Trans>Documents in Trash don't count.</Trans>}
			>
				<UsageRow icon="file-text" label={t`Active resumes`} usage={plan.limits.activeResumes} />
				<UsageRow icon="envelope-simple" label={t`Active cover letters`} usage={plan.limits.activeCoverLetters} />
			</SettingsSection>

			<SettingsSection
				title={<Trans>What's included</Trans>}
				footer={
					<a href="/#pricing" className="text-sm underline hover:text-foreground">
						<Trans>Compare plans</Trans>
					</a>
				}
			>
				<ul className="grid gap-2">
					{PLAN_FEATURE_KEYS.map((feature) => {
						const included = plan.features[feature];
						return (
							<li key={feature} className="flex items-center gap-3 text-sm">
								<Icon name={features[feature].icon} size={20} className="text-muted" />
								<span className="flex-1">{features[feature].label}</span>
								<span className={included ? "text-success" : "text-muted"}>
									<Icon name={included ? "check" : "lock"} size={18} aria-hidden />
									<span className="sr-only">{included ? t`Included` : t`Not included`}</span>
								</span>
							</li>
						);
					})}
				</ul>
			</SettingsSection>
		</>
	);
}
