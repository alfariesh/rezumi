import { Widget } from "@heroui-pro/react";
import { Button, Chip, Spinner, Table } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { getPlanName } from "./plan";
import {
	formatPrice,
	getPaymentMethodName,
	getPaymentStatusColor,
	getPaymentStatusLabel,
	hasReceipt,
} from "./purchase";
import { orpc } from "@/libs/orpc/client";

type PaymentHistorySectionProps = { formatDay: (date: Date) => string };

/** Every payment the account started, newest first, with its receipt once paid. Hidden until there is one. */
export function PaymentHistorySection({ formatDay }: PaymentHistorySectionProps) {
	const history = useInfiniteQuery(
		orpc.billing.payments.infiniteOptions({
			input: (cursor: string | undefined) => ({ cursor, limit: 10 }),
			initialPageParam: undefined,
			getNextPageParam: (page) => page.nextCursor ?? undefined,
		}),
	);
	const titleId = useId();
	const payments = history.data?.pages.flatMap((page) => page.items) ?? [];
	if (payments.length === 0) return null;

	return (
		// The HeroUI Pro table-in-widget pattern: rows run edge to edge on the white content, column names for screen
		// readers only.
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header className="grid gap-0.5">
				<Widget.Title id={titleId} role="heading" aria-level={2}>
					<Trans>Payments</Trans>
				</Widget.Title>
				<Widget.Description className="text-xs text-muted">
					<Trans>Receipts are proof of payment, not tax invoices.</Trans>
				</Widget.Description>
			</Widget.Header>
			<Widget.Content className="flex flex-col gap-0 p-0">
				<Table variant="secondary">
					<Table.ScrollContainer>
						<Table.Content aria-label={t`Payments`} className="text-sm">
							<Table.Header className="sr-only">
								<Table.Column isRowHeader>
									<Trans>Date</Trans>
								</Table.Column>
								<Table.Column>
									<Trans>Plan</Trans>
								</Table.Column>
								<Table.Column className="text-end">
									<Trans>Amount</Trans>
								</Table.Column>
								<Table.Column>
									<Trans>Method</Trans>
								</Table.Column>
								<Table.Column>
									<Trans>Status</Trans>
								</Table.Column>
								<Table.Column>
									<span className="sr-only">
										<Trans>Receipt</Trans>
									</span>
								</Table.Column>
							</Table.Header>
							<Table.Body>
								{payments.map((payment) => (
									<Table.Row key={payment.id} id={payment.id} className="last:[&_td]:border-b-0">
										<Table.Cell className="whitespace-nowrap">
											{formatDay(payment.paidAt ?? payment.createdAt)}
										</Table.Cell>
										<Table.Cell className="whitespace-nowrap">{getPlanName(payment.planId)}</Table.Cell>
										<Table.Cell className="text-end whitespace-nowrap tabular-nums">
											{formatPrice(payment.amount)}
										</Table.Cell>
										<Table.Cell>{getPaymentMethodName(payment.paymentType)}</Table.Cell>
										<Table.Cell>
											<Chip
												size="sm"
												variant="soft"
												className="whitespace-nowrap"
												color={getPaymentStatusColor(payment.status)}
											>
												<Chip.Label>{getPaymentStatusLabel(payment.status)}</Chip.Label>
											</Chip>
										</Table.Cell>
										<Table.Cell>
											{hasReceipt(payment) && (
												<Link
													to="/dashboard/settings/billing/receipt/$paymentId"
													params={{ paymentId: payment.id }}
													className="whitespace-nowrap underline underline-offset-2 hover:text-foreground"
												>
													<Trans>Receipt</Trans>
												</Link>
											)}
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
				{history.hasNextPage && (
					<Button
						size="sm"
						variant="ghost"
						className="m-2 w-fit"
						isPending={history.isFetchingNextPage}
						onPress={() => void history.fetchNextPage()}
					>
						{history.isFetchingNextPage && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Show older payments</Trans>
					</Button>
				)}
			</Widget.Content>
		</Widget>
	);
}
