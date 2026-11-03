import type { PlanSummary } from "./plan";
import type { PaidPlanId } from "@rezumi/schema/billing";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ComponentProps, ReactNode } from "react";
import { Timeline } from "@heroui-pro/react";
import { Alert, Button, Drawer, Skeleton, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { LEGAL_URLS, PLANS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { creditCount } from "./credits";
import { getPlanName } from "./plan";
import { formatPrice, getPurchaseKind, getPurchaseLabel, splitPurchase, usePlanDates } from "./purchase";
import { orpc } from "@/libs/orpc/client";

/** The reason a checkout didn't open, in the user's words; the server's own messages aren't translated. */
function checkoutErrorMessage(error: unknown) {
	const code = error instanceof ORPCError ? error.code : null;
	if (code === "EMAIL_NOT_VERIFIED") return t`Verify your email address first, then try again.`;
	if (code === "BILLING_UNAVAILABLE") return t`Buying isn't available right now. Try again later.`;
	if (code === "TOO_MANY_REQUESTS") return t`Too many tries in a row. Wait a few minutes, then try again.`;
	return t`The payment page couldn't be opened. Try again in a moment.`;
}

type LegalLinkProps = { href: string; children: ReactNode };

function LegalLink({ href, children }: LegalLinkProps) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="underline underline-offset-2 hover:text-foreground"
		>
			{children}
		</a>
	);
}

type StepProps = Omit<ComponentProps<typeof Timeline.Item>, "title" | "status"> & {
	icon: IconName;
	status: "default" | "current" | "success" | "muted";
	title: ReactNode;
	/** When it happens, at the right; a date or a word such as "Now". */
	when: ReactNode;
	children?: ReactNode;
};

/** One step of what a purchase does, in the compact log style: title and time on a line, a note under it. */
function Step({ icon, status, title, when, children, ...item }: StepProps) {
	// Timeline passes each item where it sits in the list; it goes on to the item so the last one has no connector.
	return (
		<Timeline.Item {...item} status={status} align={children ? "start" : "center"}>
			<Timeline.Marker aria-hidden="true">
				<Icon name={icon} size={12} />
			</Timeline.Marker>
			<Timeline.Content className="gap-1 pb-2">
				<div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
					<h3 className="text-sm leading-tight font-medium">{title}</h3>
					<span className="shrink-0 text-xs leading-tight text-muted tabular-nums">{when}</span>
				</div>
				{children && <p className="text-xs leading-snug text-muted">{children}</p>}
			</Timeline.Content>
		</Timeline.Item>
	);
}

type PurchaseDialogProps = {
	/** The plan being bought; null keeps the dialog closed. */
	planId: PaidPlanId | null;
	current: PlanSummary["planId"];
	onClose: () => void;
};

/**
 * Confirms a purchase before Midtrans, in a drawer (right on desktop, from the bottom on phones): the plan, its final price, that it's 30 days paid once, what it does to the
 * current pass, the refund policy in brief and the terms it agrees to. Continuing opens Midtrans' payment page.
 */
export function PurchaseDialog({ planId, current, onClose }: PurchaseDialogProps) {
	const { formatShort, zoneName } = usePlanDates();
	const descriptionId = useId();
	const breakpoint = useBreakpoint();
	const plan = PLANS[planId ?? "plus"];
	// One key per attempt: a double click or a retried request returns the same payment instead of a second one.
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
	const [redirecting, setRedirecting] = useState(false);
	const preview = useQuery({
		...orpc.billing.previewPurchase.queryOptions({ input: { planId: plan.id } }),
		enabled: planId !== null,
	});
	const checkout = useMutation(orpc.billing.checkout.mutationOptions({ meta: { noInvalidate: true } }));
	const busy = checkout.isPending || redirecting;
	// A second click can land before the button re-renders as busy; this stops it from sending a second request.
	const started = useRef(false);

	useEffect(() => {
		// Back from Midtrans, the browser can restore this page as it was left: still on its way out.
		const restore = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			started.current = false;
			setRedirecting(false);
		};
		window.addEventListener("pageshow", restore);
		return () => window.removeEventListener("pageshow", restore);
	}, []);

	const pay = () => {
		if (started.current) return;
		started.current = true;
		checkout.mutate(
			{ planId: plan.id, idempotencyKey },
			{
				onSuccess: ({ redirectUrl }) => {
					setRedirecting(true);
					window.location.assign(redirectUrl);
				},
				onError: () => {
					started.current = false;
					setIdempotencyKey(crypto.randomUUID());
				},
			},
		);
	};

	const close = () => {
		if (busy) return;
		checkout.reset();
		setIdempotencyKey(crypto.randomUUID());
		onClose();
	};

	const name = getPlanName(plan.id);
	const days = plan.durationDays;
	const price = formatPrice(preview.data?.amount ?? plan.priceIdr);
	const credits = preview.data?.credits ?? plan.creditsPerPurchase;
	const split = preview.data ? splitPurchase(preview.data) : null;

	// Desktop slides in from the right; phones and tablets get a bottom sheet.
	const placement = breakpoint === "mobile" || breakpoint === "tablet" ? "bottom" : "right";

	const pass = split ? [split] : [];
	const steps = [
		<Step key="pay" icon="lock" status="default" title={<Trans>Pay</Trans>} when={<Trans>Now</Trans>}>
			<Trans>On Midtrans' secure payment page (QRIS, e-wallet or bank transfer), then you come back here.</Trans>
		</Step>,
		...(preview.isPending
			? [
					<Timeline.Item key="loading">
						<Timeline.Content>
							<Skeleton className="h-10 rounded-lg" />
						</Timeline.Content>
					</Timeline.Item>,
				]
			: pass.length === 0
				? [
						<Step
							key="start"
							icon="calendar-plus"
							status="current"
							title={<Trans>{name} starts</Trans>}
							when={<Trans>Once paid</Trans>}
						>
							<Trans>Time you already have is never lost.</Trans>
						</Step>,
					]
				: pass.flatMap(({ pass: stretch, waitsFor, after }) => [
						<Step
							key="start"
							icon="calendar-plus"
							status="current"
							title={<Trans>{name} starts</Trans>}
							when={waitsFor ? formatShort(stretch.startsAt) : <Trans>Once paid</Trans>}
						>
							{waitsFor || credits > 0 ? (
								<>
									{waitsFor && <Trans>After your {getPlanName(waitsFor.planId)} time ends.</Trans>}{" "}
									{credits > 0 && <Trans>{creditCount(credits)} for Rezumi AI come with it.</Trans>}
								</>
							) : undefined}
						</Step>,
						<Step
							key="end"
							icon="stop-circle"
							status="default"
							title={<Trans>{name} ends</Trans>}
							when={formatShort(stretch.endsAt)}
						>
							{credits > 0 ? <Trans>Credits left from this pass expire with it.</Trans> : undefined}
						</Step>,
						...after.flatMap((later) => {
							const rest = getPlanName(later.planId);
							return [
								<Step
									key={`${later.startsAt.toISOString()}-start`}
									icon="play"
									status="muted"
									title={<Trans>Your {rest} time picks up again</Trans>}
									when={formatShort(later.startsAt)}
								/>,
								<Step
									key={`${later.startsAt.toISOString()}-end`}
									icon="stop-circle"
									status="muted"
									title={<Trans>{rest} ends</Trans>}
									when={formatShort(later.endsAt)}
								/>,
							];
						}),
					])),
	];

	return (
		<Drawer.Backdrop isOpen={planId !== null} onOpenChange={(open) => !open && close()}>
			<Drawer.Content placement={placement}>
				<Drawer.Dialog aria-describedby={descriptionId}>
					{placement === "bottom" && <Drawer.Handle />}
					<Drawer.CloseTrigger aria-label={t`Close`} />
					<Drawer.Header>
						<Drawer.Heading>{getPurchaseLabel(getPurchaseKind(current, plan.id), plan.id)}</Drawer.Heading>
					</Drawer.Header>
					<Drawer.Body className="grid content-start gap-6 text-sm">
						<div id={descriptionId} className="grid gap-1">
							<p className="flex items-baseline justify-between gap-3">
								<span className="font-medium">{name}</span>
								<span className="text-2xl font-semibold tracking-tight tabular-nums">{price}</span>
							</p>
							<p className="text-muted">
								<Trans>{days} days of access, paid once. It doesn't renew on its own.</Trans>
							</p>
						</div>

						{/* What happens, in order, one step per moment: pay, the pass starts, it ends, then any time it pushed back. */}
						<div className="grid gap-2">
							<Timeline density="compact" size="sm">
								{steps}
							</Timeline>
							{split && (
								<p className="text-xs text-muted">
									{split.waitsFor ? (
										<Trans>Times in {zoneName(split.pass.startsAt)}.</Trans>
									) : (
										<Trans>Times in {zoneName(split.pass.endsAt)}, estimated for paying now.</Trans>
									)}
								</p>
							)}
						</div>

						<p className="text-muted">
							<Trans>
								On a first purchase you can ask for a full refund within 7 days if you used no more than 10 Rezumi AI
								credits from it. Double payments and technical problems are always sorted out.
							</Trans>
						</p>

						{checkout.isError && (
							<Alert status="danger">
								<Alert.Indicator>
									<Icon name="warning-circle" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Description>{checkoutErrorMessage(checkout.error)}</Alert.Description>
								</Alert.Content>
							</Alert>
						)}

						<p className="text-xs text-muted">
							<Trans>
								By continuing, you agree to the <LegalLink href={LEGAL_URLS.terms}>Terms of service</LegalLink> and the{" "}
								<LegalLink href={LEGAL_URLS.refund}>Refund policy</LegalLink>.
							</Trans>
						</p>
					</Drawer.Body>
					<Drawer.Footer>
						<Button variant="tertiary" isDisabled={busy} onPress={close}>
							<Trans>Cancel</Trans>
						</Button>
						<Button className="flex-1" isPending={busy} onPress={pay}>
							{busy && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Continue to payment</Trans>
						</Button>
					</Drawer.Footer>
				</Drawer.Dialog>
			</Drawer.Content>
		</Drawer.Backdrop>
	);
}
