import type { AdminCustomer, AdminPayment } from "./labels";
import type { DataGridColumn } from "@heroui-pro/react";
import type { PaidPlanId } from "@rezumi/schema/billing";
import { DataGrid, Timeline } from "@heroui-pro/react";
import {
	Avatar,
	Button,
	Checkbox,
	Chip,
	Dropdown,
	Input,
	Label,
	Skeleton,
	Spinner,
	TextField,
	Typography,
} from "@heroui/react";
import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { getPlanName } from "../plan";
import {
	formatPrice,
	getPaymentReasonLabel,
	getPaymentStatusColor,
	getPaymentStatusLabel,
	isPaymentFailed,
	usePlanDates,
} from "../purchase";
import { describeAudit, describeEvent, formatMoney, getSubscriptionStatusLabel } from "./labels";
import { AdminCard, StatWidget } from "./parts";
import { ReasonDialog } from "./reason-dialog";
import { SelectField } from "@/components/input/select-field";
import { getReadableErrorMessage } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

/** Days typed by the admin; null until it is a positive whole number. */
const wholeNumber = (text: string) => (/^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : null);

/** An amount typed in plain units ("4.99", "59000"), as the currency's smallest unit; null until it reads as one. */
const typedAmount = (text: string) =>
	/^\d{1,9}([.,]\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text.trim().replace(",", ".")) * 100) : null;

type NumberInputProps = { label: string; value: string; onChange: (value: string) => void; placeholder?: string };

function NumberInput({ label, value, onChange, placeholder }: NumberInputProps) {
	return (
		<TextField fullWidth value={value} onChange={onChange} className="gap-1.5">
			<Label>{label}</Label>
			<Input variant="secondary" inputMode="numeric" {...(placeholder && { placeholder })} />
		</TextField>
	);
}

/** Which dialog is open, and for what. */
type Dialog =
	| { kind: "refund"; payment: AdminPayment }
	| { kind: "revoke-period"; periodId: string }
	| { kind: "grant-period" }
	| { kind: "adjust-credits" }
	| null;

type DialogsProps = { userId: string; dialog: Dialog; onClose: () => void; onDone: () => void };

function Dialogs({ userId, dialog, onClose, onDone }: DialogsProps) {
	const [amount, setAmount] = useState("");
	const [revoke, setRevoke] = useState(false);
	const [endSubscription, setEndSubscription] = useState(false);
	const [planId, setPlanId] = useState<PaidPlanId>("plus");
	const [days, setDays] = useState("30");
	const [expiresIn, setExpiresIn] = useState("30");
	const reset = () => {
		setAmount("");
		setRevoke(false);
		setEndSubscription(false);
		setDays("30");
		setExpiresIn("30");
	};
	const props = (kind: NonNullable<Dialog>["kind"]) => ({
		isOpen: dialog?.kind === kind,
		onOpenChange: (open: boolean) => {
			if (!open) {
				onClose();
				reset();
			}
		},
	});
	const done = (message: string) => {
		toast.add({ type: "success", description: message });
		onDone();
	};

	const payment = dialog && "payment" in dialog ? dialog.payment : null;
	const currency = payment?.currency ?? "usd";
	const left = payment ? payment.amount - payment.refundedAmount : 0;
	const typed = typedAmount(amount);
	const refundAmount = typed ?? left;
	const partial = refundAmount < (payment?.amount ?? 0);
	const amountOk = refundAmount > 0 && refundAmount <= left && (amount.trim() === "" || typed !== null);

	// A QRIS pass is refunded by hand (Sumopod has no refund API): the owner sends the money, then records it here.
	const qris = payment?.method === "qris";

	const revokeBox = partial && (
		<Checkbox variant="secondary" isSelected={revoke} onChange={setRevoke}>
			<Checkbox.Content>
				<Checkbox.Control>
					<Checkbox.Indicator />
				</Checkbox.Control>
				<span className="text-sm">
					{qris ? (
						<Trans>Also take back the pass and its remaining credits</Trans>
					) : (
						<Trans>Also take back the remaining credits from this payment</Trans>
					)}
				</span>
			</Checkbox.Content>
		</Checkbox>
	);

	return (
		<>
			<ReasonDialog
				{...props("refund")}
				danger
				title={qris ? <Trans>Record a QRIS refund</Trans> : <Trans>Refund through Dodo Payments</Trans>}
				description={
					payment && (
						<>
							{qris ? `RZ-${payment.id}` : payment.providerPaymentId} · {formatPrice(payment.amount, currency)} ·{" "}
							{getPaymentReasonLabel(payment)}
						</>
					)
				}
				canSubmit={amountOk}
				submitLabel={
					qris ? (
						<Trans>Record {formatPrice(refundAmount, currency)} refunded</Trans>
					) : (
						<Trans>Refund {formatPrice(refundAmount, currency)}</Trans>
					)
				}
				onSubmit={async (reason) => {
					if (!payment) return;
					const result = await client.billing.admin.refund({
						paymentId: payment.id,
						...(amount.trim() === "" ? {} : { amount: refundAmount }),
						reason,
						revokeBenefits: partial ? revoke : undefined,
						endSubscription: payment.subscriptionId ? endSubscription : undefined,
					});
					done(
						result.status === "succeeded"
							? t`Refunded ${formatPrice(result.amount, currency)}.`
							: t`Dodo Payments hasn't confirmed it yet. Check the status in a moment.`,
					);
				}}
			>
				{payment && (
					<div className="grid gap-3">
						<p className="rounded-xl bg-surface-secondary px-3 py-2 text-sm">
							{qris ? (
								<Trans>
									Sumopod can't send refunds. Send the money back yourself first (bank transfer or e-wallet), then
									record it here. A full refund takes the pass back (later passes move up) and its remaining credits.
								</Trans>
							) : (
								<Trans>
									Enter the amount before tax: Dodo Payments gives the tax on it back itself, and its fees aren't
									returned. A full refund takes back the remaining credits. A refund alone doesn't end the subscription.
								</Trans>
							)}
						</p>
						<NumberInput
							label={
								qris
									? t`Amount sent back (${currency.toUpperCase()}), up to ${formatPrice(left, currency)}`
									: t`Amount before tax (${currency.toUpperCase()}), up to ${formatPrice(left, currency)}`
							}
							value={amount}
							onChange={setAmount}
							placeholder={t`Empty: the rest, ${formatPrice(left, currency)}`}
						/>
						{revokeBox}
						{payment.subscriptionId && (
							<Checkbox variant="secondary" isSelected={endSubscription} onChange={setEndSubscription}>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
									<span className="text-sm">
										<Trans>Also end the subscription now (access stops at once)</Trans>
									</span>
								</Checkbox.Content>
							</Checkbox>
						)}
					</div>
				)}
			</ReasonDialog>

			<ReasonDialog
				{...props("revoke-period")}
				danger
				title={<Trans>Revoke this pass</Trans>}
				description={<Trans>A running pass ends now; a queued one is dropped, and later passes move up.</Trans>}
				submitLabel={<Trans context="Taking a paid pass away">Revoke</Trans>}
				onSubmit={async (reason) => {
					if (dialog?.kind !== "revoke-period") return;
					await client.billing.admin.revokePeriod({ periodId: dialog.periodId, reason });
					done(t`Pass revoked.`);
				}}
			/>

			<ReasonDialog
				{...props("grant-period")}
				title={<Trans>Give a pass</Trans>}
				description={<Trans>Queued like a purchase. No payment and no credits come with it.</Trans>}
				canSubmit={(wholeNumber(days) ?? 0) >= 1 && (wholeNumber(days) ?? 0) <= 366}
				submitLabel={<Trans>Give pass</Trans>}
				onSubmit={async (reason) => {
					await client.billing.admin.grantPeriod({ userId, planId, days: wholeNumber(days) ?? 0, reason });
					done(t`Pass given.`);
				}}
			>
				<SelectField
					label={<Trans>Plan</Trans>}
					value={planId}
					onChange={(next) => setPlanId(next === "pro-ai" ? "pro-ai" : "plus")}
					options={[
						{ value: "plus", label: "Plus" },
						{ value: "pro-ai", label: "Pro AI" },
					]}
				/>
				<NumberInput label={t`Days (1–366)`} value={days} onChange={setDays} />
			</ReasonDialog>

			<ReasonDialog
				{...props("adjust-credits")}
				title={<Trans>Adjust Rezumi AI credits</Trans>}
				description={<Trans>A negative amount takes credits away, soonest-expiring first, never below zero.</Trans>}
				canSubmit={/^-?\d{1,5}$/.test(amount.trim()) && Number(amount) !== 0}
				submitLabel={<Trans>Adjust</Trans>}
				onSubmit={async (reason) => {
					const credits = Number(amount.trim());
					await client.billing.admin.adjustCredits({
						userId,
						amount: credits,
						...(credits > 0 ? { expiresInDays: wholeNumber(expiresIn) ?? 30 } : {}),
						reason,
					});
					done(t`Credits adjusted.`);
				}}
			>
				<TextField fullWidth value={amount} onChange={setAmount} className="gap-1.5">
					<Label>
						<Trans>Credits (e.g. 20 or -5)</Trans>
					</Label>
					<Input variant="secondary" inputMode="numeric" />
				</TextField>
				{Number(amount) > 0 && (
					<NumberInput label={t`Added credits expire in (days)`} value={expiresIn} onChange={setExpiresIn} />
				)}
			</ReasonDialog>
		</>
	);
}

type PaymentActionsProps = {
	payment: AdminPayment;
	onDialog: (dialog: Dialog) => void;
	onDone: () => void;
};

/** One payment's menu: ask its provider (Dodo Payments or Sumopod) again, or refund it (a QRIS one by hand). */
function PaymentActions({ payment, onDialog, onDone }: PaymentActionsProps) {
	const [busy, setBusy] = useState(false);
	const refundable = payment.refundable && (payment.status === "paid" || payment.status === "partially_refunded");

	const sync = async () => {
		setBusy(true);
		try {
			const result = await client.billing.admin.syncPayment({ paymentId: payment.id });
			toast.add({
				type: "success",
				description:
					payment.method === "qris"
						? t`Sumopod can't be asked about a payment; it reports by webhook. Here: ${getPaymentStatusLabel(result.status)}. If Sumopod shows it paid, resend its webhook from the Webhooks tab there.`
						: result.found
							? t`Checked with Dodo Payments. Here: ${getPaymentStatusLabel(result.status)}.`
							: t`Dodo Payments has nothing for this payment yet.`,
			});
			onDone();
		} catch (error) {
			toast.add({ type: "error", description: getReadableErrorMessage(error, t`That didn't work. Try again.`) });
		} finally {
			setBusy(false);
		}
	};

	const disabled = refundable ? [] : ["refund"];

	return (
		<Dropdown>
			<Button
				isIconOnly
				size="sm"
				variant="ghost"
				aria-label={t`Actions for ${payment.providerPaymentId ?? payment.id}`}
				isPending={busy}
			>
				{busy ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name="dots-three" size={18} />}
			</Button>
			<Dropdown.Popover placement="bottom end" className="min-w-56">
				<Dropdown.Menu
					disabledKeys={disabled}
					onAction={(key) => {
						if (key === "sync") void sync();
						if (key === "refund") onDialog({ kind: "refund", payment });
					}}
				>
					<Dropdown.Item id="sync" textValue={t`Check status`}>
						<Icon name="arrows-clockwise" size={16} />
						<Label>
							<Trans>Check status</Trans>
						</Label>
					</Dropdown.Item>
					<Dropdown.Item
						id="refund"
						textValue={payment.method === "qris" ? t`Record a QRIS refund` : t`Refund through Dodo Payments`}
						variant="danger"
					>
						<Icon name="arrow-counter-clockwise" size={16} />
						<Label>
							{payment.method === "qris" ? (
								<Trans>Record a QRIS refund</Trans>
							) : (
								<Trans>Refund through Dodo Payments</Trans>
							)}
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

// Grey markers are hollow by default and read smaller than the tinted ones; a soft fill evens them out.
const GREY_TONES = new Set<string>(["default", "muted"]);
const GREY_MARKER = "border-default-hover bg-default text-muted";

/** The marker icon for each kind of history entry. */
const HISTORY_ICONS = {
	success: "check",
	warning: "arrow-counter-clockwise",
	danger: "x",
	muted: "arrows-clockwise",
	default: "info",
} as const;

/** Where a pass stands in the schedule, as a chip. */
function periodState(period: AdminCustomer["periods"][number], now: number) {
	if (period.revokedAt)
		return { label: t`Revoked`, color: "danger" as const, tone: "danger" as const, icon: "x" as const };
	if (!period.live)
		return { label: t`Ended`, color: "default" as const, tone: "muted" as const, icon: "check" as const };
	return +period.startsAt <= now
		? { label: t`Running`, color: "success" as const, tone: "current" as const, icon: "seal-check" as const }
		: { label: t`Queued`, color: "accent" as const, tone: "default" as const, icon: "hourglass" as const };
}

type CustomerBodyProps = { data: AdminCustomer; onDialog: (dialog: Dialog) => void; onDone: () => void };

function CustomerBody({ data, onDialog, onDone }: CustomerBodyProps) {
	const { formatShort, formatDate } = usePlanDates();
	const [now] = useState(() => Date.now());
	const { plan, credits } = data;
	// Money that stayed, per currency: a payment the bank reversed is gone with its refunds.
	const paid = data.payments.filter((payment) => payment.paidAt && payment.status !== "reversed");
	const totalPaid: Record<string, number> = {};
	const totalRefunded: Record<string, number> = {};
	for (const payment of paid)
		totalPaid[payment.currency] = (totalPaid[payment.currency] ?? 0) + payment.amount - payment.refundedAmount;
	for (const payment of data.payments)
		if (payment.refundedAmount)
			totalRefunded[payment.currency] = (totalRefunded[payment.currency] ?? 0) + payment.refundedAmount;
	const refunds = data.payments.flatMap((payment) =>
		payment.refunds.map((refund) => ({
			...refund,
			providerPaymentId: payment.providerPaymentId,
			currency: payment.currency,
		})),
	);
	const history = [
		...data.events.map((event) => ({
			id: event.id,
			at: event.receivedAt,
			...describeEvent(event),
			source: event.source === "webhook" ? t`webhook` : event.source === "admin" ? t`admin` : t`status check`,
			reason: null,
		})),
		...data.audit.map((entry) => ({
			id: entry.id,
			at: entry.createdAt,
			...describeAudit(entry),
			source: entry.actorUserId ? t`admin` : t`system`,
			reason: entry.reason,
		})),
	].toSorted((a, b) => +b.at - +a.at);

	const paymentColumns: DataGridColumn<AdminPayment>[] = [
		{
			id: "order",
			header: t`Payment`,
			isRowHeader: true,
			cell: (payment) => (
				<span className="grid gap-0.5 whitespace-nowrap">
					<span
						className="font-mono text-xs whitespace-nowrap"
						title={
							payment.method === "qris"
								? `RZ-${payment.id}`
								: (payment.providerPaymentId ?? payment.checkoutId ?? payment.id)
						}
					>
						{payment.method === "qris"
							? `RZ-…${payment.id.slice(-8)}`
							: payment.providerPaymentId
								? `…${payment.providerPaymentId.slice(-8)}`
								: t`checkout only`}
					</span>
					<span className="text-xs text-muted">
						{payment.method === "qris" ? "QRIS · " : ""}
						{formatShort(payment.createdAt)}
					</span>
				</span>
			),
		},
		{
			id: "plan",
			header: t`Plan`,
			cell: (payment) => (
				<span className="grid gap-0.5">
					<span>{getPlanName(payment.planId)}</span>
					<span className="text-xs text-muted">{getPaymentReasonLabel(payment)}</span>
				</span>
			),
		},
		{
			id: "amount",
			header: t`Amount`,
			align: "end",
			cell: (payment) => (
				<span className="grid gap-0.5 tabular-nums">
					<span>{formatPrice(payment.amount, payment.currency)}</span>
					{payment.taxAmount > 0 && (
						<span className="text-xs text-muted">
							+{formatPrice(payment.taxAmount, payment.currency)} {t`tax`}
						</span>
					)}
					{payment.refundedAmount > 0 && (
						<span className="text-xs text-muted">−{formatPrice(payment.refundedAmount, payment.currency)}</span>
					)}
				</span>
			),
		},
		{
			id: "status",
			header: t`Status`,
			cell: (payment) => (
				<span className="grid justify-items-start gap-1">
					<Chip size="sm" variant="soft" color={getPaymentStatusColor(payment.status)}>
						<Chip.Label>{getPaymentStatusLabel(payment.status)}</Chip.Label>
					</Chip>
					{payment.paidAt && !payment.fulfilledAt && (
						<span className="text-xs text-danger">
							<Trans>Not applied</Trans>
						</span>
					)}
				</span>
			),
		},
		{
			id: "paid",
			header: t`Paid`,
			cell: (payment) =>
				payment.paidAt ? (
					<span className="grid gap-0.5">
						<span className="text-sm">{formatShort(payment.paidAt)}</span>
						{payment.periodEnd && (
							<span className="text-xs text-muted">{t`covers until ${formatShort(payment.periodEnd)}`}</span>
						)}
					</span>
				) : (
					<span className="text-xs text-muted">{payment.failureReason ?? payment.providerStatus ?? "—"}</span>
				),
		},
		{
			id: "actions",
			header: <span className="sr-only">{t`Actions`}</span>,
			align: "end",
			cell: (payment) => <PaymentActions payment={payment} onDialog={onDialog} onDone={onDone} />,
		},
	];

	return (
		<>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<StatWidget
					icon={<Icon name="seal-check" size={16} />}
					title={<Trans>Plan now</Trans>}
					value={getPlanName(plan.planId)}
					footer={
						plan.currentPeriodEndsAt
							? plan.renews
								? t`renews ${formatDate(plan.currentPeriodEndsAt)}`
								: t`until ${formatDate(plan.currentPeriodEndsAt)}`
							: t`No paid plan running`
					}
				/>
				<StatWidget
					icon={<Icon name="sparkle" size={16} />}
					title={<Trans>Rezumi AI credits</Trans>}
					value={credits.balance}
					footer={
						credits.nextExpiry
							? t`${credits.nextExpiry.credits} expire ${formatShort(credits.nextExpiry.at)}`
							: credits.trial.grantedAt
								? t`Trial given ${formatShort(credits.trial.grantedAt)}`
								: t`Trial not given yet`
					}
				/>
				<StatWidget
					icon={<Icon name="check-circle" size={16} />}
					title={<Trans>Paid in total</Trans>}
					value={formatMoney(totalPaid)}
					footer={plural(paid.length, {
						one: "# paid payment, after refunds",
						other: "# paid payments, after refunds",
					})}
				/>
				<StatWidget
					icon={<Icon name="arrow-counter-clockwise" size={16} />}
					title={<Trans>Refunded</Trans>}
					value={formatMoney(totalRefunded)}
					footer={plural(refunds.filter((refund) => refund.status === "succeeded").length, {
						one: "# refund done",
						other: "# refunds done",
					})}
				/>
			</div>

			<AdminCard
				plain
				title={
					<span className="flex items-center gap-2">
						<Trans>Payments</Trans>
						<Chip size="sm" variant="soft">
							<Chip.Label>{data.payments.length}</Chip.Label>
						</Chip>
					</span>
				}
				description={
					<Trans>
						Newest first. The menu at the end of a row checks with the provider (Dodo Payments or Sumopod) or refunds.
					</Trans>
				}
			>
				<DataGrid
					aria-label={t`Payments`}
					columns={paymentColumns}
					data={data.payments}
					getRowId={(payment) => payment.id}
					contentClassName="min-w-[780px]"
					renderEmptyState={() => (
						<p className="py-10 text-center text-sm text-muted">
							<Trans>No payments.</Trans>
						</p>
					)}
				/>
			</AdminCard>

			{refunds.length > 0 && (
				<AdminCard icon="arrow-counter-clockwise" plain title={<Trans>Refunds</Trans>}>
					<DataGrid
						aria-label={t`Refunds`}
						data={refunds}
						getRowId={(refund) => refund.id}
						contentClassName="min-w-[680px]"
						columns={[
							{
								id: "order",
								header: t`Payment`,
								isRowHeader: true,
								cell: (refund) => (
									<span className="font-mono text-xs whitespace-nowrap">
										…{(refund.providerPaymentId ?? "").slice(-8)}
									</span>
								),
							},
							{
								id: "amount",
								header: t`Amount`,
								align: "end",
								cell: (refund) => <span className="tabular-nums">{formatPrice(refund.amount, refund.currency)}</span>,
							},
							{
								id: "how",
								header: t`How`,
								cell: (refund) =>
									refund.method === "manual"
										? t`Manual transfer`
										: refund.method === "midtrans"
											? "Midtrans"
											: refund.method === "polar"
												? "Polar"
												: "Dodo Payments",
							},
							{
								id: "status",
								header: t`Status`,
								cell: (refund) => (
									<Chip
										size="sm"
										variant="soft"
										color={
											refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "warning"
										}
									>
										<Chip.Label>
											{refund.status === "succeeded"
												? t`Done`
												: refund.status === "requesting"
													? t`Waiting for Dodo Payments`
													: t`Refused (${refund.failureReason ?? "—"})`}
										</Chip.Label>
									</Chip>
								),
							},
							{
								id: "reason",
								header: t`Reason`,
								cell: (refund) => <span className="block max-w-64 truncate">{refund.reason}</span>,
							},
							{
								id: "when",
								header: t`When`,
								cell: (refund) => (
									<span className="whitespace-nowrap text-muted">
										{formatShort(refund.settledAt ?? refund.createdAt)}
									</span>
								),
							},
						]}
					/>
				</AdminCard>
			)}

			{data.subscriptions.length > 0 && (
				<AdminCard icon="arrows-clockwise" plain title={<Trans>Subscriptions</Trans>}>
					<DataGrid
						aria-label={t`Subscriptions`}
						data={data.subscriptions}
						getRowId={(subscription) => subscription.id}
						contentClassName="min-w-[680px]"
						columns={[
							{
								id: "plan",
								header: t`Plan`,
								isRowHeader: true,
								cell: (subscription) => (
									<span className="grid gap-0.5">
										<span>{getPlanName(subscription.planId)}</span>
										<span className="text-xs text-muted">
											{subscription.interval === "year" ? t`Yearly` : t`Monthly`} ·{" "}
											{formatPrice(subscription.amount, subscription.currency)}
										</span>
									</span>
								),
							},
							{
								id: "status",
								header: t`Status`,
								cell: (subscription) => (
									<Chip
										size="sm"
										variant="soft"
										color={
											subscription.status === "active"
												? subscription.cancelAtPeriodEnd
													? "warning"
													: "success"
												: isPaymentFailed(subscription)
													? "danger"
													: "default"
										}
									>
										<Chip.Label>{getSubscriptionStatusLabel(subscription)}</Chip.Label>
									</Chip>
								),
							},
							{
								id: "period",
								header: t`Period`,
								cell: (subscription) => (
									<span className="text-xs text-muted tabular-nums">
										{formatShort(subscription.currentPeriodStart)} –{" "}
										{subscription.currentPeriodEnd ? formatShort(subscription.currentPeriodEnd) : "—"}
									</span>
								),
							},
							{
								id: "paid",
								header: t`Paid through`,
								cell: (subscription) => (
									<span className="text-xs text-muted tabular-nums">
										{subscription.paidThrough ? formatShort(subscription.paidThrough) : "—"}
									</span>
								),
							},
							{
								id: "provider",
								header: t`Dodo id`,
								cell: (subscription) => (
									<span className="font-mono text-xs" title={subscription.providerSubscriptionId}>
										…{subscription.providerSubscriptionId.slice(-8)}
									</span>
								),
							},
						]}
					/>
				</AdminCard>
			)}

			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<AdminCard
					icon="tag"
					title={<Trans>Granted periods</Trans>}
					description={
						<Trans>
							QRIS passes, time given by an admin or a promotion, and 30-day passes from before, newest first.
						</Trans>
					}
				>
					{data.periods.length === 0 ? (
						<p className="py-6 text-center text-sm text-muted">
							<Trans>None.</Trans>
						</p>
					) : (
						<Timeline density="compact" size="sm">
							{data.periods.map((period) => {
								const state = periodState(period, now);
								return (
									<Timeline.Item key={period.id} status={state.tone}>
										<Timeline.Marker aria-hidden="true" className={cn(GREY_TONES.has(state.tone) && GREY_MARKER)}>
											<Icon name={state.icon} size={12} />
										</Timeline.Marker>
										<Timeline.Content className="pb-3">
											<div className="flex items-start justify-between gap-3">
												<div className="grid min-w-0 gap-0.5">
													<span className="flex items-center gap-2 text-sm font-medium">
														{getPlanName(period.planId)}
														<Chip size="sm" variant="soft" color={state.color}>
															<Chip.Label>{state.label}</Chip.Label>
														</Chip>
													</span>
													<span className="text-xs text-muted tabular-nums">
														{formatShort(period.startsAt)} – {formatShort(period.endsAt)} ·{" "}
														{period.source === "payment"
															? t`bought`
															: period.source === "admin"
																? t`given`
																: period.source}
														{period.revokeReason && ` · ${period.revokeReason}`}
													</span>
												</div>
												{period.live && (
													<Button
														size="sm"
														variant="ghost"
														onPress={() => onDialog({ kind: "revoke-period", periodId: period.id })}
													>
														<Trans context="Taking a paid pass away">Revoke</Trans>
													</Button>
												)}
											</div>
										</Timeline.Content>
									</Timeline.Item>
								);
							})}
						</Timeline>
					)}
				</AdminCard>

				<AdminCard
					icon="clock-counter-clockwise"
					title={<Trans>History</Trans>}
					description={<Trans>Payment provider events and admin actions, newest first.</Trans>}
				>
					{history.length === 0 ? (
						<p className="py-6 text-center text-sm text-muted">
							<Trans>Nothing yet.</Trans>
						</p>
					) : (
						<div className="max-h-96 overflow-y-auto">
							<Timeline density="compact" size="sm">
								{history.map((entry) => (
									<Timeline.Item key={entry.id} status={entry.tone}>
										<Timeline.Marker aria-hidden="true" className={cn(GREY_TONES.has(entry.tone) && GREY_MARKER)}>
											<Icon name={HISTORY_ICONS[entry.tone]} size={12} />
										</Timeline.Marker>
										<Timeline.Content className="gap-0.5 pb-3">
											<div className="flex items-start justify-between gap-3">
												<span className="flex min-w-0 flex-wrap items-center gap-2">
													<span className="text-sm font-medium">{entry.title}</span>
													<Chip size="sm" variant="soft">
														<Chip.Label>{entry.source}</Chip.Label>
													</Chip>
												</span>
												<span className="shrink-0 text-xs text-muted tabular-nums">{formatShort(entry.at)}</span>
											</div>
											{entry.reason && <span className="text-xs text-muted">“{entry.reason}”</span>}
										</Timeline.Content>
									</Timeline.Item>
								))}
							</Timeline>
						</div>
					)}
				</AdminCard>
			</div>
		</>
	);
}

type CustomerBillingPageProps = { userId: string };

/**
 * One customer's billing, for support: plan, credits, subscriptions, payments with their actions, refunds, granted
 * periods and history.
 */
export function CustomerBillingPage({ userId }: CustomerBillingPageProps) {
	const queryClient = useQueryClient();
	const [dialog, setDialog] = useState<Dialog>(null);
	const customer = useQuery(orpc.billing.admin.customer.queryOptions({ input: { userId } }));
	const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.billing.admin.key() });
	const account = customer.data?.account;

	return (
		<div className="flex flex-col gap-4">
			<Link
				to="/dashboard/admin/billing"
				className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
			>
				<Icon name="caret-left" size={16} />
				<Trans>Billing</Trans>
			</Link>
			<header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<Avatar color="accent" variant="soft" className="size-12 shrink-0">
						<Avatar.Fallback className="font-semibold">{getInitials(account?.name ?? "")}</Avatar.Fallback>
					</Avatar>
					<div className="grid min-w-0 gap-1">
						<Typography type="h2" render={renderAsH1} className="truncate">
							{account?.email ?? <Trans>Customer</Trans>}
						</Typography>
						{customer.data && account && (
							<div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
								<span>{account.name}</span>
								<Chip size="sm" variant="soft" color={customer.data.plan.planId === "free" ? "default" : "accent"}>
									<Chip.Label>{getPlanName(customer.data.plan.planId)}</Chip.Label>
								</Chip>
								{!customer.data.billingApplies && (
									<Chip size="sm" variant="soft" color="warning">
										<Chip.Label>{t`Plans don't apply yet (BILLING_MODE)`}</Chip.Label>
									</Chip>
								)}
								{!account.emailVerified && (
									<Chip size="sm" variant="soft">
										<Chip.Label>{t`email not verified`}</Chip.Label>
									</Chip>
								)}
								{account.isAnonymous && (
									<Chip size="sm" variant="soft">
										<Chip.Label>{t`guest`}</Chip.Label>
									</Chip>
								)}
							</div>
						)}
					</div>
				</div>
				{customer.data && (
					<div className="flex flex-wrap gap-2">
						<Button size="sm" variant="tertiary" onPress={() => setDialog({ kind: "adjust-credits" })}>
							<Icon name="sparkle" size={16} />
							<Trans>Adjust credits</Trans>
						</Button>
						<Button size="sm" onPress={() => setDialog({ kind: "grant-period" })}>
							<Icon name="plus-circle" size={16} />
							<Trans>Give a pass</Trans>
						</Button>
					</div>
				)}
			</header>

			{customer.data ? (
				<CustomerBody data={customer.data} onDialog={setDialog} onDone={refresh} />
			) : customer.error ? (
				<p role="alert" className="text-sm text-danger">
					{getReadableErrorMessage(customer.error, t`This customer couldn't load.`)}
				</p>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((index) => (
						<Skeleton key={index} className="h-28 rounded-2xl" />
					))}
				</div>
			)}
			{account && (
				<p className="text-xs text-muted">
					{t`Account ${account.id} · created ${formatAccountDate(account.createdAt)} · time zone ${account.timezone}`}
				</p>
			)}
			<Dialogs userId={userId} dialog={dialog} onClose={() => setDialog(null)} onDone={refresh} />
		</div>
	);
}

const formatAccountDate = (date: Date) =>
	date.toLocaleDateString(i18n.locale, { day: "numeric", month: "short", year: "numeric" });
