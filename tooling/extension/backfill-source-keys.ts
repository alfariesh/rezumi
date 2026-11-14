/**
 * One-off: fills `application.source_key` for applications saved before the column existed (browser extension plan,
 * .agents/docs/plans/plugin-browser/02-teknis.md §6.2). The key comes from `jobKey()` in @rezumi/job-sites, the same
 * function the API uses on create, update and import, so SQL never copies its rules.
 *
 *   DATABASE_URL=… pnpm --filter @rezumi/tooling extension:backfill-keys --dry-run
 *   DATABASE_URL=… pnpm --filter @rezumi/tooling extension:backfill-keys
 *
 * Safe to run again: it only touches rows with an address and no key, walks them by id, and never changes a key the
 * API already set. Prints counts only, never addresses. Run in production with the owner's permission (Phase 07),
 * after the migration that adds the column.
 */
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { jobKey } from "@rezumi/job-sites/sites";

type Query = <Row>(text: string, values?: unknown[]) => Promise<{ rows: Row[] }>;

export type BackfillResult = { scanned: number; keyed: number; withoutKey: number };

export async function backfillSourceKeys(
	query: Query,
	{ batchSize = 500, dryRun = false }: { batchSize?: number; dryRun?: boolean } = {},
): Promise<BackfillResult> {
	const result: BackfillResult = { scanned: 0, keyed: 0, withoutKey: 0 };
	let after = "";
	for (;;) {
		const { rows } = await query<{ id: string; source_url: string }>(
			`select id, source_url from application
			 where source_url is not null and source_key is null and id > $1
			 order by id limit $2`,
			[after, batchSize],
		);
		if (rows.length === 0) return result;
		after = rows.at(-1)?.id ?? after;
		result.scanned += rows.length;

		const keyed = rows.flatMap(({ id, source_url }) => {
			const key = jobKey(source_url);
			return key ? [{ id, key }] : [];
		});
		result.keyed += keyed.length;
		result.withoutKey += rows.length - keyed.length;
		if (dryRun || keyed.length === 0) continue;
		// `source_key is null` again: a save through the API between the read and this write keeps its own key.
		await query(
			`update application as a set source_key = k.key
			 from unnest($1::text[], $2::text[]) as k(id, key)
			 where a.id = k.id and a.source_key is null`,
			[keyed.map((row) => row.id), keyed.map((row) => row.key)],
		);
	}
}

async function main() {
	const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
	if (!connectionString) throw new Error("Set DATABASE_URL (or DATABASE_MIGRATION_URL) first.");
	const dryRun = process.argv.includes("--dry-run");
	const pool = new Pool({ connectionString, max: 1 });
	try {
		const result = await backfillSourceKeys(
			async <Row>(text: string, values?: unknown[]) => ({ rows: (await pool.query(text, values)).rows as Row[] }),
			{ dryRun },
		);
		console.info(
			`${dryRun ? "[dry run] " : ""}Scanned ${result.scanned} saved addresses: ${result.keyed} ${dryRun ? "would get" : "got"} a posting key, ${result.withoutKey} have none (a board page with no posting open, or not a web address).`,
		);
	} finally {
		await pool.end();
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
