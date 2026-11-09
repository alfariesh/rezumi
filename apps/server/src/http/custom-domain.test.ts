import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const secret = "s".repeat(40);
type Destination = { username: string; redirecting: boolean } | null;
const mocks = vi.hoisted(() => ({
	traefikConfiguration: vi.fn(async () => ({})),
	customDomainDestination: vi.fn(async (_host: string): Promise<Destination> => null),
	servePortfolioOrResume: vi.fn(async (..._args: unknown[]) => new Response("page")),
	automated: false,
}));

vi.mock("@rezumi/env/server", () => ({
	env: {
		APP_URL: "https://rezumi.app",
		CUSTOM_DOMAIN_TARGET: "domains.rezumi.app",
		CUSTOM_DOMAIN_PROVIDER_SECRET: "s".repeat(40),
	},
}));
vi.mock("@rezumi/api/features/custom-domain", () => ({
	isCustomDomainsEnabled: () => true,
	isCloudflareSaasEnabled: () => mocks.automated,
	customDomainDestination: mocks.customDomainDestination,
	ownHosts: () => new Set(["rezumi.app", "domains.rezumi.app"]),
	traefikConfiguration: mocks.traefikConfiguration,
}));

vi.mock("../static/portfolio-page", () => ({ servePortfolioOrResume: mocks.servePortfolioOrResume }));

const { handleCustomDomain, handleTraefikProvider } = await import("./custom-domain");

const nadia = { username: "nadia", redirecting: false };
// The handler remembers each host for a minute, so every test visits a host of its own.
let hosts = 0;
const uniqueHost = () => `site${(hosts += 1)}.test`;

beforeEach(() => {
	mocks.automated = false;
	mocks.customDomainDestination.mockReset();
	mocks.customDomainDestination.mockResolvedValue(null);
});

describe("custom domain pages", () => {
	const visit = (path: string, host = uniqueHost()) =>
		handleCustomDomain(new Request(`https://${host}${path}`), "1.1.1.1");

	it("opens the portfolio, or else the primary resume, at the root", async () => {
		mocks.customDomainDestination.mockResolvedValue(nadia);
		expect(await (await visit("/", "nadia.dev"))?.text()).toBe("page");
		expect(mocks.servePortfolioOrResume).toHaveBeenCalledWith(expect.any(Request), "nadia", "1.1.1.1", {
			customDomain: "nadia.dev",
		});
	});

	it("lets the resume PDF and the portfolio's own requests through, and sends everything else to the app", async () => {
		mocks.customDomainDestination.mockResolvedValue(nadia);
		expect(await visit("/api/portfolio/nadia/message")).toBeNull();
		expect(await visit("/api/resumes/nadia/cv/pdf")).toBeNull();
		const other = await visit("/dashboard");
		expect(other?.status).toBe(301);
	});

	it("sends the whole domain to the account's address once the plan's grace is over", async () => {
		mocks.customDomainDestination.mockResolvedValue({ username: "nadia.k", redirecting: true });
		for (const path of ["/", "/api/portfolio/nadia.k/event"]) {
			const response = await visit(path);
			expect(response?.status).toBe(302);
			expect(response?.headers.get("location")).toBe("https://rezumi.app/nadia.k");
		}
		expect(mocks.servePortfolioOrResume).not.toHaveBeenCalledWith(
			expect.anything(),
			"nadia.k",
			expect.anything(),
			expect.anything(),
		);
	});

	it("leaves unknown hosts alone without the Cloudflare automation", async () => {
		expect(await visit("/")).toBeNull();
	});

	describe("with the Cloudflare automation", () => {
		beforeEach(() => {
			mocks.automated = true;
		});

		it.each(["/", "/auth/login", "/dashboard", "/api/rpc/x"])(
			"answers 404 on a host that isn't connected: %s",
			async (path) => {
				expect((await visit(path))?.status).toBe(404);
			},
		);

		it("leaves the app's own hosts and local development alone", async () => {
			expect(await visit("/", "rezumi.app")).toBeNull();
			expect(await visit("/", "localhost")).toBeNull();
			expect(await visit("/", "127.0.0.1")).toBeNull();
		});

		it("leaves the app's own subdomains as they were", async () => {
			expect(await visit("/", "www.rezumi.app")).toBeNull();
		});

		it("doesn't mistake a domain that starts with 127 for this machine", async () => {
			expect((await visit("/", "127.example.com"))?.status).toBe(404);
		});

		it("sends the CNAME target to the app, never showing the app there", async () => {
			const response = await visit("/dashboard?x=1", "domains.rezumi.app");
			expect(response?.status).toBe(301);
			expect(response?.headers.get("location")).toBe("https://rezumi.app/dashboard?x=1");
		});

		it("still serves a connected domain", async () => {
			mocks.customDomainDestination.mockResolvedValue(nadia);
			expect(await (await visit("/"))?.text()).toBe("page");
		});
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
