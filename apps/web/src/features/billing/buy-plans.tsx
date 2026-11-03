import type { PlanSummary } from "./plan";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { TextShimmer } from "@heroui-pro/react";
import { Alert, Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "./plan";
import { formatPrice, getPurchaseKind, getPurchaseLabel } from "./purchase";
import { PurchaseDialog } from "./purchase-dialog";
import { SettingsSection } from "@/features/settings/section";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";

const PAID_PLANS = ["plus", "pro-ai"] as const satisfies readonly PaidPlanId[];

/** What each pass adds, in three lines; numbers come from the catalog the server enforces. */
function planHighlights(planId: PaidPlanId) {
	if (planId === "pro-ai") {
		const proCredits = PLANS["pro-ai"].creditsPerPurchase;
		return [t`Everything in Plus`, t`${proCredits} AI credits per purchase`, t`No API key to set up`];
	}
	const { activeResumes, activeCoverLetters } = PLANS.plus.limits;
	return [
		t`${activeResumes} active resumes and ${activeCoverLetters} cover letters`,
		t`Every template, with Word and ODT downloads`,
		t`Custom styles, your own fonts, API and MCP`,
	];
}

type PurchaseStepProps = { blocker: "guest" | "email_not_verified" | "paused" };

/** What stands between the account and buying, and the way past it, in place of the buy buttons. */
function PurchaseStep({ blocker }: PurchaseStepProps) {
	const context = useRouteContext({ strict: false });
	const smtpEnabled = context.flags?.smtpEnabled ?? false;
	const email = context.session?.user.email ?? "";

	const resend = async () => {
		const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard/settings/billing" });
		toast.add(
			error
				? { type: "error", description: getReadableErrorMessage(error, t`Couldn't send the email. Try again.`) }
				: { type: "success", description: t`We sent a new verification link to ${email}.` },
		);
	};

	return (
		<Alert status={blocker === "paused" ? "warning" : "default"} className="bg-surface-secondary">
			<Alert.Indicator />
			<Alert.Content className="grid gap-2">
				{blocker === "guest" ? (
					<>
						<Alert.Title>
							<Trans>Create an account to buy a pass</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>Passes belong to an account with an email address. Your guest work moves with you.</Trans>
						</Alert.Description>
						<Link
							to="/auth/register"
							search={{ callbackURL: "/dashboard/settings/billing" }}
							className={cn(buttonVariants({ size: "sm" }), "w-fit")}
						>
							<Trans>Create an account</Trans>
						</Link>
					</>
				) : blocker === "email_not_verified" ? (
					<>
						<Alert.Title>
							<Trans>Verify your email to buy a pass</Trans>
						</Alert.Title>
						<Alert.Description>
							{smtpEnabled ? (
								<Trans>Open the link we sent to {email}. Your receipt goes there too.</Trans>
							) : (
								<Trans>Email delivery isn't set up on this server, so the address can't be verified.</Trans>
							)}
						</Alert.Description>
						{smtpEnabled && (
							<Button size="sm" variant="secondary" className="w-fit" onPress={() => void resend()}>
								<Trans>Resend the link</Trans>
							</Button>
						)}
					</>
				) : (
					<>
						<Alert.Title>
							<Trans>Buying is paused for now</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>Try again later. Your current pass and credits aren't affected.</Trans>
						</Alert.Description>
					</>
				)}
			</Alert.Content>
		</Alert>
	);
}

type BuyPlansSectionProps = {
	plan: PlanSummary;
	/** The plan a link asked for (`?plan=`), marked and brought into view. */
	selected: PaidPlanId | undefined;
};

/**
 * The two passes with their final price and a button that fits where the account stands: buy, extend 30 days, upgrade
 * to Pro AI, or queue Plus behind Pro AI. Without a way to buy here (guest, unverified email, paused) it explains the
 * step instead; where buying doesn't apply at all it shows nothing.
 */
export function BuyPlansSection({ plan, selected }: BuyPlansSectionProps) {
	const [buying, setBuying] = useState<PaidPlanId | null>(null);
	const selectedRef = useRef<HTMLDivElement>(null);
	const blocker = plan.purchaseBlockedBy;

	useEffect(() => {
		selectedRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [selected]);

	if (blocker === "unavailable" || blocker === "web_only") return null;

	return (
		<SettingsSection
			title={<Trans>Buy a pass</Trans>}
			description={<Trans>Each pass is 30 days of access, paid once. Nothing renews on its own.</Trans>}
		>
			{blocker && <PurchaseStep blocker={blocker} />}
			<div className="grid divide-separator max-sm:divide-y sm:grid-cols-2 sm:divide-x">
				{PAID_PLANS.map((id) => {
					const kind = getPurchaseKind(plan.planId, id);
					const isSelected = id === selected;
					return (
						<div
							key={id}
							ref={isSelected ? selectedRef : undefined}
							className={cn(
								// Columns split by a rule, no card frame: padding only on the side facing the rule.
								"flex scroll-mt-24 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:py-0 sm:first:pe-6 sm:last:ps-6",
							)}
						>
							<div className="grid gap-0.5">
								<div className="flex items-center justify-between gap-2">
									{id === "pro-ai" ? (
										// Pro AI in its own colour: the AI mark and a purple name with a pale sweep over it.
										<h3 className="flex items-center gap-1.5 text-base font-semibold text-violet-600 dark:text-violet-400">
											<Icon name="sparkle" size={18} />
											<TextShimmer className="text-violet-300 dark:text-violet-200 [&>:first-child]:text-violet-600! dark:[&>:first-child]:text-violet-400!">
												{getPlanName(id)}
											</TextShimmer>
										</h3>
									) : (
										<h3 className="text-base font-semibold">{getPlanName(id)}</h3>
									)}
									{isSelected && (
										<Chip size="sm" variant="soft" color="accent">
											<Chip.Label>
												<Trans>Selected</Trans>
											</Chip.Label>
										</Chip>
									)}
								</div>
								<span className="text-2xl font-semibold tracking-tight tabular-nums">
									{formatPrice(PLANS[id].priceIdr)}
								</span>
								<span className="text-xs text-muted">
									<Trans>For 30 days, no automatic renewal</Trans>
								</span>
							</div>
							<ul className="grid gap-2 text-sm">
								{planHighlights(id).map((line) => (
									<li key={line} className="flex gap-2">
										<Icon name="check" size={18} className="mt-0.5 shrink-0 text-muted" />
										<span>{line}</span>
									</li>
								))}
							</ul>
							{kind === "queue" && (
								<p className="text-xs text-muted">
									<Trans>Starts after your Pro AI time ends.</Trans>
								</p>
							)}
							{plan.canPurchase && (
								<Button
									fullWidth
									className="mt-auto"
									variant={isSelected || (!selected && id === "pro-ai") ? "primary" : "secondary"}
									onPress={() => setBuying(id)}
								>
									{getPurchaseLabel(kind, id)}
								</Button>
							)}
						</div>
					);
				})}
			</div>
			<PurchaseDialog planId={buying} current={plan.planId} onClose={() => setBuying(null)} />
		</SettingsSection>
	);
}
