import { detectBillingProblems, queueDailySummary } from "./alerts";
import { releaseStaleReservations } from "./credits";
import { queueExpiryReminders, sendBillingNotifications } from "./notifications";
import { grantPassCredits } from "./passes";
import {
	endDeletedAccountSubscriptions,
	grantYearlyCredits,
	reconcilePayments,
	reconcileSubscriptions,
} from "./reconcile";
import { reconcileRefunds } from "./refunds";
import { reconcileQrisPayments } from "./sumopod/reconcile";

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
 * its own. Payments first (a customer may be waiting for one: card checkouts, then QRIS payments), then subscriptions
 * Dodo's news didn't reach, refunds still waiting, the months of Pro AI credits (yearly subscriptions, and passes that
 * started or reached a new month), and subscriptions of deleted accounts. Then the emails: the owner's alerts and daily
 * summary, QRIS receipts, and reminders that a pass or granted access ends soon.
 */
export async function runBillingJobs(now = new Date()) {
	const checkedPayments = await task(
		() => reconcilePayments(now),
		0,
		"Reconciling payments failed; they are checked again on the next run.",
	);
	const checkedQrisPayments = await task(
		() => reconcileQrisPayments(now),
		0,
		"Reconciling QRIS payments failed; they are checked again on the next run.",
	);
	const checkedSubscriptions = await task(
		() => reconcileSubscriptions(now),
		0,
		"Checking overdue subscriptions failed; they are checked again on the next run.",
	);
	const checkedRefunds = await task(
		() => reconcileRefunds(now),
		0,
		"Checking waiting refunds failed; they are checked again on the next run.",
	);
	const grantedCredits = await task(
		() => grantYearlyCredits(now),
		0,
		"Granting yearly Pro AI credits failed; they are granted on the next run.",
	);
	const grantedPassCredits = await task(
		() => grantPassCredits(now),
		0,
		"Granting Pro AI pass credits failed; they are granted on the next run.",
	);
	const endedSubscriptions = await task(
		() => endDeletedAccountSubscriptions(now),
		0,
		"Ending deleted accounts' subscriptions failed; they are tried again on the next run.",
	);
	const releasedReservations = await task(
		() => releaseStaleReservations(now),
		0,
		"Releasing stale credit reservations failed; they retry on the next run.",
	);
	await task(() => detectBillingProblems(now), 0, "Looking for billing problems failed; it runs again next time.");
	await task(() => queueDailySummary(now), false, "Queueing the daily billing summary failed; it retries.");
	await task(() => queueExpiryReminders(now), 0, "Queueing access reminders failed; they retry on the next run.");
	const sentNotifications = await task(
		() => sendBillingNotifications(now),
		0,
		"Sending billing emails failed; they retry on the next run.",
	);
	return {
		checkedPayments,
		checkedQrisPayments,
		checkedSubscriptions,
		checkedRefunds,
		grantedCredits,
		grantedPassCredits,
		endedSubscriptions,
		releasedReservations,
		sentNotifications,
	};
}
