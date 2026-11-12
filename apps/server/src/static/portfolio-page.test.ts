import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PORTFOLIO_PAGE_SCRIPT } from "@rezumi/portfolio/document";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const mocks = vi.hoisted(() => ({
	findPublicPortfolio: vi.fn(),
	recordPortfolioVisit: vi.fn(),
	serveResumePage: vi.fn(),
	/** What the password gate answers for a portfolio with a password. */
	access: "locked" as "open" | "locked",
	turnstile: { site: undefined as string | undefined, secret: undefined as string | undefined },
}));

vi.mock("@rezumi/api/features/portfolio/public", () => ({
	findPublicPortfolio: mocks.findPublicPortfolio,
	recordPortfolioVisit: mocks.recordPortfolioVisit,
}));
vi.mock("./resume-page", () => ({
	serveResumePage: mocks.serveResumePage,
	unavailableResponse: () => new Response("not shared", { status: 404 }),
}));
vi.mock("@rezumi/api/features/portfolio/visitor-access", () => ({
	portfolioAccess: (portfolio: { passwordHash: string | null }) =>
		Promise.resolve(portfolio.passwordHash ? mocks.access : "open"),
}));
vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return {
		env: {
			...env,
			APP_URL: "https://rezumi.example",
			get TURNSTILE_SITE_KEY() {
				return mocks.turnstile.site;
			},
			get TURNSTILE_SECRET_KEY() {
				return mocks.turnstile.secret;
			},
		},
	};
});

const {
	configurePortfolioVisitLifetime,
	customDomainWorkSlug,
	isPortfolioWorkPath,
	portfolioContentSecurityPolicy,
	portfolioPictureUrl,
	servePortfolioOrResume,
	servePortfolioWork,
} = await import("./portfolio-page");

function portfolio(overrides: Partial<PublicPortfolio> = {}): PublicPortfolio {
	const data = structuredClone(defaultResumeData);
	data.basics.name = "Nadia Rahmawati";
	data.basics.headline = "Product Designer";
	data.metadata.page.locale = "id-ID";
	data.sections.profiles.items = [
		{
			id: "pr1",
			hidden: false,
			icon: "",
			iconColor: "",
			network: "LinkedIn",
			username: "nadia",
			website: { url: "https://linkedin.example.test/in/nadia", label: "", inlineLink: false },
		},
	];
	return {
		id: "pf1",
		userId: "user-1",
		username: "nadia",
		ownerName: "Nadia",
		timezone: "Asia/Jakarta",
		data: parsePortfolioData({
			hero: { greeting: "Hello." },
			works: { items: [{ id: "w1", slug: "kopi", title: "Coffee app", blocks: [] }] },
		}),
		updatedAt: new Date("2026-11-06T00:00:00Z"),
		indexable: true,
		customDomain: null,
		resume: { data, slug: "cv", isPublic: true, hasPassword: false, showDownloadButtons: true },
		entitlements: { hidePortfolioCredit: false },
		passwordHash: null,
		...overrides,
	};
}

const get = (path = "/nadia", init: RequestInit = {}) => new Request(`https://rezumi.example${path}`, init);
const resumeResponse = new Response("<html>the primary resume</html>", { status: 200 });

beforeEach(() => {
	mocks.findPublicPortfolio.mockReset();
	mocks.recordPortfolioVisit.mockReset().mockResolvedValue(undefined);
	mocks.serveResumePage.mockReset().mockResolvedValue(resumeResponse);
	mocks.turnstile.site = undefined;
	mocks.turnstile.secret = undefined;
	mocks.access = "locked";
});

describe("servePortfolioOrResume", () => {
	it("serves the primary resume, untouched, when no portfolio shows at the address", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(null);
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		expect(response).toBe(resumeResponse);
		expect(mocks.serveResumePage).toHaveBeenCalledWith(
			expect.any(Request),
			{ username: "nadia", primary: true },
			"1.1.1.1",
			{},
		);
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
	});

	it("keeps POST for the resume's password form", async () => {
		const response = await servePortfolioOrResume(
			get("/nadia", { method: "POST", body: "password=x" }),
			"nadia",
			"1.1.1.1",
		);
		expect(response).toBe(resumeResponse);
		expect(mocks.findPublicPortfolio).not.toHaveBeenCalled();
	});

	it("serves a published portfolio with its head, policy and headers, and counts the visit", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		const body = await response.text();
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
		const policy = response.headers.get("Content-Security-Policy") ?? "";
		// The page's one inline script: the shared one, with the published page's beacons after it.
		const script = /<script>([\s\S]*?)<\/script>/.exec(body)?.[1] ?? "";
		expect(script.startsWith(PORTFOLIO_PAGE_SCRIPT)).toBe(true);
		const hash = createHash("sha256").update(script).digest("base64");
		expect(policy).toContain(`'sha256-${hash}'`);
		expect(policy).toContain("frame-src https://www.youtube-nocookie.com https://player.vimeo.com");
		expect(policy).not.toContain("'unsafe-inline' 'unsafe-eval'");
		expect(body).toContain('<link rel="canonical" href="https://rezumi.example/nadia">');
		expect(body).toContain('<meta property="og:image" content="https://rezumi.example/cards/nadia.png">');
		expect(body).toContain('<link rel="me" href="https://linkedin.example.test/in/nadia">');
		expect(body).toContain('"@type":"ProfilePage"');
		expect(body).toContain('"@type":"CreativeWork","name":"Coffee app","url":"https://rezumi.example/nadia/work/kopi"');
		expect(mocks.serveResumePage).not.toHaveBeenCalled();
		expect(mocks.recordPortfolioVisit).toHaveBeenCalledWith({
			portfolio: expect.objectContaining({ id: "pf1" }),
			requestHeaders: expect.any(Headers),
			requestUrl: "https://rezumi.example/nadia",
			trustedClient: "1.1.1.1",
		});
	});

	it("follows the owner's plan for the badge, whatever the portfolio has stored", async () => {
		const hidden = parsePortfolioData({ credit: { show: false } });
		const page = async (hidePortfolioCredit: boolean) => {
			mocks.findPublicPortfolio.mockResolvedValue(portfolio({ data: hidden, entitlements: { hidePortfolioCredit } }));
			return (await servePortfolioOrResume(get(), "nadia", "1.1.1.1")).text();
		};
		expect(await page(false)).toContain('class="pf-badge"');
		expect(await page(true)).not.toContain('class="pf-badge"');
	});

	it("allows a script intro effect by the hash of the page's whole script", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(
			portfolio({
				data: parsePortfolioData({ theme: "lugas", hero: { effect: { id: "scramble", target: "name", phrases: [] } } }),
			}),
		);
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		const body = await response.text();
		const script = /<script>([\s\S]*?)<\/script><\/body>/.exec(body)?.[1] ?? "";
		expect(script.startsWith(PORTFOLIO_PAGE_SCRIPT)).toBe(true);
		expect(script.length).toBeGreaterThan(PORTFOLIO_PAGE_SCRIPT.length);
		const hash = createHash("sha256").update(script).digest("base64");
		expect(response.headers.get("Content-Security-Policy")).toContain(`'sha256-${hash}'`);
	});

	it("keeps unindexed portfolios out of search engines", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio({ indexable: false }));
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
		const body = await response.text();
		expect(body).toContain('<meta name="robots" content="noindex, follow">');
		expect(body).not.toContain("application/ld+json");
	});

	it("points search engines to the custom domain", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio({ customDomain: "nadia.dev" }));
		const fromApp = await (await servePortfolioOrResume(get(), "nadia", "1.1.1.1")).text();
		expect(fromApp).toContain('<link rel="canonical" href="https://nadia.dev/">');
		const onDomain = await servePortfolioOrResume(new Request("https://nadia.dev/"), "nadia", "1.1.1.1", {
			customDomain: "nadia.dev",
		});
		expect(await onDomain.text()).toContain('<link rel="canonical" href="https://nadia.dev/">');
	});

	it("leaves out buttons to a resume that isn't shared or locks its PDF", async () => {
		const locked = portfolio();
		if (locked.resume) Object.assign(locked.resume, { hasPassword: true });
		mocks.findPublicPortfolio.mockResolvedValue(
			portfolio({ data: parsePortfolioData({ hero: { buttons: [{ kind: "resume" }, { kind: "pdf" }] } }) }),
		);
		expect(await (await servePortfolioOrResume(get(), "nadia", "1")).text()).toContain("/api/resumes/nadia/cv/pdf");
		mocks.findPublicPortfolio.mockResolvedValue({
			...locked,
			data: parsePortfolioData({ hero: { buttons: [{ kind: "resume" }, { kind: "pdf" }] } }),
		});
		const body = await (await servePortfolioOrResume(get(), "nadia", "1")).text();
		expect(body).toContain('href="https://rezumi.example/nadia/cv"');
		expect(body).not.toContain("/api/resumes/nadia/cv/pdf");
	});

	it("still serves the page when counting fails", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		mocks.recordPortfolioVisit.mockRejectedValue(new Error("database down"));
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await servePortfolioOrResume(get(), "nadia", "1")).status).toBe(200);
		await vi.waitFor(() => expect(logged).toHaveBeenCalledWith("Portfolio visit counting failed", expect.any(Error)));
		logged.mockRestore();
	});
});

describe("the contact form", () => {
	const withForm = () =>
		portfolio({
			data: parsePortfolioData({
				contact: { form: true },
				works: { items: [{ id: "w1", slug: "kopi", title: "Coffee app", blocks: [] }] },
			}),
		});
	const keys = () => {
		mocks.turnstile.site = "1x00000000000000000000AA";
		mocks.turnstile.secret = "1x0000000000000000000000000000000AA";
	};
	const policyOf = (response: Response) => response.headers.get("Content-Security-Policy") ?? "";

	it("adds Turnstile to the policy only on a page with the form", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(withForm());
		const policy = policyOf(await servePortfolioOrResume(get(), "nadia", "1.1.1.1"));
		expect(policy).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
		expect(policy).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
	});

	it("loads nothing from Turnstile without the form, or without its keys", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		expect(policyOf(await servePortfolioOrResume(get(), "nadia", "1.1.1.1"))).not.toContain("challenges.cloudflare");
		mocks.turnstile.secret = undefined;
		mocks.findPublicPortfolio.mockResolvedValue(withForm());
		expect(policyOf(await servePortfolioOrResume(get(), "nadia", "1.1.1.1"))).not.toContain("challenges.cloudflare");
	});

	it("doesn't load Turnstile on a custom domain, whose hostname the widget can't list", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(withForm());
		const response = await servePortfolioOrResume(get("/"), "nadia", "1.1.1.1", { customDomain: "nadia.example" });
		expect(policyOf(response)).not.toContain("challenges.cloudflare");
	});

	it("never shows the secret in the page or its headers", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(withForm());
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		expect(await response.text()).not.toContain("1x0000000000000000000000000000000AA");
		expect(JSON.stringify([...response.headers])).not.toContain("1x0000000000000000000000000000000AA");
	});
});

describe("the report form", () => {
	const keys = () => {
		mocks.turnstile.site = "1x00000000000000000000AA";
		mocks.turnstile.secret = "1x0000000000000000000000000000000AA";
	};

	it("is a page of its own, kept out of search engines, that counts no visit", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const response = await servePortfolioOrResume(get("/nadia?report"), "nadia", "1.1.1.1");
		const body = await response.text();
		expect(body).toContain('action="/api/portfolio/nadia/report"');
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(response.headers.get("Content-Security-Policy")).toMatch(/frame-src [^;]*challenges\.cloudflare\.com/);
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
	});

	it("gives an email address until the Turnstile keys are set", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const body = await (await servePortfolioOrResume(get("/nadia?report"), "nadia", "1.1.1.1")).text();
		expect(body).not.toContain("<form");
		expect(body).toContain("mailto:hi@rezumi.app");
	});

	it("shows the outcome of a send", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const body = await (await servePortfolioOrResume(get("/nadia?report=sent"), "nadia", "1.1.1.1")).text();
		expect(body).not.toContain("<form");
		expect(body).toContain('class="status"');
	});

	it("moves to the app's own domain from a custom domain, where Turnstile works", async () => {
		keys();
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const response = await servePortfolioOrResume(get("/?report"), "nadia", "1.1.1.1", {
			customDomain: "nadia.example",
		});
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://rezumi.example/nadia?report");
	});

	it("is the primary resume's page when the address shows no portfolio", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(null);
		expect(await (await servePortfolioOrResume(get("/nadia?report"), "nadia", "1.1.1.1")).text()).toContain(
			"the primary resume",
		);
	});

	it("is linked from the page's footer, and from a custom domain to the app's domain", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		expect(await (await servePortfolioOrResume(get(), "nadia", "1.1.1.1")).text()).toContain(
			'href="/nadia?report" rel="nofollow"',
		);
		mocks.findPublicPortfolio.mockResolvedValue(portfolio());
		const onDomain = await servePortfolioOrResume(get("/"), "nadia", "1.1.1.1", { customDomain: "nadia.example" });
		expect(await onDomain.text()).toContain('href="https://rezumi.example/nadia?report" rel="nofollow"');
	});
});

describe("visits", () => {
	beforeEach(() => mocks.findPublicPortfolio.mockResolvedValue(portfolio()));
	afterEach(() => {
		configurePortfolioVisitLifetime(undefined);
		vi.unstubAllEnvs();
	});

	it("count only pages someone opens: no HEAD requests, prefetches or prerenders", async () => {
		for (const init of [
			{ method: "HEAD" },
			{ headers: { "Sec-Purpose": "prefetch" } },
			{ headers: { "Sec-Purpose": "prefetch;prerender" } },
			{ headers: { Purpose: "prefetch" } },
			{ headers: { "X-Purpose": "preview" } },
			{ headers: { "X-Moz": "prefetch" } },
		]) {
			const response = await servePortfolioOrResume(get("/nadia", init), "nadia", "1");
			expect(response.status, JSON.stringify(init)).toBe(200);
		}
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
		await servePortfolioOrResume(get(), "nadia", "1");
		expect(mocks.recordPortfolioVisit).toHaveBeenCalledOnce();
	});

	it("are counted without holding up the page", async () => {
		mocks.recordPortfolioVisit.mockReturnValue(new Promise(() => {}));
		expect((await servePortfolioOrResume(get(), "nadia", "1")).status).toBe(200);
	});

	it("are waited for on Workers until the platform keeps them going after the response", async () => {
		vi.stubEnv("CLOUDFLARE", "1");
		let finish = () => {};
		mocks.recordPortfolioVisit.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
		let answered = false;
		const serving = servePortfolioOrResume(get(), "nadia", "1").then((response) => {
			answered = true;
			return response;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(answered).toBe(false);
		finish();
		expect((await serving).status).toBe(200);

		const kept: Promise<unknown>[] = [];
		configurePortfolioVisitLifetime((work) => kept.push(work));
		mocks.recordPortfolioVisit.mockReturnValue(new Promise(() => {}));
		expect((await servePortfolioOrResume(get(), "nadia", "1")).status).toBe(200);
		expect(kept).toHaveLength(1);
	});
});

/** Each directive of a policy header with its sources. */
const directives = (policy: string) =>
	new Map(
		policy.split(";").map((part) => {
			const [name = "", ...sources] = part.trim().split(/\s+/);
			return [name, sources] as const;
		}),
	);

/** Whether a policy's sources allow loading `url` into a page at `pageOrigin` (enough of CSP for these checks). */
function allows(sources: readonly string[], url: string, pageOrigin: string): boolean {
	const target = new URL(url, pageOrigin);
	return sources.some((source) => {
		if (source === "'self'") return target.origin === pageOrigin;
		if (/^[a-z]+:$/.test(source)) return target.protocol === source;
		return /^https?:\/\//.test(source) && target.origin === new URL(source).origin;
	});
}

describe("the page's content security policy", () => {
	it("allows exactly what the page loads: its script, pictures, fonts and video players", async () => {
		const data = parsePortfolioData({
			design: { fonts: { source: "pair", id: "editorial" } },
			works: {
				items: [
					{
						id: "w1",
						slug: "kopi",
						title: "Coffee app",
						cover: { key: "uploads/user-1/pictures/portfolio/cover.webp", width: 1600, height: 900 },
						blocks: [
							{ id: "b1", type: "video", provider: "youtube", videoId: "dQw4w9WgXcQ", title: "Reel" },
							{ id: "b2", type: "video", provider: "vimeo", videoId: "123456789", title: "Making of" },
						],
					},
				],
			},
		});
		mocks.findPublicPortfolio.mockResolvedValue(portfolio({ data }));
		for (const pageOrigin of ["https://rezumi.example", "https://nadia.dev"]) {
			const response = await servePortfolioOrResume(
				new Request(`${pageOrigin}/`),
				"nadia",
				"1",
				pageOrigin === "https://rezumi.example" ? {} : { customDomain: "nadia.dev" },
			);
			const body = await response.text();
			const policy = directives(response.headers.get("Content-Security-Policy") ?? "");

			const script = /<script>([\s\S]*?)<\/script><\/body>/.exec(body)?.[1] ?? "";
			const hash = createHash("sha256").update(script).digest("base64");
			expect(policy.get("script-src")).toContain(`'sha256-${hash}'`);

			const pictures = [...body.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(([, src]) => src ?? "");
			expect(pictures).toContain("https://rezumi.example/uploads/user-1/pictures/portfolio/cover.webp");
			for (const src of pictures) expect(allows(policy.get("img-src") ?? [], src, pageOrigin), src).toBe(true);

			const fonts = [...body.matchAll(/@font-face\{[^}]*src:url\("([^"]+)"\)/g)].map(([, src]) => src ?? "");
			expect(fonts.length).toBeGreaterThan(0);
			for (const src of fonts) expect(allows(policy.get("font-src") ?? [], src, pageOrigin), src).toBe(true);

			// The players live on the work's own page (Phase 13, B2), under that page's policy.
			const workPage = await servePortfolioWork(
				new Request(`${pageOrigin}/${pageOrigin === "https://rezumi.example" ? "nadia/" : ""}work/kopi`),
				"nadia",
				"kopi",
				"1",
				pageOrigin === "https://rezumi.example" ? {} : { customDomain: "nadia.dev" },
			);
			const workPolicy = directives(workPage.headers.get("Content-Security-Policy") ?? "");
			const players = [...(await workPage.text()).matchAll(/data-embed="([^"]+)"/g)].map(([, src]) =>
				(src ?? "").replaceAll("&amp;", "&"),
			);
			expect(players).toHaveLength(2);
			for (const src of players) expect(allows(workPolicy.get("frame-src") ?? [], src, pageOrigin), src).toBe(true);
		}
	});

	it("frames only the video players, embeds nothing, runs no workers and posts forms only here", () => {
		const policy = directives(portfolioContentSecurityPolicy("void 0"));
		expect(policy.get("frame-src")).toEqual(["https://www.youtube-nocookie.com", "https://player.vimeo.com"]);
		expect(policy.get("object-src")).toEqual(["'none'"]);
		expect(policy.get("worker-src")).toEqual(["'none'"]);
		expect(policy.get("form-action")).toEqual(["'self'"]);
		expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
		expect(policy.get("base-uri")).toEqual(["'self'"]);
		expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
		expect(policy.get("script-src")).not.toContain("'wasm-unsafe-eval'");
		expect(allows(policy.get("frame-src") ?? [], "https://rezumi.example/", "https://rezumi.example")).toBe(false);
	});

	it("takes more sources per directive, as Turnstile will need", () => {
		const policy = directives(
			portfolioContentSecurityPolicy("void 0", {
				"script-src": ["https://challenges.cloudflare.com"],
				"frame-src": ["https://challenges.cloudflare.com"],
				"worker-src": ["'self'"],
			}),
		);
		expect(policy.get("script-src")).toContain("https://challenges.cloudflare.com");
		expect(policy.get("frame-src")).toEqual([
			"https://www.youtube-nocookie.com",
			"https://player.vimeo.com",
			"https://challenges.cloudflare.com",
		]);
		expect(policy.get("worker-src")).toEqual(["'self'"]);
	});
});

describe("pictures", () => {
	const withPicture = (url: string) => {
		const page = portfolio();
		if (page.resume) page.resume.data.picture = { ...page.resume.data.picture, url, hidden: false };
		return page;
	};

	it("show a resume photo only when it's one of this app's uploads", async () => {
		const own = "https://rezumi.example/api/uploads/user-1/pictures/0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9.jpeg";
		mocks.findPublicPortfolio.mockResolvedValue(withPicture(own));
		const shown = await (await servePortfolioOrResume(get(), "nadia", "1")).text();
		expect(shown).toContain(`src="${own}"`);
		expect(shown).toContain(`"image":"${own}"`);

		for (const elsewhere of [
			"https://images.example.test/nadia.jpg",
			"https://rezumi.example.evil.test/api/uploads/user-1/pictures/a.jpeg",
			"https://rezumi.example/api/uploads/user-1/pictures/a.jpeg?track=1",
			"https://rezumi.example/somewhere/else.jpeg",
			"data:image/png;base64,AAAA",
		]) {
			mocks.findPublicPortfolio.mockResolvedValue(withPicture(elsewhere));
			const body = await (await servePortfolioOrResume(get(), "nadia", "1")).text();
			expect(body, elsewhere).not.toContain(elsewhere.replaceAll("&", "&amp;"));
			expect(body).not.toContain('"image":');
		}
	});

	it("are this app's own uploads only, whatever the view holds", () => {
		expect(portfolioPictureUrl("/api/uploads/user-1/pictures/a.webp")).toBe(
			"https://rezumi.example/api/uploads/user-1/pictures/a.webp",
		);
		expect(portfolioPictureUrl("https://rezumi.example/uploads/user-1/pictures/portfolio/a-sm.jpg")).toBe(
			"https://rezumi.example/uploads/user-1/pictures/portfolio/a-sm.jpg",
		);
		for (const source of [
			"https://cdn.example.test/uploads/user-1/pictures/a.webp",
			"//cdn.example.test/uploads/user-1/pictures/a.webp",
			"https://rezumi.example/uploads/user-1/documents/portfolio/a.pdf",
			"https://rezumi.example/uploads/user-1/pictures/../secret.png",
			"https://user:pass@rezumi.example/uploads/user-1/pictures/a.webp",
			"javascript:alert(1)",
		])
			expect(portfolioPictureUrl(source), source).toBeUndefined();
	});
});

describe("work pages (Phase 13, B2)", () => {
	const works = {
		items: [
			{ id: "w1", slug: "kopi", previousSlugs: ["coffee-app"], title: "Coffee app", summary: "A café's ordering app." },
			{
				id: "w2",
				slug: "deck",
				title: "Pitch deck",
				tags: ["Figma"],
				blocks: [
					{ id: "t", type: "text", html: "<p>The story behind the deck.</p>" },
					{ id: "e", type: "embed", provider: "figma", ref: "deck/AbCdEf0123456789xyz" },
				],
			},
			{ id: "w3", slug: "secret", title: "Secret", hidden: true },
		],
	};
	const withWorks = (overrides: Partial<PublicPortfolio> = {}) =>
		portfolio({ data: parsePortfolioData({ works }), ...overrides });

	it("answer only `/<username>/work/<slug>`, and on a custom domain `/work/<slug>`", () => {
		expect(isPortfolioWorkPath("/nadia/work/kopi")).toBe(true);
		for (const path of [
			"/nadia/work",
			"/nadia/work/Kopi",
			"/nadia/work/kopi/",
			"/dashboard/work/kopi",
			"/nadia/works/kopi",
			"//work/kopi",
			`/nadia/work/${"a".repeat(65)}`,
		])
			expect(isPortfolioWorkPath(path), path).toBe(false);
		expect(customDomainWorkSlug("/work/kopi")).toBe("kopi");
		expect(customDomainWorkSlug("/work/kopi/x")).toBeNull();
		expect(customDomainWorkSlug("/nadia/work/kopi")).toBeNull();
	});

	it("draw a work's page with its own address, preview, title and structured data, and count it", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(withWorks());
		const response = await servePortfolioWork(get("/nadia/work/deck"), "nadia", "deck", "1.1.1.1");
		const body = await response.text();
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(body).toContain('<link rel="canonical" href="https://rezumi.example/nadia/work/deck">');
		expect(body).toContain('<meta property="og:type" content="article">');
		expect(body).toContain("https://rezumi.example/cards/nadia/work/deck.png");
		expect(body).toContain("<title>Pitch deck — ");
		// No summary: the first text stands for it.
		expect(body).toContain('content="The story behind the deck."');
		const data = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(body)?.[1] ?? "{}");
		expect(data).toMatchObject({
			"@type": "CreativeWork",
			name: "Pitch deck",
			url: "https://rezumi.example/nadia/work/deck",
			keywords: "Figma",
			isPartOf: { "@type": "ProfilePage", url: "https://rezumi.example/nadia" },
		});
		// Only the providers this work embeds may be framed, next to the video players.
		const frames = /frame-src ([^;]*)/.exec(response.headers.get("Content-Security-Policy") ?? "")?.[1] ?? "";
		expect(frames.split(" ").sort()).toEqual(
			[
				"https://embed.figma.com",
				"https://player.vimeo.com",
				"https://www.figma.com",
				"https://www.youtube-nocookie.com",
			].sort(),
		);
		expect(mocks.recordPortfolioVisit).toHaveBeenCalledWith(expect.objectContaining({ workId: "w2" }));
	});

	it("forward a previous address to the current one, and answer 404 for a work the page doesn't list", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(withWorks());
		const moved = await servePortfolioWork(get("/nadia/work/coffee-app?x=1"), "nadia", "coffee-app", "1.1.1.1");
		expect(moved.status).toBe(301);
		expect(moved.headers.get("Location")).toBe("/nadia/work/kopi");
		for (const slug of ["secret", "nothing"]) {
			const missing = await servePortfolioWork(get(`/nadia/work/${slug}`), "nadia", slug, "1.1.1.1");
			expect(missing.status).toBe(404);
			const body = await missing.text();
			expect(body).toContain('href="/nadia"');
			expect(body).not.toContain("Secret");
			expect(body).not.toContain("<script");
		}
		mocks.findPublicPortfolio.mockResolvedValue(null);
		const none = await servePortfolioWork(get("/ghost/work/kopi"), "ghost", "kopi", "1.1.1.1");
		expect(none.status).toBe(404);
		expect(await none.text()).toBe("not shared");
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
	});

	it("live at the custom domain's address there, and point search engines to it", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(withWorks({ customDomain: "nadia.example" }));
		const app = await (await servePortfolioWork(get("/nadia/work/kopi"), "nadia", "kopi", "1.1.1.1")).text();
		expect(app).toContain('<link rel="canonical" href="https://nadia.example/work/kopi">');
		const own = await servePortfolioWork(
			new Request("https://nadia.example/work/coffee-app"),
			"nadia",
			"coffee-app",
			"1.1.1.1",
			{ customDomain: "nadia.example" },
		);
		expect(own.headers.get("Location")).toBe("/work/kopi");
	});

	it("link the home page's works to their pages in its structured data", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(withWorks());
		const body = await (await servePortfolioOrResume(get(), "nadia", "1.1.1.1")).text();
		expect(body).toContain('"url":"https://rezumi.example/nadia/work/kopi"');
		expect(body).not.toContain('#work-kopi"');
	});
});

describe("a portfolio behind a password (Phase 13, B16)", () => {
	const locked = () =>
		portfolio({
			passwordHash: "$2a$10$secret-hash",
			data: parsePortfolioData({
				works: { items: [{ id: "w1", slug: "kopi", title: "Coffee app" }] },
				hero: { greeting: "Hello." },
			}),
		});

	it("shows the password page at its home: nothing of the portfolio, no script, never cached or indexed", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(locked());
		const response = await servePortfolioOrResume(get("/nadia?unlock=wrong"), "nadia", "1.1.1.1");
		const body = await response.text();
		expect(response.status).toBe(401);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(response.headers.get("Content-Security-Policy")).toContain(
			"script-src 'self' https://static.cloudflareinsights.com 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
		);
		expect(body).toContain('action="/api/portfolio/nadia/unlock"');
		expect(body).toContain('name="next" value="home"');
		expect(body).toContain('role="alert"');
		for (const leak of ["Nadia", "Hello.", "Coffee app", "secret-hash", "<script"]) expect(body).not.toContain(leak);
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
	});

	it("asks for it on a work's page before looking the work up, so a locked page tells nothing", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(locked());
		const real = await servePortfolioWork(get("/nadia/work/kopi"), "nadia", "kopi", "1.1.1.1");
		const fake = await servePortfolioWork(get("/nadia/work/nothing"), "nadia", "nothing", "1.1.1.1");
		expect([real.status, fake.status]).toEqual([401, 401]);
		const body = await real.text();
		expect(body).toContain('name="next" value="work:kopi"');
		expect(body).not.toContain("Coffee app");
		expect(mocks.recordPortfolioVisit).not.toHaveBeenCalled();
	});

	it("still takes reports, without naming the person to someone who can't open it", async () => {
		mocks.findPublicPortfolio.mockResolvedValue(locked());
		const body = await (await servePortfolioOrResume(get("/nadia?report"), "nadia", "1.1.1.1")).text();
		expect(body).toContain("@nadia");
		expect(body).not.toContain("Nadia Rahmawati");
	});

	it("opens for a visitor with access, and for its owner", async () => {
		mocks.access = "open";
		mocks.findPublicPortfolio.mockResolvedValue(locked());
		const response = await servePortfolioOrResume(get(), "nadia", "1.1.1.1");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Hello.");
		// Still kept out of search engines: the finder reads it as not indexable.
	});
});
