import { releaseStaleReservations } from "./credits";
import { sendPendingReceipts } from "./receipt";
import { reconcilePayments } from "./reconcile";

/**
 * Billing's scheduled work, run every minute by the Workers cron and the Node scheduler before career jobs. Cron
 * triggers can overlap or repeat, so every task claims its rows and is safe to run twice; each task's failure stays
 * its own. Payments first: a customer may be waiting for one.
 */
export async function runBillingJobs(now = new Date()) {
	const checkedPayments = await reconcilePayments(now).catch(() => {
		console.error("[billing] Reconciling payments failed; they are checked again on the next run.");
		return 0;
	});
	const sentReceipts = await sendPendingReceipts(now).catch(() => {
		console.error("[billing] Sending payment receipts failed; they retry on the next run.");
		return 0;
	});
	const releasedReservations = await releaseStaleReservations(now).catch(() => {
		console.error("[billing] Releasing stale credit reservations failed; they retry on the next run.");
		return 0;
	});
	return { checkedPayments, sentReceipts, releasedReservations };
}
