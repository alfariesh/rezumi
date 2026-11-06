import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
	env: { APP_URL: "https://rezumi.app" },
	serveStatic: vi.fn(() => vi.fn()),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(() => true),
}));

vi.mock("node:fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
}));

vi.mock("@hono/node-server/serve-static", () => ({
	serveStatic: mocks.serveStatic,
}));

vi.mock("@rezumi/env/server", () => ({
	env: mocks.env,
}));

const { handleWebApp, isProfilePath, isPublicResumePath, listDocsPaths } = await import("./web");

const searchLink =
	'<https://context7.com/api/v2/ask?siteKey=ask_b3fd9335a63f1b21b1a814ac>; rel="search"; type="text/plain"; title="Search rezumi.app"';

describe("web app fallback classification", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fs.readFile).mockResolvedValue("<html>app</html>");
	});

	it.each(["/", "/?locale=de-DE", "/ats-checker", "/resume-templates", "/dashboard", "/index.html"])(
		"advertises Context7 Ask in server-rendered %s and its HEAD response",
		async (path) => {
			vi.mocked(fs.readFile).mockResolvedValue('<html><head></head><body><div id="app"></div></body></html>');
			const response = await handleWebApp(new Request(`https://rezumi.app${path}`));
			const html = await response.text();
			expect(html).toContain('<meta name="context7-site-verification" content="ask_b3fd9335a63f1b21b1a814ac"></head>');
			expect(html).toContain('<body><blockquote data-context7-ask="true" aria-hidden="true" class="sr-only">');
			expect(html).toContain("<h2>Search</h2><p>Page index: https://rezumi.app/llms.txt.</p>");
			expect(html).toContain(
				"https://context7.com/api/v2/ask?siteKey=ask_b3fd9335a63f1b21b1a814ac&amp;query=&lt;URL-encoded question&gt;",
			);
			expect(html).toContain('</blockquote><div id="app"></div>');
			expect(html).not.toContain("Add .md");
			expect(response.headers.get("Link")).toBe(searchLink);
			const head = await handleWebApp(new Request(`https://rezumi.app${path}`, { method: "HEAD" }));
			expect(head.headers.get("Link")).toBe(searchLink);
			expect(await head.text()).toBe("");
		},
	);

	it("injects canonical metadata and structured data into tracking-parameter root requests only", async () => {
		vi.mocked(fs.readFile).mockResolvedValue(`
			<!doctype html>
			<html>
				<head>
					<title>Rezumi — Resume builder</title>
					<meta
						name="description"
						content="Rezumi is a resume builder that makes it easy to create, update, and share your resume."
					>
				</head>
				<body><div id="app"></div></body>
			</html>
		`);

		const response = await handleWebApp(new Request("http://server.internal/?utm_source=search"));
		const html = await response.text();

		expect(html).toContain('<link rel="canonical" href="https://rezumi.app/">');
		expect(html).toContain('<meta property="og:url" content="https://rezumi.app/">');
		expect(html).toContain('<script type="application/ld+json">');
		expect(html).toContain(
			'<meta property="og:description" content="Rezumi is a resume builder that makes it easy to create, update, and share your resume.">',
		);
		expect(html).toContain('"contactType":"support","email":"hi@rezumi.app"');
		expect(html).not.toContain("utm_source");

		const dashboardResponse = await handleWebApp(new Request("https://example.com/dashboard"));
		expect(await dashboardResponse.text()).not.toContain('rel="canonical"');
	});

	it("serves the homepage prerendered in the requested or saved locale, with hreflang alternates", async () => {
		vi.mocked(fs.readFile).mockImplementation((path) => {
			const locale = String(path).match(/dist-prerender\/home\/(.+)\.html$/)?.[1];
			return Promise.resolve(`<html><head></head><body><div id="app">${locale ?? "shell"}</div></body></html>`);
		});

		const german = await handleWebApp(new Request("https://example.com/?locale=de-DE"));
		const html = await german.text();
		expect(html).toContain('<div id="app">de-DE</div>');
		expect(html).toContain('<link rel="canonical" href="https://rezumi.app/?locale=de-DE">');
		expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://rezumi.app/">');
		expect(german.headers.get("Vary")).toBe("Cookie");

		const saved = new Request("https://example.com/", { headers: { cookie: "theme=dark; locale=ar-SA" } });
		const savedHtml = await (await handleWebApp(saved)).text();
		expect(savedHtml).toContain('<div id="app">ar-SA</div>');
		expect(savedHtml).toContain('<link rel="canonical" href="https://rezumi.app/">');

		// Only known locales name a file, so the parameter can't point anywhere else.
		const unknown = await handleWebApp(new Request("https://example.com/?locale=../../index"));
		expect(await unknown.text()).toContain('<div id="app">en-US</div>');
	});

	describe.each(["ats-checker", "resume-templates"])("the %s page", (path) => {
		const shell = `<html><head><title>Rezumi — Resume builder</title><meta name="description" content="Marketing copy."></head><body></body></html>`;

		it("serves an indexable shell rather than a 404", async () => {
			vi.mocked(fs.readFile).mockResolvedValue(shell);

			const response = await handleWebApp(new Request(`https://example.com/${path}`));

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
			expect(response.headers.get("X-Robots-Tag")).toBeNull();
		});

		it("serves the prerendered page in the requested locale, with its own title on the social cards", async () => {
			vi.mocked(fs.readFile).mockImplementation((path) => {
				const match = String(path).match(/dist-prerender\/(?:ats-checker|resume-templates)\/(.+)\.html$/);
				if (!match) return Promise.resolve(shell);
				return Promise.resolve(
					`<html><head><title>ATS-Prüfung &amp; mehr</title><meta name="description" content="Lesbar?"></head><body><div id="app">${match[1]}</div></body></html>`,
				);
			});

			const html = await (await handleWebApp(new Request(`https://example.com/${path}?locale=de-DE`))).text();

			expect(html).toContain('<div id="app">de-DE</div>');
			expect(html).toContain(`<link rel="canonical" href="https://rezumi.app/${path}?locale=de-DE">`);
			expect(html).toContain('<meta property="og:title" content="ATS-Prüfung &amp; mehr">');
			expect(html).toContain('<meta property="og:locale" content="de_DE">');
		});
	});

	it.each(["/", "/dashboard"])("sets framing and CSP security headers on %s", async (pathname) => {
		const response = await handleWebApp(new Request(`https://example.com${pathname}`));

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
	});

	it("allows exactly the page's own inline scripts, by hash", async () => {
		const response = await handleWebApp(
			new Request("https://example.com/dashboard"),
			async () => '<html><script>boot()</script><script type="module" src="/app.js"></script></html>',
		);
		const scripts = response.headers.get("Content-Security-Policy")?.match(/script-src ([^;]*)/)?.[1];

		expect(scripts).toBe(
			`'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com 'sha256-${createHash("sha256").update("boot()").digest("base64")}'`,
		);
	});

	it("never lets the app itself frame video players: only portfolio pages allow them", async () => {
		const response = await handleWebApp(new Request("https://example.com/dashboard"), async () => "<html></html>");
		const policy = response.headers.get("Content-Security-Policy") ?? "";
		expect(policy).toContain("frame-src 'self' blob:");
		expect(policy).not.toContain("youtube");
		expect(policy).not.toContain("vimeo");
	});

	it("tags pages for the release purge and preloads their stylesheet and fonts for Early Hints", async () => {
		const response = await handleWebApp(
			new Request("https://example.com/"),
			async () =>
				'<html><head><link rel="icon" href="/favicon.ico"><link rel="stylesheet" crossorigin href="/assets/index-a.css"><link rel="preload" as="font" type="font/woff2" href="/assets/google-sans-b.woff2" crossorigin></head><body><div id="app"></div></body></html>',
		);

		expect(response.headers.get("Cache-Tag")).toBe("html");
		expect(response.headers.get("Link")).toBe(
			`${searchLink}, </assets/index-a.css>; rel=preload; as=style; crossorigin, </assets/google-sans-b.woff2>; rel=preload; as=font; crossorigin`,
		);
	});

	it.each(["/auth/login", "/dashboard", "/builder/resume-1", "/agent"])(
		"serves noindex shell for known app prefix %s",
		async (pathname) => {
			const response = await handleWebApp(new Request(`https://example.com${pathname}`));

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
			expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
			expect(await response.text()).toBe("<html>app</html>");
		},
	);

	it.each(["/templates", "/templates/azurill", "/templates/azurill.pdf"])(
		"returns 404 for retired template preview %s",
		async (pathname) => {
			const response = await handleWebApp(new Request(`https://example.com${pathname}`));

			expect(response.status).toBe(404);
			expect(await response.text()).not.toContain("<html>app</html>");
			expect(fs.readFile).not.toHaveBeenCalled();
		},
	);
});

describe("public docs", () => {
	const page = (title: string, description: string) =>
		`<html lang="en-US" dir="ltr"><head><title>${title}</title><meta name="description" content="${description}"></head><body><div id="app"><article>${title}</article></div></body></html>`;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(fs.readFile).mockImplementation((path) => {
			const file = String(path);
			if (file.endsWith("dist-prerender/docs.html"))
				return Promise.resolve(page("Introduction | Rezumi Docs", "Start here."));
			if (file.endsWith("dist-prerender/docs/guides/editor-overview.html"))
				return Promise.resolve(page("Editor overview | Rezumi Docs", "Panels &amp; modes."));
			if (file.endsWith("dist-prerender/docs/pages.json"))
				return Promise.resolve('["/docs","/docs/guides/editor-overview","/elsewhere",3]');
			if (file.endsWith("dist/index.html")) return Promise.resolve("<html><head></head><body>app</body></html>");
			return Promise.reject(new Error(`ENOENT ${file}`));
		});
	});

	it("never takes /docs for a username's page", () => {
		expect(isProfilePath("/docs")).toBe(false);
		expect(isPublicResumePath("/docs/getting-started")).toBe(false);
	});

	it.each([
		["/docs", "https://rezumi.app/docs", "Introduction"],
		["/docs/guides/editor-overview", "https://rezumi.app/docs/guides/editor-overview", "Editor overview"],
		["/docs/guides/editor-overview/", "https://rezumi.app/docs/guides/editor-overview", "Editor overview"],
	])(
		"serves %s prerendered, indexable, with its canonical address and article data",
		async (path, canonical, headline) => {
			const response = await handleWebApp(new Request(`http://server.internal${path}`));
			const html = await response.text();

			expect(response.status).toBe(200);
			expect(response.headers.get("X-Robots-Tag")).toBeNull();
			expect(html).toContain(`<article>${headline} | Rezumi Docs</article>`);
			expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
			expect(html).toContain('<meta property="og:type" content="article">');
			expect(html).not.toContain('hreflang="');
			const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "{}");
			expect(data["@graph"][1]).toMatchObject({ "@type": "TechArticle", headline, url: canonical, inLanguage: "en" });
		},
	);

	it("decodes the page's escaped description for the structured data", async () => {
		const html = await (await handleWebApp(new Request("https://rezumi.app/docs/guides/editor-overview"))).text();
		const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "{}");
		expect(data["@graph"][1].description).toBe("Panels & modes.");
	});

	it.each(["/docs/guides/missing", "/docs/Guides/Editor-Overview", "/docs/guides/%2e%2e%2fsecret"])(
		"answers %s with the app shell, a 404 and noindex, so the app can redirect or say so",
		async (path) => {
			const response = await handleWebApp(new Request(`https://rezumi.app${path}`));

			expect(response.status).toBe(404);
			expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
			expect(await response.text()).toContain("app</body>");
			for (const [file] of vi.mocked(fs.readFile).mock.calls) expect(String(file)).not.toContain("secret");
		},
	);

	it("lists the docs addresses for the sitemap, and none without a prerendered build", async () => {
		expect(await listDocsPaths()).toEqual(["/docs", "/docs/guides/editor-overview"]);
		vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
		expect(await listDocsPaths()).toEqual([]);
	});
});
