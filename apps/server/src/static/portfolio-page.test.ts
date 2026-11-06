import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PORTFOLIO_PAGE_SCRIPT } from "@rezumi/portfolio/document";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const mocks = vi.hoisted(() => ({
	findPublicPortfolio: vi.fn(),
	recordPortfolioVisit: vi.fn(),
	serveResumePage: vi.fn(),
}));

vi.mock("@rezumi/api/features/portfolio/public", () => ({
	findPublicPortfolio: mocks.findPublicPortfolio,
	recordPortfolioVisit: mocks.recordPortfolioVisit,
}));
vi.mock("./resume-page", () => ({ serveResumePage: mocks.serveResumePage }));
vi.mock("@rezumi/env/server", async (original) => {
	const { env } = await original<typeof import("@rezumi/env/server")>();
	return { env: { ...env, APP_URL: "https://rezumi.example" } };
});

const { servePortfolioOrResume } = await import("./portfolio-page");

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
		data: parsePortfolioData({
			hero: { greeting: "Hello." },
			works: { items: [{ id: "w1", slug: "kopi", title: "Coffee app", blocks: [] }] },
		}),
		updatedAt: new Date("2026-11-06T00:00:00Z"),
		indexable: true,
		customDomain: null,
		resume: { data, slug: "cv", isPublic: true, hasPassword: false, showDownloadButtons: true },
		...overrides,
	};
}

const get = (path = "/nadia", init: RequestInit = {}) => new Request(`https://rezumi.example${path}`, init);
const resumeResponse = new Response("<html>the primary resume</html>", { status: 200 });

beforeEach(() => {
	mocks.findPublicPortfolio.mockReset();
	mocks.recordPortfolioVisit.mockReset().mockResolvedValue(undefined);
	mocks.serveResumePage.mockReset().mockResolvedValue(resumeResponse);
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
		const hash = createHash("sha256").update(PORTFOLIO_PAGE_SCRIPT).digest("base64");
		expect(policy).toContain(`'sha256-${hash}'`);
		expect(policy).toContain("frame-src 'self' blob: https://www.youtube-nocookie.com https://player.vimeo.com");
		expect(policy).not.toContain("'unsafe-inline' 'unsafe-eval'");
		expect(body).toContain('<link rel="canonical" href="https://rezumi.example/nadia">');
		expect(body).toContain('<meta property="og:image" content="https://rezumi.example/cards/nadia.png">');
		expect(body).toContain('<link rel="me" href="https://linkedin.example.test/in/nadia">');
		expect(body).toContain('"@type":"ProfilePage"');
		expect(body).toContain('"@type":"CreativeWork","name":"Coffee app","url":"https://rezumi.example/nadia#work-kopi"');
		expect(body).toContain(`<script>${PORTFOLIO_PAGE_SCRIPT}</script>`);
		expect(mocks.serveResumePage).not.toHaveBeenCalled();
		expect(mocks.recordPortfolioVisit).toHaveBeenCalledWith({
			portfolio: expect.objectContaining({ id: "pf1" }),
			requestHeaders: expect.any(Headers),
			trustedClient: "1.1.1.1",
		});
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
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect((await servePortfolioOrResume(get(), "nadia", "1")).status).toBe(200);
	});
});
