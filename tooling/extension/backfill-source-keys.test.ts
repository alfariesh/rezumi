import { describe, expect, it, vi } from "vite-plus/test";
import { backfillSourceKeys } from "./backfill-source-keys";

/** An application table in memory, answering the script's two statements. */
function table(rows: { id: string; source_url: string | null; source_key: string | null }[]) {
	const query = vi.fn(async (text: string, values: unknown[] = []) => {
		if (text.trimStart().startsWith("select")) {
			const [after, limit] = values as [string, number];
			return {
				rows: rows
					.filter((row) => row.source_url !== null && row.source_key === null && row.id > after)
					.toSorted((a, b) => a.id.localeCompare(b.id))
					.slice(0, limit),
			};
		}
		const [ids, keys] = values as [string[], string[]];
		ids.forEach((id, index) => {
			const row = rows.find((candidate) => candidate.id === id);
			if (row && row.source_key === null) row.source_key = keys[index] ?? null;
		});
		return { rows: [] };
	});
	return { rows, query: query as unknown as Parameters<typeof backfillSourceKeys>[0], calls: query };
}

const rows = () => [
	{ id: "a1", source_url: "https://www.linkedin.com/jobs/view/4012345678/?trk=x", source_key: null },
	{ id: "a2", source_url: "https://careers.acme.example/jobs?gh_jid=42&utm_source=x", source_key: null },
	{ id: "a3", source_url: "https://www.linkedin.com/jobs/search/", source_key: null },
	{ id: "a4", source_url: "https://id.indeed.com/viewjob?jk=0a1b2c3d4e5f6a7b", source_key: "indeed:kept" },
	{ id: "a5", source_url: null, source_key: null },
];

describe("backfillSourceKeys", () => {
	it("keys every saved address with jobKey, in batches, and leaves set keys and pages without a posting alone", async () => {
		const t = table(rows());
		expect(await backfillSourceKeys(t.query, { batchSize: 2 })).toEqual({ scanned: 3, keyed: 2, withoutKey: 1 });
		expect(t.rows.map((row) => row.source_key)).toEqual([
			"linkedin:4012345678",
			"url:careers.acme.example/jobs?gh_jid=42",
			null,
			"indeed:kept",
			null,
		]);
		// Running it again finds only the page without a posting, and changes nothing.
		expect(await backfillSourceKeys(t.query)).toEqual({ scanned: 1, keyed: 0, withoutKey: 1 });
	});

	it("writes nothing in a dry run", async () => {
		const t = table(rows());
		expect(await backfillSourceKeys(t.query, { dryRun: true })).toEqual({ scanned: 3, keyed: 2, withoutKey: 1 });
		expect(t.calls.mock.calls.every(([text]) => text.trimStart().startsWith("select"))).toBe(true);
		expect(t.rows.filter((row) => row.source_key !== null)).toHaveLength(1);
	});
});
