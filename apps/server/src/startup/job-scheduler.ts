import { runBillingJobs } from "@rezumi/api/features/billing/jobs";
import { runCareerJobs } from "@rezumi/api/features/career/jobs";
import { runPortfolioJobs } from "@rezumi/api/features/portfolio/jobs";

/**
 * The long-running Node server owns ticks; PostgreSQL coordinates work across server instances. Each tick runs billing
 * first (its work is short), then career, then portfolio file cleanup, and a failure in one never skips the others.
 */
export function startJobScheduler() {
	let stopped = false;
	let inFlight: Promise<void> | null = null;

	const runJobs = async () => {
		await runBillingJobs().catch(() => {
			console.error("[billing] Scheduled work failed. It retries on a later tick.");
		});
		await runCareerJobs().catch(() => {
			console.error("[career] Scheduled work failed. Eligible jobs will retry on a later tick.");
		});
		await runPortfolioJobs().catch(() => {
			console.error("[portfolio] Scheduled work failed. It retries on a later tick.");
		});
	};

	const tick = () => {
		if (stopped || inFlight) return;
		inFlight = runJobs().finally(() => {
			inFlight = null;
		});
	};

	const interval = setInterval(tick, 60_000);
	interval.unref();
	tick();

	return {
		stop: async () => {
			stopped = true;
			clearInterval(interval);
			await inFlight;
		},
	};
}
