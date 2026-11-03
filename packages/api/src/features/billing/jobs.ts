import { detectBillingProblems, queueDailySummary } from "./alerts";
import { releaseStaleReservations } from "./credits";
import { queueExpiryReminders, sendBillingNotifications } from "./notifications";
import { sendPendingReceipts } from "./receipt";
import { reconcilePayments } from "./reconcile";
import { reconcileRefunds } from "./refunds";

/** Runs one task, logging its failure instead of throwing, so the next task still runs. */
async function task<T>(work: () => Promise<T>, fallback: T, failure: string): Promise<T> {
	try {
		return await work();
	} catch {
		console.error(`[billing] ${failure}`);
		return fallback;
	}
}

/**
 * Billing's scheduled work, run every minute by the Workers cron and the Node scheduler before career jobs. Cron
 * triggers can overlap or repeat, so every task claims its rows and is safe to run twice; each task's failure stays
 * its own. Payments first: a customer may be waiting for one; then refunds still waiting on Midtrans. Then the emails: receipts, the owner's alerts and daily
 * summary, and reminders that a pass ends soon.
 */
export async function runBillingJobs(now = new Date()) {
	const checkedPayments = await task(
		() => reconcilePayments(now),
		0,
		"Reconciling payments failed; they are checked again on the next run.",
	);
	const checkedRefunds = await task(
		() => reconcileRefunds(now),
		0,
		"Checking waiting refunds failed; they are checked again on the next run.",
	);
	const sentReceipts = await task(
		() => sendPendingReceipts(now),
		0,
		"Sending payment receipts failed; they retry on the next run.",
	);
	const releasedReservations = await task(
		() => releaseStaleReservations(now),
		0,
		"Releasing stale credit reservations failed; they retry on the next run.",
	);
	await task(() => detectBillingProblems(now), 0, "Looking for billing problems failed; it runs again next time.");
	await task(() => queueDailySummary(now), false, "Queueing the daily billing summary failed; it retries.");
	await task(() => queueExpiryReminders(now), 0, "Queueing pass reminders failed; they retry on the next run.");
	const sentNotifications = await task(
		() => sendBillingNotifications(now),
		0,
		"Sending billing emails failed; they retry on the next run.",
	);
	return { checkedPayments, checkedRefunds, sentReceipts, releasedReservations, sentNotifications };
}
