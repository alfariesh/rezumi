import { describe, expect, it, vi } from "vite-plus/test";

const secret = "s".repeat(40);
const mocks = vi.hoisted(() => ({
	traefikConfiguration: vi.fn(async () => ({})),
	customDomainUsername: vi.fn(async (_host: string): Promise<string | null> => null),
	servePortfolioOrResume: vi.fn(async (..._args: unknown[]) => new Response("page")),
}));

vi.mock("@rezumi/env/server", () => ({
	env: { APP_URL: "https://rezumi.app", CUSTOM_DOMAIN_PROVIDER_SECRET: "s".repeat(40) },
}));
vi.mock("@rezumi/api/features/custom-domain", () => ({
	isCustomDomainsEnabled: () => true,
	customDomainUsername: mocks.customDomainUsername,
	ownHosts: () => new Set(["rezumi.app"]),
	traefikConfiguration: mocks.traefikConfiguration,
}));

vi.mock("../static/portfolio-page", () => ({ servePortfolioOrResume: mocks.servePortfolioOrResume }));

const { handleCustomDomain, handleTraefikProvider } = await import("./custom-domain");

describe("custom domain pages", () => {
	const visit = (path: string) => handleCustomDomain(new Request(`https://nadia.dev${path}`), "1.1.1.1");

	it("opens the portfolio, or else the primary resume, at the root", async () => {
		mocks.customDomainUsername.mockResolvedValue("nadia");
		expect(await (await visit("/"))?.text()).toBe("page");
		expect(mocks.servePortfolioOrResume).toHaveBeenCalledWith(expect.any(Request), "nadia", "1.1.1.1", {
			customDomain: "nadia.dev",
		});
	});

	it("lets the resume PDF and the portfolio's own requests through, and sends everything else to the app", async () => {
		mocks.customDomainUsername.mockResolvedValue("nadia");
		expect(await visit("/api/portfolio/nadia/message")).toBeNull();
		expect(await visit("/api/resumes/nadia/cv/pdf")).toBeNull();
		const other = await visit("/dashboard");
		expect(other?.status).toBe(301);
	});

	it("leaves unknown hosts alone", async () => {
		mocks.customDomainUsername.mockResolvedValue(null);
		expect(await handleCustomDomain(new Request("https://elsewhere.test/"), "1.1.1.1")).toBeNull();
	});
});

const poll = (headers: Record<string, string>, query = "?service=app@swarm&entryPoint=websecure&certResolver=le") =>
	handleTraefikProvider(new Request(`https://rezumi.app/api/internal/traefik${query}`, { headers }));

describe("Traefik provider endpoint", () => {
	it.each([{}, { "x-provider-secret": "wrong" }, { "x-provider-secret": `${secret}x` }])(
		"hides the routers from a request without the secret: %j",
		async (headers) => {
			const response = await poll(headers);
			expect(response.status).toBe(404);
			expect(mocks.traefikConfiguration).not.toHaveBeenCalled();
		},
	);

	it("returns the routers for the deployment's own Traefik names", async () => {
		const response = await poll({ "x-provider-secret": secret });
		expect(response.status).toBe(200);
		expect(mocks.traefikConfiguration).toHaveBeenCalledWith({
			service: "app@swarm",
			entryPoint: "websecure",
			certResolver: "le",
		});
	});

	it("refuses names that could break out of a router rule", async () => {
		const response = await poll({ "x-provider-secret": secret }, "?service=app`)||Host(`x");
		expect(response.status).toBe(400);
	});
});
