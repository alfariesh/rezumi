import { env } from "@rezumi/env/server";
import { publicResumeUrl } from "@rezumi/resume/sharing";
import { templateLineup } from "@rezumi/schema/templates";
import { getLocaleAlternates } from "@rezumi/utils/locale";

const DOCS_URL = "https://docs.rezumi.app";
export const CONTEXT7_ASK_URL = "https://context7.com/api/v2/ask?siteKey=ask_b3fd9335a63f1b21b1a814ac";
export const CONTEXT7_ASK_DESCRIPTION = `This site has a search endpoint: ${CONTEXT7_ASK_URL}&query=<URL-encoded question>. It returns documentation that answers the question, with a source link for each part. No API key is needed. If nothing matches, it says so.`;

function appUrl() {
	return env.APP_URL.replace(/\/+$/, "");
}

function textResponse(body: string) {
	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=UTF-8" },
	});
}

export function handleRobots() {
	const baseUrl = appUrl();
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/rpc",
		"Disallow: /api/auth",
		"Disallow: /mcp",
		"Disallow: /.well-known",
		// A resume's PDF duplicates its web page, and each crawl would render one.
		"Disallow: /api/resumes/",
		// Discovery documents meant for agents and API directories.
		"Allow: /.well-known/integrations.json",
		"Allow: /.well-known/api-catalog",
		"Allow: /.well-known/mcp/server-card.json",
		"Allow: /.well-known/agent-skills/",
		"",
		`Sitemap: ${baseUrl}/sitemap.xml`,
		`Sitemap: ${DOCS_URL}/sitemap.xml`,
		"",
	].join("\n");

	return textResponse(body);
}

// The marketing pages; resumes whose owners opted in are listed on the sitemap's other pages.
const sitemapPaths = ["/", "/ats-checker", "/resume-templates"];

const escapeXml = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** An XML document: the prologue, then `lines` inside the `<root …>` element. */
const xmlResponse = (root: string, lines: string[]) =>
	new Response(
		['<?xml version="1.0" encoding="UTF-8"?>', `<${root}>`, ...lines, `</${root.split(" ", 1)[0]}>`, ""].join("\n"),
		{
			headers: { "Content-Type": "application/xml; charset=UTF-8", "Cache-Control": "public, max-age=3600" },
		},
	);

/** The sitemap index: the marketing pages, then resumes and portfolios listed in search engines, 50,000 to a page. */
export async function handleSitemap() {
	const baseUrl = appUrl();
	const [{ countIndexableResumes, SITEMAP_PAGE_SIZE }, { countIndexablePortfolios, PORTFOLIO_SITEMAP_PAGE_SIZE }] =
		await Promise.all([
			import("@rezumi/api/features/resume/web-page"),
			import("@rezumi/api/features/portfolio/public"),
		]);
	const pages = Math.ceil((await countIndexableResumes().catch(() => 0)) / SITEMAP_PAGE_SIZE);
	const portfolioPages = Math.ceil((await countIndexablePortfolios().catch(() => 0)) / PORTFOLIO_SITEMAP_PAGE_SIZE);
	const sitemaps = [
		`${baseUrl}/sitemaps/pages.xml`,
		...Array.from({ length: pages }, (_, page) => `${baseUrl}/sitemaps/resumes-${page + 1}.xml`),
		...Array.from({ length: portfolioPages }, (_, page) => `${baseUrl}/sitemaps/portfolios-${page + 1}.xml`),
	];
	return xmlResponse(
		'sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		sitemaps.map((loc) => `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`),
	);
}

/** The marketing pages in every language, then the docs pages (`docsPaths`), which are written in English only. */
export function handlePagesSitemap(docsPaths: string[] = []) {
	const baseUrl = appUrl();
	const urls = sitemapPaths.flatMap((path) => {
		const pageUrl = `${baseUrl}${path}`;
		const languages = getLocaleAlternates(pageUrl);
		const alternates = languages.map(
			({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
		);
		// x-default shares the English URL; each canonical URL appears once with the same alternate set.
		return [...new Set(languages.map(({ href }) => href))].map((href) =>
			["  <url>", `    <loc>${escapeXml(href)}</loc>`, ...alternates, "  </url>"].join("\n"),
		);
	});
	const docs = docsPaths.map((path) => `  <url><loc>${escapeXml(`${baseUrl}${path}`)}</loc></url>`);
	return xmlResponse(
		'urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"',
		[...urls, ...docs],
	);
}

/** `/sitemaps/resumes-<n>.xml`: one page of resumes listed in search engines. */
export async function handleResumesSitemap(page: number) {
	const baseUrl = appUrl();
	const { listIndexableResumes } = await import("@rezumi/api/features/resume/web-page");
	const resumes = Number.isInteger(page) && page >= 1 ? await listIndexableResumes(page - 1) : [];
	if (resumes.length === 0) return new Response("Not Found", { status: 404 });
	return xmlResponse(
		'urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		resumes.map(
			(resume) =>
				// A primary resume's address is /<username>, as its page's canonical says.
				`  <url><loc>${escapeXml(publicResumeUrl(baseUrl, resume))}</loc><lastmod>${resume.updatedAt.toISOString()}</lastmod></url>`,
		),
	);
}

/** `/sitemaps/portfolios-<n>.xml`: one page of portfolios listed in search engines, each at `/<username>`. */
export async function handlePortfoliosSitemap(page: number) {
	const baseUrl = appUrl();
	const { listIndexablePortfolios } = await import("@rezumi/api/features/portfolio/public");
	const portfolios = Number.isInteger(page) && page >= 1 ? await listIndexablePortfolios(page - 1) : [];
	if (portfolios.length === 0) return new Response("Not Found", { status: 404 });
	return xmlResponse(
		'urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		portfolios.map(
			(portfolio) =>
				`  <url><loc>${escapeXml(`${baseUrl}/${encodeURIComponent(portfolio.username)}`)}</loc><lastmod>${portfolio.updatedAt.toISOString()}</lastmod></url>`,
		),
	);
}

export function handleLlms() {
	const baseUrl = appUrl();
	const body = [
		"# Rezumi",
		"",
		`> Rezumi is a resume builder and job search workspace. Write a resume in an editor beside a live page, pick one of ${templateLineup.length} templates, check that applicant tracking systems can read it, tailor it to a job posting, and share it at a public link or download it. Start on the free plan; paid plans are monthly or yearly subscriptions you can cancel any time.`,
		"",
		"## Search",
		"",
		CONTEXT7_ASK_DESCRIPTION,
		"",
		"## Product",
		"",
		`- [Homepage](${baseUrl}/): what Rezumi does, with answers to common questions.`,
		`- [Resume templates](${baseUrl}/resume-templates): browse all ${templateLineup.length} templates, compare layouts and download sample PDFs.`,
		`- [ATS checker](${baseUrl}/ats-checker): a free tool that shows the text applicant tracking systems extract from a resume PDF and what to fix. It runs in the browser; the file is never uploaded.`,
		`- [Get started](${baseUrl}/dashboard): create an account and a first resume.`,
		"",
		"## Facts",
		...(env.BILLING_MODE === "on"
			? []
			: ["- Plus, Pro AI and Rezumi AI trial credits are coming soon. Paid plan limits are not active yet."]),
		"",
		"- Plans (US dollars, or Rupiah for visitors from Indonesia; before tax, which the checkout adds): Free ($0: 3 active resumes and 3 cover letters, 8 templates, every icon style, PDF without a watermark, ATS check, job tracker, 5 AI credits to try); Plus ($4.99 a month or $39 a year: 50 resumes and letters, every template, tool logos in skills, Word and ODT, custom styles, MCP and API); Pro AI ($9.99 a month or $79 a year: everything in Plus and 100 AI credits every month, no API key needed). Paid plans are subscriptions you can cancel any time; access lasts until the paid period ends. A first Plus subscription starts with a 7-day free trial.",
		"- Export: PDF, Markdown and JSON on every plan; Word (DOCX) and ODT with Plus and Pro AI.",
		"- Import: PDF, LinkedIn data export, JSON Resume, Rezumi JSON; Word files with an AI provider.",
		"- Sharing: private by default; a public link or a password-protected link, changeable at any time.",
		"- AI: credits included with Pro AI, or the user's own API key on any plan (OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama and others). Nothing is sent to an AI service without one of them.",
		"- Also includes: cover letters, a job application tracker, version history, passkeys and two-factor authentication.",
		"- Languages: the interface is available in more than 50 languages.",
		"",
		"## Documentation",
		"",
		`- [Documentation](${DOCS_URL}): guides for using Rezumi.`,
		`- [Documentation llms.txt](${DOCS_URL}/llms.txt)`,
		`- [API reference](${DOCS_URL}/api-reference)`,
		`- [OpenAPI specification](${baseUrl}/openapi.json)`,
		`- [Resume JSON schema](${baseUrl}/schema.json)`,
		`- [MCP server guide](${DOCS_URL}/guides/using-the-mcp-server): connect any MCP client to ${baseUrl}/mcp with OAuth or an API key.`,
		`- [Agent skills](${DOCS_URL}/guides/using-agent-skills): eight job-search skills, also listed at ${baseUrl}/.well-known/agent-skills/index.json.`,
		`- [Integrations](${baseUrl}/.well-known/integrations.json): every API and MCP surface with its authentication.`,
		"",
	].join("\n");

	return textResponse(body);
}
