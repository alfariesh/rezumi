import type { RemoteHop } from "../../portfolio/remote";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { defaultResumeData } from "@rezumi/schema/resume/default";

/**
 * The sources with every outbound call faked: Apify and GitHub through `fetch`, websites through the web reader, AI
 * through the metered runner, photos through a fake hop, storage and the database through stand-ins. Nothing here
 * reaches the network.
 */

const fixtures = vi.hoisted(() => ({
	env: {
		APP_URL: "https://rezumi.test",
		APIFY_TOKEN: "apify-secret-token" as string | undefined,
		APIFY_LINKEDIN_ACTOR: "harvestapi~linkedin-profile-scraper",
		GITHUB_API_TOKEN: undefined as string | undefined,
		FLAG_DISABLE_API_RATE_LIMIT: false,
	},
	user: { name: "Dewi Lestari", email: "dewi@example.test", image: null as string | null, isAnonymous: false },
	logins: [] as { providerId: string; accountId: string }[],
	aiRuns: [] as { action: string; outcome: "succeeded" | "failed" }[],
}));

vi.mock("@rezumi/env/server", () => ({ env: fixtures.env }));

vi.mock("@rezumi/db/client", async () => {
	const schema = await vi.importActual<typeof import("@rezumi/db/schema")>("@rezumi/db/schema");
	const rows = (table: unknown) => (table === schema.user ? [fixtures.user] : fixtures.logins);
	return {
		db: {
			select: () => ({
				from: (table: unknown) => ({
					where: () => {
						const result = Promise.resolve(rows(table));
						return Object.assign(result, { limit: () => result });
					},
				}),
			}),
		},
	};
});

vi.mock("../../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});

vi.mock("../../../redis", async () => {
	const { MemoryRatelimiter } = await vi.importActual<typeof import("@orpc/experimental-ratelimit/memory")>(
		"@orpc/experimental-ratelimit/memory",
	);
	return {
		createRateLimiter: (_name: string, config: { maxRequests: number; window: number }) =>
			new MemoryRatelimiter(config),
	};
});

vi.mock("@rezumi/auth/config", () => ({ providerAccessToken: vi.fn(async () => null) }));
vi.mock("../../web-access/service", () => ({ readPage: vi.fn() }));
vi.mock("../../web-access/credentials", () => ({ webAccessService: { resolve: vi.fn(async () => null) } }));
vi.mock("../../ai/service", () => ({ aiService: { parseWebsite: vi.fn() } }));
vi.mock("../../billing/metered-ai", () => ({
	runWithAiSource: async (request: { action: string }, work: (ai: { model: string }) => Promise<unknown>) => {
		try {
			const result = await work({ model: "test-model" });
			fixtures.aiRuns.push({ action: request.action, outcome: "succeeded" });
			return result;
		} catch (error) {
			fixtures.aiRuns.push({ action: request.action, outcome: "failed" });
			throw error;
		}
	},
}));
vi.mock("../../storage/service", () => ({
	isImageFile: (type: string) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type),
	processImageForUpload: vi.fn(async (file: File) => ({
		data: new Uint8Array(await file.arrayBuffer()),
		contentType: "image/jpeg",
	})),
	uploadFile: vi.fn(async ({ userId }: { userId: string }) => ({
		key: `uploads/${userId}/pictures/copy.jpg`,
		url: `https://rezumi.test/api/uploads/${userId}/pictures/copy.jpg`,
	})),
}));

const { providerAccessToken } = await import("@rezumi/auth/config");
const { readPage } = await import("../../web-access/service");
const { aiService } = await import("../../ai/service");
const { uploadFile } = await import("../../storage/service");
const { WebAccessError } = await import("../../web-access/contracts");
const { profileSourcesRouter } = await import("./router");
const { adoptPhoto, isPhotoHost } = await import("./photo");

let userCount = 0;
/** Each test is its own account, so the daily limits of one never reach another. */
function client() {
	const id = `user-${++userCount}`;
	return { id, call: createRouterClient(profileSourcesRouter, { context: { user: { id } } as never }) };
}

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
	fixtures.env.APIFY_TOKEN = "apify-secret-token";
	fixtures.env.GITHUB_API_TOKEN = undefined;
	fixtures.user.isAnonymous = false;
	fixtures.user.image = null;
	fixtures.logins = [];
	fixtures.aiRuns = [];
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// A fictional person in the scraper's shape.
const linkedInProfile = {
	publicIdentifier: "dewi-lestari-example",
	linkedinUrl: "https://www.linkedin.com/in/dewi-lestari-example",
	firstName: "Dewi",
	lastName: "Lestari",
	headline: "Product designer",
	photo: "https://media.licdn.com/dms/image/photo-800?e=1",
	experience: [
		{
			position: "Designer",
			companyName: "Kopi Nusantara",
			startDate: { month: "Jan", year: 2024 },
			endDate: { text: "Present" },
		},
	],
	sectionTotals: { experience: 1 },
	status: 200,
};

describe("profile.sources.linkedin", () => {
	it("runs the actor without email search and returns a draft, the photo apart", async () => {
		fetchMock.mockResolvedValueOnce(json([linkedInProfile], 201));
		const { call } = client();

		const result = await call.linkedin({ url: "https://www.linkedin.com/in/dewi-lestari-example/" });

		expect(result.data.basics).toMatchObject({ name: "Dewi Lestari", headline: "Product designer" });
		expect(result.data.sections.experience).toEqual([
			expect.objectContaining({ company: "Kopi Nusantara", position: "Designer" }),
		]);
		expect(result.data.picture.url).toBe("");
		expect(result.photoUrl).toBe("https://media.licdn.com/dms/image/photo-800?e=1");
		expect(result.notes).toEqual([]);

		const [address, init] = fetchMock.mock.calls[0] ?? [];
		const url = new URL(String(address));
		expect(url.origin + url.pathname).toBe(
			"https://api.apify.com/v2/acts/harvestapi~linkedin-profile-scraper/run-sync-get-dataset-items",
		);
		expect(url.searchParams.get("timeout")).toBe("60");
		expect(Number(url.searchParams.get("maxTotalChargeUsd"))).toBeLessThanOrEqual(0.05);
		expect(String(address)).not.toContain("apify-secret-token");
		expect(new Headers(init?.headers).get("authorization")).toBe("Bearer apify-secret-token");
		expect(JSON.parse(String(init?.body))).toEqual({
			profileScraperMode: "Profile details no email ($4 per 1k)",
			queries: ["https://www.linkedin.com/in/dewi-lestari-example"],
		});
	});

	it("refuses another site's address before calling anything", async () => {
		const { call } = client();
		await expect(call.linkedin({ url: "https://example.com/in/dewi" })).rejects.toMatchObject({
			code: "SOURCE_INVALID",
			status: 400,
		});
		await expect(call.linkedin({ url: "https://www.linkedin.com/company/kopi" })).rejects.toMatchObject({
			code: "SOURCE_INVALID",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("says when no profile was found", async () => {
		fetchMock.mockResolvedValueOnce(json([], 201));
		fetchMock.mockResolvedValueOnce(json([{ status: 404, error: "Profile not found" }], 201));
		const { call } = client();
		await expect(call.linkedin({ url: "linkedin.com/in/nobody-here" })).rejects.toMatchObject({
			code: "SOURCE_NOT_FOUND",
			status: 404,
		});
		await expect(call.linkedin({ url: "linkedin.com/in/nobody-here" })).rejects.toMatchObject({
			code: "SOURCE_NOT_FOUND",
		});
	});

	it("reports a provider failure or timeout without the token", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		fetchMock.mockResolvedValueOnce(json({ error: { type: "not-enough-usage-to-run-paid-actor" } }, 402));
		fetchMock.mockResolvedValueOnce(json({ error: { type: "run-timeout-exceeded" } }, 408));
		fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
		const { call } = client();

		for (let attempt = 0; attempt < 3; attempt++) {
			const error = await call.linkedin({ url: "dewi-lestari-example" }).catch((caught: unknown) => caught);
			expect(error).toMatchObject({ code: "SOURCE_FAILED", status: 502 });
			expect(JSON.stringify(error)).not.toContain("apify-secret-token");
			expect((error as Error).message).not.toContain("apify-secret-token");
		}
		expect(JSON.stringify(warn.mock.calls)).not.toContain("apify-secret-token");
		warn.mockRestore();
	});

	it("allows three reads per account per day", async () => {
		fetchMock.mockImplementation(async () => json([linkedInProfile], 201));
		const { call } = client();
		for (let read = 0; read < 3; read++) await call.linkedin({ url: "dewi-lestari-example" });
		await expect(call.linkedin({ url: "dewi-lestari-example" })).rejects.toMatchObject({
			code: "SOURCE_LIMIT",
			status: 429,
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
		// Another account has its own reads.
		await expect(client().call.linkedin({ url: "dewi-lestari-example" })).resolves.toBeDefined();
	});

	it("refuses guests and servers without an Apify token", async () => {
		fixtures.user.isAnonymous = true;
		await expect(client().call.linkedin({ url: "dewi-lestari-example" })).rejects.toMatchObject({
			code: "SOURCE_UNAVAILABLE",
			status: 409,
		});
		fixtures.user.isAnonymous = false;
		fixtures.env.APIFY_TOKEN = undefined;
		await expect(client().call.linkedin({ url: "dewi-lestari-example" })).rejects.toMatchObject({
			code: "SOURCE_UNAVAILABLE",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

const gitHubUser = {
	login: "budi-example",
	name: "Budi Santoso",
	bio: "Builds APIs.",
	html_url: "https://github.com/budi-example",
};
const gitHubRepo = {
	name: "ledger",
	description: "A tiny ledger.",
	html_url: "https://github.com/budi-example/ledger",
	language: "Go",
	fork: false,
	archived: false,
	stargazers_count: 4,
	pushed_at: "2026-05-01T00:00:00Z",
	owner: { login: "budi-example" },
};

function gitHubAnswers(answers: Record<string, () => Response>) {
	fetchMock.mockImplementation(async (input) => {
		const url = new URL(String(input));
		const answer = answers[url.pathname];
		return answer ? answer() : json({ message: "Not Found" }, 404);
	});
}

describe("profile.sources.github", () => {
	it("reads the account and its own repositories", async () => {
		gitHubAnswers({
			"/users/budi-example": () => json(gitHubUser),
			"/users/budi-example/repos": () => json([gitHubRepo, { ...gitHubRepo, name: "copy", fork: true }]),
		});
		const result = await client().call.github({ username: "@budi-example" });

		expect(result.data.basics.name).toBe("Budi Santoso");
		expect(result.data.sections.projects.map((project) => project.name)).toEqual(["ledger"]);
		expect(result.data.sections.skills.map((skill) => skill.name)).toEqual(["Go"]);
		expect(result.notes).toEqual([]);
		const reposUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
		expect(reposUrl.searchParams.get("type")).toBe("owner");
		expect(reposUrl.searchParams.get("sort")).toBe("pushed");
		expect(reposUrl.searchParams.get("per_page")).toBe("100");
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBeNull();
	});

	it("uses the account's own GitHub token, and notes an account without repositories", async () => {
		vi.mocked(providerAccessToken).mockResolvedValueOnce("gho_own_token");
		gitHubAnswers({
			"/users/budi-example": () => json(gitHubUser),
			"/users/budi-example/repos": () => json([]),
		});
		const result = await client().call.github({ username: "budi-example" });

		expect(result.notes).toEqual(["no-public-repos"]);
		expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("authorization")).toBe("Bearer gho_own_token");
	});

	it("says when the account doesn't exist, and refuses what isn't a username", async () => {
		gitHubAnswers({});
		const { call } = client();
		await expect(call.github({ username: "nobody-here" })).rejects.toMatchObject({ code: "SOURCE_NOT_FOUND" });
		await expect(call.github({ username: "not a username" })).rejects.toMatchObject({ code: "SOURCE_INVALID" });
		await expect(call.github({ username: "https://gitlab.com/budi" })).rejects.toMatchObject({
			code: "SOURCE_INVALID",
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("reports GitHub's rate limit, failures and timeouts", async () => {
		gitHubAnswers({ "/users/budi-example": () => json({ message: "API rate limit exceeded" }, 403) });
		const { call } = client();
		await expect(call.github({ username: "budi-example" })).rejects.toMatchObject({
			code: "SOURCE_FAILED",
			status: 502,
		});
		fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
		await expect(call.github({ username: "budi-example" })).rejects.toMatchObject({ code: "SOURCE_FAILED" });
	});

	it("allows ten reads per account per day, guests included", async () => {
		fixtures.user.isAnonymous = true;
		gitHubAnswers({
			"/users/budi-example": () => json(gitHubUser),
			"/users/budi-example/repos": () => json([gitHubRepo]),
		});
		const { call } = client();
		for (let read = 0; read < 10; read++) await call.github({ username: "budi-example" });
		await expect(call.github({ username: "budi-example" })).rejects.toMatchObject({
			code: "SOURCE_LIMIT",
			status: 429,
		});
	});
});

describe("profile.sources.website", () => {
	const page = (overrides: Record<string, unknown> = {}) => ({
		requestedUrl: "https://dewi.example/",
		content: "Dewi Lestari, product designer in Bandung.",
		format: "text",
		retrievedAt: new Date().toISOString(),
		method: "builtin",
		truncated: false,
		completeness: "unknown",
		...overrides,
	});
	const found = () => {
		const data = structuredClone(defaultResumeData);
		data.basics.name = "Dewi Lestari";
		data.basics.headline = "Product designer";
		return data;
	};

	it("reads the page and has AI turn it into a draft, on the profile-website credits", async () => {
		vi.mocked(readPage).mockResolvedValueOnce(page({ truncated: true }) as never);
		vi.mocked(aiService.parseWebsite).mockResolvedValueOnce(found());

		const result = await client().call.website({ url: "dewi.example", aiSource: "rezumi", idempotencyKey: "k1" });

		expect(result.data.basics).toMatchObject({ name: "Dewi Lestari", headline: "Product designer" });
		expect(result.notes).toEqual(["truncated"]);
		expect(vi.mocked(readPage).mock.lastCall?.[0]).toBe("https://dewi.example/");
		expect(vi.mocked(aiService.parseWebsite).mock.lastCall?.[0]).toMatchObject({
			languageModel: "test-model",
			text: "Dewi Lestari, product designer in Bandung.",
		});
		expect(fixtures.aiRuns).toEqual([{ action: "profile-website", outcome: "succeeded" }]);
	});

	it("gives the credits back when the page says nothing about a person", async () => {
		vi.mocked(readPage).mockResolvedValueOnce(page() as never);
		vi.mocked(aiService.parseWebsite).mockResolvedValueOnce(structuredClone(defaultResumeData));
		await expect(client().call.website({ url: "https://dewi.example" })).rejects.toMatchObject({
			code: "SOURCE_NOT_FOUND",
		});
		expect(fixtures.aiRuns).toEqual([{ action: "profile-website", outcome: "failed" }]);
	});

	it("maps the reader's failures and gives the credits back", async () => {
		const { call } = client();
		vi.mocked(readPage).mockRejectedValueOnce(new WebAccessError("unreachable"));
		await expect(call.website({ url: "https://gone.example" })).rejects.toMatchObject({ code: "SOURCE_NOT_FOUND" });
		vi.mocked(readPage).mockRejectedValueOnce(new WebAccessError("unsafe-url"));
		await expect(call.website({ url: "https://intranet.example" })).rejects.toMatchObject({ code: "SOURCE_INVALID" });
		vi.mocked(readPage).mockRejectedValueOnce(new WebAccessError("timeout"));
		await expect(call.website({ url: "https://slow.example" })).rejects.toMatchObject({ code: "SOURCE_FAILED" });
		await expect(call.website({ url: "not a web address" })).rejects.toMatchObject({ code: "SOURCE_INVALID" });
		expect(fixtures.aiRuns.map((run) => run.outcome)).toEqual(["failed", "failed", "failed"]);
		expect(aiService.parseWebsite).not.toHaveBeenCalled();
	});

	it("refuses guests", async () => {
		fixtures.user.isAnonymous = true;
		await expect(client().call.website({ url: "https://dewi.example" })).rejects.toMatchObject({
			code: "SOURCE_UNAVAILABLE",
		});
		expect(readPage).not.toHaveBeenCalledWith("https://dewi.example/", expect.anything());
	});
});

describe("profile.sources.status", () => {
	it("tells an account with GitHub sign-in what it can use", async () => {
		fixtures.user.image = "https://avatars.githubusercontent.com/u/42?v=4";
		fixtures.logins = [
			{ providerId: "github", accountId: "42" },
			{ providerId: "google", accountId: "g-1" },
		];
		fetchMock.mockImplementation(async (input) =>
			String(input) === "https://api.github.com/user/42" ? json({ login: "dewi-gh" }) : json({}, 404),
		);

		await expect(client().call.status()).resolves.toEqual({
			linkedin: true,
			github: true,
			website: true,
			account: {
				name: "Dewi Lestari",
				email: "dewi@example.test",
				image: "https://avatars.githubusercontent.com/u/42?v=4",
				githubUsername: "dewi-gh",
				providers: ["github", "google"],
			},
		});
	});

	it("offers a guest GitHub only, and LinkedIn only with an Apify token", async () => {
		fixtures.user.isAnonymous = true;
		const guest = await client().call.status();
		expect(guest).toMatchObject({ linkedin: false, github: true, website: false, account: { name: "", email: "" } });

		fixtures.user.isAnonymous = false;
		fixtures.env.APIFY_TOKEN = undefined;
		expect(await client().call.status()).toMatchObject({ linkedin: false, website: true });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("profile.sources.adoptPhoto", () => {
	const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
	const hop = (answer: (url: URL) => Response) => vi.fn<RemoteHop>(async (url) => answer(url));

	it("copies a photo from a known host into the account's uploads", async () => {
		const fetchPhoto = hop(() => new Response(image, { headers: { "content-type": "image/jpeg" } }));
		const result = await adoptPhoto("user-photo", "https://media.licdn.com/dms/image/photo-400?e=1", {
			hop: fetchPhoto,
		});
		expect(result).toEqual({ url: "https://rezumi.test/api/uploads/user-photo/pictures/copy.jpg" });
		expect(fetchPhoto).toHaveBeenCalledOnce();
		expect(vi.mocked(uploadFile).mock.lastCall?.[0]).toMatchObject({ userId: "user-photo", contentType: "image/jpeg" });
	});

	it("returns the app's own uploads as they are", async () => {
		const own = "https://rezumi.test/api/uploads/user-photo/pictures/a.jpg";
		await expect(adoptPhoto("user-photo", own)).resolves.toEqual({ url: own });
		await expect(adoptPhoto("user-photo", "/api/uploads/user-photo/pictures/a.jpg")).resolves.toEqual({
			url: "/api/uploads/user-photo/pictures/a.jpg",
		});
	});

	it("refuses other hosts, plain http, redirects away and what isn't a picture", async () => {
		const fetchPhoto = hop(() => new Response(image, { headers: { "content-type": "image/jpeg" } }));
		const { call } = client();
		await expect(call.adoptPhoto({ url: "https://evil.example/photo.jpg" })).rejects.toMatchObject({
			code: "SOURCE_INVALID",
		});
		await expect(call.adoptPhoto({ url: "http://media.licdn.com/photo.jpg" })).rejects.toMatchObject({
			code: "SOURCE_INVALID",
		});
		await expect(
			adoptPhoto("user-photo", "https://rezumi.test.evil.example/api/uploads/x.jpg", { hop: fetchPhoto }),
		).rejects.toMatchObject({ code: "SOURCE_INVALID" });

		const redirect = hop(
			() => new Response(null, { status: 302, headers: { location: "https://evil.example/x.jpg" } }),
		);
		await expect(
			adoptPhoto("user-photo", "https://avatars.githubusercontent.com/u/42", { hop: redirect }),
		).rejects.toMatchObject({ code: "SOURCE_INVALID" });

		const page = hop(() => new Response("<html></html>", { headers: { "content-type": "text/html" } }));
		await expect(
			adoptPhoto("user-photo", "https://lh3.googleusercontent.com/a/photo", { hop: page }),
		).rejects.toMatchObject({ code: "SOURCE_INVALID" });
		expect(fetchPhoto).not.toHaveBeenCalled();
		expect(uploadFile).not.toHaveBeenCalled();
	});

	it("knows the photo hosts", () => {
		expect(isPhotoHost("media.licdn.com")).toBe(true);
		expect(isPhotoHost("avatars.githubusercontent.com")).toBe(true);
		expect(isPhotoHost("lh3.googleusercontent.com")).toBe(true);
		expect(isPhotoHost("googleusercontent.com.evil.example")).toBe(false);
		expect(isPhotoHost("licdn.com")).toBe(false);
	});
});
