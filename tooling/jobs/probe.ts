/**
 * Tries the job providers by hand (dev only): searches Hirebase and/or JobsPipe through treg, saves what comes back
 * to the local database and prints a summary with the cost.
 *
 *   pnpm jobs:probe "digital marketing" ID --count            free: only how many jobs match
 *   pnpm jobs:probe "software engineer" US --limit 3 --yes     paid: up to 3 jobs per provider
 *   pnpm jobs:probe "data analyst" --remote --provider hirebase --yes
 *
 *   pnpm jobs:probe "software engineer" US --service --user <local user id> --yes
 *     runs the real job search service twice for that account (provider, then the shared cache) and prints the time,
 *     whether it came from the cache and what treg charged; the second run should be free.
 *
 * The second argument is an ISO country code; leave it out to search everywhere. `--yes` is required for a paid call
 * (the script prints the most it can cost first). Saving refuses any database that isn't on this machine.
 */
import type { JobProvider } from "@rezumi/schema/jobs/listing";
import { parseArgs } from "node:util";
import { JOB_SOURCES } from "@rezumi/api/features/jobs/providers";
import { createJobSearchService } from "@rezumi/api/features/jobs/service";
import { upsertListings } from "@rezumi/api/features/jobs/store";
import { jobSearchInputSchema } from "@rezumi/schema/jobs/search";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const MAX_LIMIT = 20;

const { values: options, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		provider: { type: "string", default: "both" },
		limit: { type: "string", default: "5" },
		remote: { type: "boolean", default: false },
		days: { type: "string", default: "30" },
		count: { type: "boolean", default: false },
		service: { type: "boolean", default: false },
		user: { type: "string" },
		yes: { type: "boolean", default: false },
	},
});

const [query, country] = positionals;
if (!query) throw new Error('Pass what to search for: pnpm jobs:probe "software engineer" US --count');
if (!process.env.TREG_API_KEY) throw new Error("TREG_API_KEY is not set in .env.local.");

const providers: JobProvider[] =
	options.provider === "both" ? ["hirebase", "jobspipe"] : [options.provider as JobProvider];
for (const provider of providers) {
	if (!(provider in JOB_SOURCES)) throw new Error(`Unknown provider "${provider}": use hirebase, jobspipe or both.`);
}
const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(options.limit, 10) || 5));
const input = jobSearchInputSchema.parse({
	query,
	...(country ? { country: country.toUpperCase() } : {}),
	remote: options.remote ? "only" : "any",
	postedWithinDays: Number(options.days),
});

if (options.count) {
	for (const provider of providers) {
		const total = await JOB_SOURCES[provider].count(input);
		console.log(`${provider}: ${total ?? "?"} jobs match (free count)`);
	}
	process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
	throw new Error("Refusing to save: DATABASE_URL must point at a database on this machine.");
}
// The service asks Hirebase for a page of 20 and JobsPipe for up to 20 more when Hirebase finds fewer than 10.
const ceiling = options.service
	? 20 * JOB_SOURCES.hirebase.pricePerListingUsd + 20 * JOB_SOURCES.jobspipe.pricePerListingUsd
	: providers.reduce((sum, provider) => sum + limit * JOB_SOURCES[provider].pricePerListingUsd, 0);
console.log(
	options.service
		? `One search page, usually about $${(20 * JOB_SOURCES.hirebase.pricePerListingUsd).toFixed(4)}; at most $${ceiling.toFixed(4)}.`
		: `At most ${limit} jobs per provider, about $${ceiling.toFixed(4)} in all.`,
);
if (!options.yes) {
	console.log("Nothing called. Add --yes to run the paid search.");
	process.exit(0);
}

if (options.service) {
	if (!options.user) throw new Error("Pass the local account to search as: --user <user id>.");
	// Counts what each provider call cost, so the second (cached) run can show it was free.
	let costMicro = 0;
	const counted = Object.fromEntries(
		Object.entries(JOB_SOURCES).map(([name, source]) => [
			name,
			{
				...source,
				search: async (...args: Parameters<typeof source.search>) => {
					const result = await source.search(...args);
					costMicro += result.costMicro;
					return result;
				},
			},
		]),
	) as typeof JOB_SOURCES;
	const jobs = createJobSearchService({ sources: counted });
	const { cursor: _cursor, ...request } = input;
	for (const run of ["first", "second"]) {
		const before = costMicro;
		const started = performance.now();
		const result = await jobs.search(options.user, request);
		const ms = Math.round(performance.now() - started);
		console.log(
			`\n${run} run: ${result.listings.length} listings in ${ms} ms, fromCache ${result.fromCache}, ` +
				`stale ${result.stale}, budgetLimited ${result.budgetLimited}, cost $${((costMicro - before) / 1e6).toFixed(4)}, ` +
				`quota ${result.quota.used}/${result.quota.max}, more pages: ${result.cursor ? "yes" : "no"}`,
		);
		if (run === "first")
			for (const listing of result.listings.slice(0, 5))
				console.log(`- ${listing.title} · ${listing.company.name} · ${listing.location.text || "—"}`);
	}
	console.log(`\nSpent on treg: $${(costMicro / 1e6).toFixed(4)}`);
	process.exit(0);
}

let spentMicro = 0;
for (const provider of providers) {
	const result = await JOB_SOURCES[provider].search(input, { limit, kind: "search" });
	spentMicro += result.costMicro;
	const saved = await upsertListings(result.listings);
	console.log(
		`\n${provider}: ${saved.length} saved (${result.dropped} dropped), ${result.total ?? "?"} match, ` +
			`$${(result.costMicro / 1e6).toFixed(4)}, ${result.ms} ms, next page: ${result.cursor ? "yes" : "no"}`,
	);
	for (const listing of saved) {
		const pay = listing.salary
			? ` · ${listing.salary.min ?? "?"}–${listing.salary.max ?? "?"} ${listing.salary.currency}/${listing.salary.period}`
			: "";
		console.log(`- ${listing.title} · ${listing.company.name} · ${listing.location.text || "—"}${pay}`);
		console.log(`  ${listing.postingUrl}`);
	}
}
console.log(`\nSpent on treg: $${(spentMicro / 1e6).toFixed(4)}`);
process.exit(0);
