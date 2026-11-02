import { releaseStaleReservations } from "./credits";

/**
 * Billing's scheduled work, run every minute by the Workers cron and the Node scheduler before career jobs. Cron
 * triggers can overlap or repeat, so every task claims its rows and is safe to run twice; each task's failure stays
 * its own.
 */
export async function runBillingJobs(now = new Date()) {
	const releasedReservations = await releaseStaleReservations(now).catch(() => {
		console.error("[billing] Releasing stale credit reservations failed; they retry on the next run.");
		return 0;
	});
	return { releasedReservations };
}
