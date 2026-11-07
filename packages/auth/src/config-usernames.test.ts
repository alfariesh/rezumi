import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { RESERVED_SEGMENTS } from "@rezumi/utils/app-paths";

const mocks = vi.hoisted(() => ({
	betterAuth: vi.fn(),
	/** Rows of `released_username` the lookup finds: none, so only the app's own paths are refused. */
	released: [] as { userId: string }[],
	env: { APP_URL: "http://localhost:3000", AUTH_SECRET: "auth-username-test", FLAG_DISABLE_EMAIL_AUTH: false },
}));

vi.mock("better-auth", async (importOriginal) => ({
	...(await importOriginal<typeof import("better-auth")>()),
	betterAuth: mocks.betterAuth,
}));
vi.mock("@rezumi/db/client", () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.released }) }) }) },
}));
vi.mock("better-auth/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("better-auth/api")>()),
	createAuthMiddleware: (handler: unknown) => handler,
}));
vi.mock("@rezumi/email/transport", () => ({ sendEmail: vi.fn() }));
vi.mock("@rezumi/env/server", () => ({ env: mocks.env }));

type Hook = (ctx: { path: string; body?: Record<string, unknown>; headers?: Headers }) => Promise<unknown>;

async function setUp(session: { user: { id: string; username: string } } | null = null) {
	const instance = {
		$context: Promise.resolve({}),
		api: { getSession: vi.fn().mockResolvedValue(session) },
		handler: vi.fn(),
	};
	mocks.betterAuth.mockReturnValue(instance);
	const config = await import("./config");
	await config.initializeAuth();
	const options = mocks.betterAuth.mock.calls[0]?.[0] as { hooks: { before: Hook } };
	return { before: options.hooks.before, isAppPathUsername: config.isAppPathUsername };
}

const taken = { status: "UNPROCESSABLE_ENTITY", body: expect.objectContaining({ code: "USERNAME_IS_ALREADY_TAKEN" }) };

beforeEach(() => {
	vi.resetModules();
	mocks.betterAuth.mockReset();
	mocks.released.length = 0;
});

describe("usernames the app answers at /<name> itself", () => {
	it("cover its sections, the server's own addresses and the portfolio's", async () => {
		const { isAppPathUsername } = await setUp();
		for (const name of [...RESERVED_SEGMENTS, "cards", "sitemaps", "robots.txt", "sitemap.xml", "Cards ", "API"])
			expect(isAppPathUsername(name), name).toBe(true);
		for (const name of ["nadia", "cards-studio", "my.cards", "docs2"])
			expect(isAppPathUsername(name), name).toBe(false);
	});

	it("can't be taken at sign-up, by either field, and read as unavailable", async () => {
		const { before } = await setUp();
		await expect(before({ path: "/sign-up/email", body: { username: "cards" } })).rejects.toMatchObject(taken);
		await expect(before({ path: "/sign-up/email", body: { displayUsername: "Sitemaps" } })).rejects.toMatchObject(
			taken,
		);
		await expect(before({ path: "/is-username-available", body: { username: "dashboard" } })).rejects.toMatchObject(
			taken,
		);
		await expect(before({ path: "/sign-up/email", body: { username: "nadia" } })).resolves.toBeUndefined();
	});

	it("can't be switched to, but an account that already holds one keeps it", async () => {
		const holder = await setUp({ user: { id: "user-1", username: "cards" } });
		// Saving a profile sends the username unchanged.
		await expect(
			holder.before({ path: "/update-user", body: { name: "Nadia", username: "cards" } }),
		).resolves.toBeUndefined();
		await expect(holder.before({ path: "/update-user", body: { username: "uploads" } })).rejects.toMatchObject(taken);

		vi.resetModules();
		mocks.betterAuth.mockReset();
		const other = await setUp({ user: { id: "user-2", username: "nadia" } });
		await expect(other.before({ path: "/update-user", body: { username: "cards" } })).rejects.toMatchObject(taken);
		await expect(other.before({ path: "/update-user", body: { username: "nadia-studio" } })).resolves.toBeUndefined();
	});
});
