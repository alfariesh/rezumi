import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { createServer } from "node:http";

/**
 * A stand-in for treg (https://treg.to) for the browser tests: the server sends job searches here through
 * `TREG_BASE_URL`, so no test ever calls treg or pays for a listing. Hirebase answers twelve made-up listings for a
 * title at fictional companies (none for a title containing "nothing"); JobsPipe answers none. Each listing's id comes
 * from the title and place, so one search always answers the same listings and different searches never share one. A job
 * alert's check (`ingested_after`) answers four newer listings of its own, posted today; JobsPipe's new-jobs feed answers
 * none. The daily upkeep's feeds (Hirebase's closed jobs, JobsPipe's lookups by id) answer nothing closed. Product guide
 * screenshots use it too (`pnpm dev` with `TREG_BASE_URL` pointing here).
 *
 * Run by Playwright's `webServer` (playwright.config.ts): `node tests/e2e/fixtures/treg-stub.ts`.
 */

export const TREG_STUB_PORT = Number.parseInt(process.env.TREG_STUB_PORT ?? "3999", 10);

const COMPANIES = [
	{ name: "Northstar Labs", industry: "Software", size: "201-500" },
	{ name: "Brightpath", industry: "Financial Services", size: "51-200" },
	{ name: "Canopy Systems", industry: "Climate Technology", size: "501-1000" },
	{ name: "Kestrel Pay", industry: "Payments", size: "1001-5000" },
];

/** Twelve listings for a title: the title itself first, then variations of it. */
const TITLES = [
	(title: string) => title,
	(title: string) => `Senior ${title}`,
	(title: string) => `${title}, Payments`,
	(title: string) => `Lead ${title}`,
	(title: string) => `${title} II`,
	(title: string) => `${title}, Growth`,
	(title: string) => `Associate ${title}`,
	(title: string) => `${title}, Platform`,
	(title: string) => `Principal ${title}`,
	(title: string) => `${title} (Contract)`,
	(title: string) => `${title}, Marketplace`,
	(title: string) => `Staff ${title}`,
];

/** Skills a listing names, four to six of them, for the match chip. */
const SKILLS = [
	"Roadmapping",
	"SQL",
	"Stakeholder management",
	"Customer research",
	"A/B testing",
	"Python",
	"Figma",
	"Payments",
];

type Place = { city?: string; country?: string };

function hirebaseJobs(title: string, place: Place, ingestedAfter?: string) {
	if (/nothing/i.test(title)) return [];
	const country = place.country ?? "United Kingdom";
	const city = place.city ?? (country === "Germany" ? "Berlin" : "London");
	const titles = ingestedAfter ? TITLES.slice(1, 5) : TITLES;
	return titles.map((name, index) => {
		const seed = ingestedAfter ? `new:${title}:${city}:${country}:${index}` : `${title}:${city}:${country}:${index}`;
		const id = createHash("sha256").update(seed).digest("hex").slice(0, 24);
		const company = COMPANIES[index % COMPANIES.length] ?? COMPANIES[0];
		const currency = country === "Germany" ? "EUR" : country === "United States" ? "USD" : "GBP";
		return {
			_id: id,
			job_title: name(title),
			description: `<p>Join ${company?.name} as ${name(title)}.</p><h2>What you will do</h2><ul><li>Own the reporting</li><li>Work with product and design</li></ul>`,
			company_name: company?.name,
			company_logo: null,
			company_data: { industries: [company?.industry], size_range: company?.size },
			application_link: `https://careers.example.com/${id}`,
			job_board: index % 3 === 2 ? "linkedin" : index % 2 === 0 ? "greenhouse" : "lever",
			locations: [{ city, country }],
			location_raw: `${city}, ${country}`,
			location_type: index % 3 === 1 ? "Remote" : index % 3 === 0 ? "Hybrid" : "In-Person",
			experience_level: index % 2 === 0 ? "Mid Level" : "Senior Level",
			salary_range:
				index % 3 === 2 ? null : { min: 60_000 + index * 2_000, max: 78_000 + index * 2_000, currency, period: "year" },
			visa_sponsored: index % 4 === 0,
			requirements_summary: "3+ years in a similar role, clear writing and comfort with data.",
			skills: Array.from({ length: 4 + (index % 3) }, (_, offset) => SKILLS[(index + offset) % SKILLS.length]),
			date_posted: new Date(Date.now() - (ingestedAfter ? 0 : index + 1) * 86_400_000).toISOString(),
		};
	});
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
	} catch {
		return {};
	}
}

function send(response: ServerResponse, body: unknown) {
	response.writeHead(200, { "content-type": "application/json", "x-treg-cost-micro": "0", "x-treg-call-id": "stub" });
	response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? "/", "http://localhost");
	if (url.pathname === "/health") return send(response, { ok: true });
	if (request.headers["x-treg-token"] === undefined) {
		response.writeHead(401).end();
		return;
	}
	// The team's account, for the admin cost dashboard: a fictional balance and ledger.
	if (url.pathname === "/orgs") return send(response, [{ org_id: 1, slug: "stub-team", active: true, demo: false }]);
	if (url.pathname === "/orgs/1/balance") return send(response, { org_id: 1, balance_micro: 4_215_300 });
	if (url.pathname === "/orgs/1/usage/by-tag")
		return send(response, {
			key: "feature",
			days: Number(url.searchParams.get("days") ?? 30),
			rows: [
				{ value: "jobs-search", charged_micro: 412_500, calls: 141 },
				{ value: "jobs-discovery", charged_micro: 96_000, calls: 38 },
				{ value: "web-search", charged_micro: 27_000, calls: 27 },
				{ value: "jobs-count", charged_micro: 0, calls: 6 },
			],
			attributed_micro: 535_500,
			unattributed_micro: 1_500,
			total_micro: 537_000,
		});
	const tool = decodeURIComponent(url.pathname.replace(/^\/call\//, ""));
	const body = await readBody(request);
	if (tool === "hirebase.jobs.search") {
		const titles = Array.isArray(body.job_titles) ? body.job_titles.map(String) : [];
		const places = Array.isArray(body.geo_locations) ? (body.geo_locations as Place[]) : [];
		const ingestedAfter = typeof body.ingested_after === "string" ? body.ingested_after : undefined;
		const jobs = hirebaseJobs(titles[0] ?? "Job", places[0] ?? {}, ingestedAfter);
		return send(response, { jobs, total_count: jobs.length, page: 1, total_pages: 1 });
	}
	if (tool === "jobspipe.jobs.search" || tool === "jobspipe.jobs.new")
		return send(response, { data: [], metadata: { next_delta_cursor: "stub-delta" } });
	if (tool === "hirebase.jobs.expired")
		return send(response, { jobs: [], total_count: 0, page: 1, limit: 1000, total_pages: 1 });
	if (tool === "jobspipe.jobs.detail") return send(response, { data: [], metadata: {} });
	response.writeHead(404).end();
});

server.listen(TREG_STUB_PORT, "127.0.0.1");
