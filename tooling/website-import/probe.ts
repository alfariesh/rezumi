/**
 * Tries a website import by hand (dev only): reads a site exactly as the app does (`readSiteForImport`) on the server's
 * own AI (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` in .env.local), and prints how long each step took, how many pages it
 * read, the works it found and what the AI used. Nothing is saved and no credits are taken.
 *
 *   pnpm website:probe dewi.design                       prints the most it can cost, runs nothing
 *   pnpm website:probe dewi.design --yes                 runs it (paid: the server's AI key is charged)
 *   pnpm website:probe dewi.design --yes --out drafts.json
 *
 * Browser Run takes over for pages drawn by JavaScript when CLOUDFLARE_BROWSER_TOKEN and CLOUDFLARE_ACCOUNT_ID are set.
 */
import type { LanguageModelMiddleware } from "ai";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { wrapLanguageModel } from "ai";
import { getModel } from "@rezumi/api/features/ai/service";
import { readSiteForImport } from "@rezumi/api/features/profile/website-import-site";
import { env } from "@rezumi/env/server";

const { values: options, positionals } = parseArgs({
	allowPositionals: true,
	options: { yes: { type: "boolean", default: false }, out: { type: "string" } },
});

const [address] = positionals;
if (!address) throw new Error("Pass the site's address: pnpm website:probe yourname.com --yes");
if (!env.AI_PROVIDER || !env.AI_MODEL) throw new Error("Set AI_PROVIDER, AI_MODEL and AI_API_KEY in .env.local.");

const url = /^https?:\/\//i.test(address) ? address.replace(/^http:/i, "https:") : `https://${address}`;
const input = env.AI_COST_INPUT_USD_PER_MTOK;
const output = env.AI_COST_OUTPUT_USD_PER_MTOK;
// Three calls, at most 120,000 characters each (about 30,000 tokens) and 32,768 tokens out between them.
const ceiling = input !== undefined && output !== undefined ? (90_000 * input + 32_768 * output) / 1_000_000 : null;
console.log(
	`One import on ${env.AI_PROVIDER}/${env.AI_MODEL}: three AI calls${ceiling === null ? "" : `, at most about $${ceiling.toFixed(3)}`}.`,
);
if (!options.yes) {
	console.log("Nothing called. Add --yes to run it.");
	process.exit(0);
}

const tally = { calls: 0, inputTokens: 0, outputTokens: 0 };
const count = (value: unknown) =>
	typeof value === "number" ? value : ((value as { total?: number } | undefined)?.total ?? 0);
const meter: LanguageModelMiddleware = {
	specificationVersion: "v4",
	wrapGenerate: async ({ doGenerate }) => {
		const result = await doGenerate();
		tally.calls++;
		tally.inputTokens += count(result.usage.inputTokens);
		tally.outputTokens += count(result.usage.outputTokens);
		return result;
	},
};
const model = wrapLanguageModel({
	model: getModel({
		provider: env.AI_PROVIDER,
		model: env.AI_MODEL,
		apiKey: env.AI_API_KEY ?? "",
		...(env.AI_BASE_URL ? { baseURL: env.AI_BASE_URL } : {}),
		serverAi: true,
	}),
	middleware: meter,
});

const started = Date.now();
let last = started;
const lap = () => {
	const now = Date.now();
	const ms = now - last;
	last = now;
	return `${(ms / 1000).toFixed(1)}s`;
};

const stats = { pagesRead: 0 };
const site = readSiteForImport({ userId: "website-probe", address: url, model, stats });
let step = await site.next();
while (!step.done) {
	const event = step.value;
	if (event.type === "reading") console.log("Reading the home page…");
	if (event.type === "found")
		console.log(`  home page, sitemap, Profile and page choice: ${lap()}; ${event.pages} work pages`);
	if (event.type === "page" && event.done === event.total) console.log(`  work pages read: ${lap()}`);
	if (event.type === "extracting") console.log("Turning pages into works…");
	step = await site.next();
}
const result = step.value;
console.log(`  works: ${lap()}`);

const total = (Date.now() - started) / 1000;
const cost =
	input !== undefined && output !== undefined ? (tally.inputTokens * input + tally.outputTokens * output) / 1e6 : null;
console.log(`
${result.homeUrl}
Total ${total.toFixed(1)}s · ${stats.pagesRead} pages read · ${result.works.length} works · notes: ${result.notes.join(", ") || "none"}
AI: ${tally.calls} calls, ${tally.inputTokens} tokens in, ${tally.outputTokens} out${cost === null ? "" : ` ≈ $${cost.toFixed(4)}`}
Profile: ${result.profile.data.basics.name || "(no name)"} — ${result.profile.data.basics.headline || "(no headline)"}; ${result.profile.data.sections.experience.length} jobs, ${result.profile.data.sections.projects.length} projects
`);
for (const work of result.works)
	console.log(
		`- ${work.title} (${work.date || "no date"}) · ${work.cover ? "cover" : "no cover"} + ${work.gallery.length} pictures · ${work.metrics.length} metrics · ${work.embeds.length} embeds${work.primaryLink ? ` · ${new URL(work.primaryLink.url).hostname}` : ""}\n  ${work.summary}\n  ${work.sourceUrl}`,
	);
if (options.out) {
	await writeFile(options.out, JSON.stringify(result, null, 2));
	console.log(`\nSaved to ${options.out}`);
}
process.exit(0);
