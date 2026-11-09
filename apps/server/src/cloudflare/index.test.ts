import type { CloudflareBindings } from "./index";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import type { CoordinationService } from "@rezumi/db/coordination";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { writePortfolioEvent } from "@rezumi/api/features/portfolio/analytics";
import { getPool } from "@rezumi/db/client";
import worker from "./index";

const mocks = vi.hoisted(() => ({
	run: vi.fn<() => Promise<{ processed: number }>>(),
	billing: vi.fn<() => Promise<{ releasedReservations: number }>>(),
	portfolio: vi.fn<() => Promise<{ deletedFiles: number; checkedPortfolios: number }>>(),
	auth: vi.fn<() => Promise<void>>(),
	wasm: vi.fn<() => Promise<void>>(),
	fetch: vi.fn<(request: Request) => Promise<Response>>(),
	pools: [] as Array<{ ending: boolean; end: () => Promise<void> }>,
	lifetime: ((_promise: Promise<unknown>) => {
		throw new Error("Agent lifetime handler was not configured");
	}) as (promise: Promise<unknown>) => void,
	coordination: undefined as CoordinationService | undefined,
	publicOwner: vi.fn(),
	readPicture: vi.fn(),
	pictureReader: undefined as ((key: string) => Promise<Uint8Array>) | undefined,
	publicPortfolioFile: vi.fn(),
	visitLifetime: undefined as ((promise: Promise<unknown>) => void) | undefined,
}));

vi.mock("pg", () => ({
	Pool: class {
		ending = false;
		end = vi.fn(async () => {
			this.ending = true;
		});
		on = vi.fn(() => this);
		constructor() {
			mocks.pools.push(this);
		}
	},
}));
vi.mock("@rezumi/env/server", () => ({
	env: {
		CLOUDFLARE: true,
		STORAGE_BACKEND: "r2",
		FLAG_DISABLE_IMAGE_PROCESSING: true,
		APP_URL: "https://resume.example",
		DATABASE_URL: "postgresql://synthetic:test@localhost/test",
		DATABASE_POOL_MAX: 1,
		DEPLOYMENT_NAMESPACE: "test",
	},
}));
vi.mock("@formepdf/core/pkg-web/forme_bg.wasm", () => ({ default: new Uint8Array() }));
vi.mock("@formepdf/core/worker", () => ({ init: mocks.wasm }));
vi.mock("@rezumi/auth/config", () => ({ initializeAuth: mocks.auth }));
vi.mock("@rezumi/api/features/career/jobs", () => ({ runCareerJobs: mocks.run }));
vi.mock("@rezumi/api/features/billing/jobs", () => ({ runBillingJobs: mocks.billing }));
vi.mock("@rezumi/api/features/portfolio/jobs", () => ({ runPortfolioJobs: mocks.portfolio }));
vi.mock("@rezumi/api/features/agent/streams", () => ({
	configureAgentStreamLifetime: (lifetime: (promise: Promise<unknown>) => void) => {
		mocks.lifetime = lifetime;
	},
}));
vi.mock("@rezumi/db/coordination", () => ({
	configureCoordination: (coordination: CoordinationService) => {
		mocks.coordination = coordination;
	},
}));
vi.mock("@rezumi/api/features/storage", () => ({
	configureStorageService: vi.fn(),
	getStorageService: () => ({ read: mocks.readPicture }),
	isPublicUploadOwner: mocks.publicOwner,
}));
vi.mock("@rezumi/pdf/server", () => ({
	configureOwnPictureReader: (reader: typeof mocks.pictureReader) => {
		mocks.pictureReader = reader;
	},
}));
vi.mock("@rezumi/api/features/portfolio/public", () => ({ isPublicPortfolioFile: mocks.publicPortfolioFile }));
vi.mock("@rezumi/api/features/portfolio/public-limit", () => ({
	configurePortfolioPublicLimiter: vi.fn(),
	publicPortfolioRequestAllowed: () => Promise.resolve(true),
	tooManyPortfolioRequests: () => new Response(null, { status: 429 }),
}));
vi.mock("../static/portfolio-page", () => ({
	configurePortfolioVisitLifetime: (callback: typeof mocks.visitLifetime) => {
		mocks.visitLifetime = callback;
	},
}));
vi.mock("@rezumi/utils/rate-limit", () => ({ TRUSTED_IP_HEADERS: ["x-real-ip", "x-forwarded-for"] }));
vi.mock("../http/app", () => ({ createApp: () => ({ fetch: mocks.fetch }) }));
vi.mock("./coordination", () => ({ Coordination: class {} }));
vi.mock("./r2", () => ({ R2StorageService: class {} }));

function invocation() {
	const pending: Promise<unknown>[] = [];
	const durableFetch = vi.fn(async () => Response.json("present"));
	const bindings = {
		BUCKET: {},
		HYPERDRIVE: { connectionString: "postgresql://synthetic:test@localhost/invocation" },
		COORDINATION: { idFromName: (key: string) => key, get: () => ({ fetch: durableFetch }) },
	} as unknown as CloudflareBindings;
	const ctx = {
		waitUntil(promise: Promise<unknown>) {
			pending.push(promise);
			// The runtime observes rejections even before a test awaits the invocation.
			void promise.catch(() => undefined);
		},
	} as unknown as ExecutionContext;
	const controller: ScheduledController = { scheduledTime: 0, cron: "* * * * *", noRetry: vi.fn() };
	return { bindings, ctx, controller, pending, durableFetch };
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

function invocationPool() {
	const pool = mocks.pools[0];
	if (!pool) throw new Error("Invocation did not create a pool");
	return pool;
}

beforeEach(() => {
	mocks.pools.length = 0;
	mocks.run.mockReset().mockResolvedValue({ processed: 0 });
	mocks.billing.mockReset().mockResolvedValue({ releasedReservations: 0 });
	mocks.portfolio.mockReset().mockResolvedValue({ deletedFiles: 0, checkedPortfolios: 0 });
	mocks.auth.mockReset().mockResolvedValue();
	mocks.wasm.mockReset().mockResolvedValue();
	mocks.fetch.mockReset().mockResolvedValue(new Response("ok"));
});

describe("portfolio analytics", () => {
	it("writes through the running request's binding, with its country", async () => {
		const { bindings, ctx } = invocation();
		const points: unknown[] = [];
		Object.assign(bindings, { PORTFOLIO_EVENTS: { writeDataPoint: (point: unknown) => points.push(point) } });
		mocks.fetch.mockImplementation(async () => {
			writePortfolioEvent({ portfolioId: "pf1", event: "view", device: "desktop" });
			return new Response("ok");
		});
		const request = Object.assign(new Request("https://resume.example/nadia"), { cf: { country: "ID" } });
		await worker.fetch(request, bindings, ctx);
		expect(points).toEqual([{ indexes: ["pf1"], blobs: ["view", "", "", "", "ID", "desktop"], doubles: [1] }]);
	});
});

describe("Cloudflare invocation lifetime", () => {
	it("rejects a banned owner's picture before reading storage", async () => {
		mocks.publicOwner.mockResolvedValue(false);
		await expect(mocks.pictureReader?.("uploads/banned/pictures/photo.png")).rejects.toThrow("Picture unavailable");
		expect(mocks.publicOwner).toHaveBeenCalledWith("banned");
		expect(mocks.readPicture).not.toHaveBeenCalled();
	});
	it("reads a portfolio picture only while a published portfolio uses it", async () => {
		mocks.publicOwner.mockResolvedValue(true);
		mocks.readPicture.mockReset().mockResolvedValue({ data: new Uint8Array([1]), size: 1 });
		mocks.publicPortfolioFile.mockReset().mockResolvedValue(false);
		const key = "uploads/member/pictures/portfolio/photo.jpg";
		await expect(mocks.pictureReader?.(key)).rejects.toThrow("Picture unavailable");
		expect(mocks.publicPortfolioFile).toHaveBeenCalledWith(key);
		expect(mocks.readPicture).not.toHaveBeenCalled();

		mocks.publicPortfolioFile.mockResolvedValue(true);
		await expect(mocks.pictureReader?.(key)).resolves.toEqual(new Uint8Array([1]));
		// A resume's own picture needs no portfolio check.
		mocks.publicPortfolioFile.mockClear();
		await expect(mocks.pictureReader?.("uploads/member/pictures/photo.jpg")).resolves.toEqual(new Uint8Array([1]));
		expect(mocks.publicPortfolioFile).not.toHaveBeenCalled();
	});

	it("keeps portfolio visit counting alive past the response", () => {
		expect(mocks.visitLifetime).toBeTypeOf("function");
	});

	it("runs scheduled work in its request context and drains nested background work before closing its pool", async () => {
		const fixture = invocation();
		const job = Promise.withResolvers<void>();
		const background = Promise.withResolvers<void>();
		const nested = Promise.withResolvers<void>();
		const nestedStarted = Promise.withResolvers<void>();
		const stages: string[] = [];
		let authPool: unknown;
		let jobPool: unknown;
		let backgroundPool: unknown;
		let coordinationResult: unknown;
		mocks.auth.mockImplementation(async () => {
			authPool = getPool();
			stages.push("auth");
		});
		mocks.wasm.mockImplementation(async () => {
			stages.push("wasm");
		});
		mocks.run.mockImplementation(async () => {
			stages.push("job");
			jobPool = getPool();
			coordinationResult = await mocks.coordination?.get("scheduled-context");
			mocks.lifetime(
				background.promise.then(() => {
					backgroundPool = getPool();
					mocks.lifetime(nested.promise);
					nestedStarted.resolve();
				}),
			);
			await job.promise;
			return { processed: 0 };
		});

		worker.scheduled(fixture.controller, fixture.bindings, fixture.ctx);
		await nextTurn();
		const pool = invocationPool();
		expect(stages).toEqual(["auth", "wasm", "job"]);
		expect(authPool).toBe(pool);
		expect(jobPool).toBe(pool);
		expect(coordinationResult).toBe("present");
		expect(fixture.durableFetch).toHaveBeenCalledOnce();
		expect(pool.end).not.toHaveBeenCalled();
		job.resolve();
		await nextTurn();
		expect(pool.end).not.toHaveBeenCalled();
		background.resolve();
		await nestedStarted.promise;
		await nextTurn();
		expect(backgroundPool).toBe(pool);
		expect(pool.end).not.toHaveBeenCalled();
		nested.resolve();
		await Promise.all(fixture.pending);
		expect(pool.end).toHaveBeenCalledOnce();
	});

	it("runs billing, career, then portfolio jobs on the same pool, and the others still run when billing fails", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const fixture = invocation();
		const order: Array<[string, unknown]> = [];
		mocks.billing.mockImplementation(async () => {
			order.push(["billing", getPool()]);
			throw new Error("Synthetic billing failure");
		});
		mocks.run.mockImplementation(async () => {
			order.push(["career", getPool()]);
			return { processed: 0 };
		});
		mocks.portfolio.mockImplementation(async () => {
			order.push(["portfolio", getPool()]);
			return { deletedFiles: 0, checkedPortfolios: 0 };
		});
		worker.scheduled(fixture.controller, fixture.bindings, fixture.ctx);
		await Promise.all(fixture.pending);
		const pool = invocationPool();
		expect(order).toEqual([
			["billing", pool],
			["career", pool],
			["portfolio", pool],
		]);
		expect(log).toHaveBeenCalledOnce();
		expect(JSON.stringify(log.mock.calls)).not.toContain("Synthetic billing failure");
		expect(pool.end).toHaveBeenCalledOnce();
		log.mockRestore();
	});

	it("retains the pool for background work when the scheduled runner rejects", async () => {
		const fixture = invocation();
		const background = Promise.withResolvers<void>();
		const failure = new Error("Synthetic scheduled failure");
		mocks.run.mockImplementation(async () => {
			mocks.lifetime(background.promise);
			throw failure;
		});
		worker.scheduled(fixture.controller, fixture.bindings, fixture.ctx);
		await nextTurn();
		const pool = invocationPool();
		expect(mocks.run).toHaveBeenCalledOnce();
		expect(pool.end).not.toHaveBeenCalled();
		background.resolve();
		await expect(fixture.pending[0]).rejects.toBe(failure);
		// Portfolio upkeep still ran after career jobs failed.
		expect(mocks.portfolio).toHaveBeenCalledOnce();
		expect(pool.end).toHaveBeenCalledOnce();
	});

	it("closes the invocation pool when initialization fails before scheduled work starts", async () => {
		const fixture = invocation();
		const failure = new Error("Synthetic initialization failure");
		mocks.auth.mockRejectedValue(failure);
		worker.scheduled(fixture.controller, fixture.bindings, fixture.ctx);
		await expect(fixture.pending[0]).rejects.toBe(failure);
		expect(mocks.run).not.toHaveBeenCalled();
		expect(invocationPool().end).toHaveBeenCalledOnce();
	});

	it("keeps the fetch pool open until the response body has been consumed", async () => {
		const fixture = invocation();
		const body = new TransformStream<Uint8Array, Uint8Array>();
		mocks.fetch.mockResolvedValue(new Response(body.readable));
		const response = await worker.fetch(
			new Request("https://resume.example/api/health"),
			fixture.bindings,
			fixture.ctx,
		);
		const pool = invocationPool();
		expect(pool.end).not.toHaveBeenCalled();
		const writer = body.writable.getWriter();
		const text = response.text();
		await writer.write(new TextEncoder().encode("ok"));
		expect(pool.end).not.toHaveBeenCalled();
		await writer.close();
		expect(await text).toBe("ok");
		await Promise.all(fixture.pending);
		expect(pool.end).toHaveBeenCalledOnce();
	});
});
