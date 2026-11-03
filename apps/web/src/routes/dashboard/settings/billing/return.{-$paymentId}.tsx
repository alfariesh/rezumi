import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PaymentReturnPage } from "@/features/billing/payment-return";
import { paymentIdFromOrderId } from "@/features/billing/purchase";

/**
 * Midtrans' Finish URL and e-wallet callbacks: `return/<payment id>/`, with or without the slash and with Midtrans'
 * query added. The dashboard's fallback Finish URL has no ID, so it comes from `order_id` (`RZ-<payment id>`).
 */
export const Route = createFileRoute("/dashboard/settings/billing/return/{-$paymentId}")({
	validateSearch: z.object({ order_id: z.string().max(100).optional().catch(undefined) }),
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentId } = Route.useParams();
	const { order_id: orderId } = Route.useSearch();
	return <PaymentReturnPage paymentId={paymentId || paymentIdFromOrderId(orderId)} />;
}
