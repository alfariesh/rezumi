import type {
	AnalyticsEngineDataset,
	DurableObjectNamespace,
	ExecutionContext,
	Fetcher,
	Hyperdrive,
	R2Bucket,
	ScheduledController,
	SendEmail,
} from "@cloudflare/workers-types";
import type { AnalyticsSql } from "@rezumi/api/features/portfolio/analytics";
import type { CoordinationService } from "@rezumi/db/coordination";
import { AsyncLocalStorage } from "node:async_hooks";
import { on } from "node:events";
import { isIP } from "node:net";
import wasm from "@formepdf/core/pkg-web/forme_bg.wasm";
import { init } from "@formepdf/core/worker";
import { Pool } from "pg";
import { configureAgentStreamLifetime } from "@rezumi/api/features/agent/streams";
import { runBillingJobs } from "@rezumi/api/features/billing/jobs";
import { runCareerJobs } from "@rezumi/api/features/career/jobs";
import { runCustomDomainJobs } from "@rezumi/api/features/custom-domain/jobs";
import { configurePortfolioAnalytics } from "@rezumi/api/features/portfolio/analytics";
import { runPortfolioJobs } from "@rezumi/api/features/portfolio/jobs";
import { portfolioFileAccess } from "@rezumi/api/features/portfolio/public";
import { configurePortfolioPublicLimiter } from "@rezumi/api/features/portfolio/public-limit";
import { configureStorageService, getStorageService, isPublicUploadOwner } from "@rezumi/api/features/storage";
import { initializeAuth } from "@rezumi/auth/config";
import { withDatabasePool } from "@rezumi/db/client";
import { configureCoordination } from "@rezumi/db/coordination";
import { configureEmailBinding } from "@rezumi/email/transport";
import { env } from "@rezumi/env/server";
import { configureOwnPictureReader } from "@rezumi/pdf/server";
import { TRUSTED_IP_HEADERS } from "@rezumi/utils/rate-limit";
import { createApp } from "../http/app";
import { configurePortfolioVisitLifetime } from "../static/portfolio-page";
import { configureResvgWasm } from "../static/resvg";
import { R2StorageService } from "./r2";

export { Coordination } from "./coordination";

export type CloudflareBindings = {
	ASSETS: Fetcher;
	HYPERDRIVE: Hyperdrive;
	BUCKET: R2Bucket;
	COORDINATION: DurableObjectNamespace;
	EMAIL?: SendEmail;
	PORTFOLIO_EVENTS?: AnalyticsEngineDataset;
	ANALYTICS_SQL?: AnalyticsSql;
	PORTFOLIO_PUBLIC_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
};

/** `background` holds work that outlives the response, such as assistant runs, and still needs the pool. */
type RequestStore = {
	bindings: CloudflareBindings;
	ctx: ExecutionContext;
	background: Promise<unknown>[];
	/** The visitor's country from Cloudflare, for portfolio statistics only. */
	country?: string | undefined;
};
const requests = new AsyncLocalStorage<RequestStore>();
configureAgentStreamLifetime((promise) => {
	const store = requests.getStore();
	store?.background.push(promise);
	store?.ctx.waitUntil(promise);
});
// Counting a portfolio visit outlives the page's response, like an assistant run.
configurePortfolioVisitLifetime((promise) => {
	const store = requests.getStore();
	store?.background.push(promise);
	store?.ctx.waitUntil(promise);
});
configurePortfolioPublicLimiter(() => requests.getStore()?.bindings.PORTFOLIO_PUBLIC_LIMITER);
// Link-preview cards draw with resvg, whose WebAssembly ships beside the script. It loads when the first card is drawn:
// imported at the top it counts toward the Worker's startup CPU limit, which the upload then failed.
configureResvgWasm(() => import("@resvg/resvg-wasm/index_bg.wasm").then((module) => module.default));
configurePortfolioAnalytics({
	dataset: () => requests.getStore()?.bindings.PORTFOLIO_EVENTS,
	sql: () => requests.getStore()?.bindings.ANALYTICS_SQL,
	country: () => requests.getStore()?.country,
});
configureOwnPictureReader(async (key) => {
	const owner = /^uploads\/([^/]+)\/pictures\//.exec(key)?.[1];
	if (!owner || !(await isPublicUploadOwner(owner))) throw new Error("Picture unavailable");
	// A portfolio picture is readable here only while the uploads route serves it to anyone and caches may keep it: a
	// published portfolio without a visitor password uses it. Otherwise a resume or card could draw an unpublished or
	// locked portfolio's picture by its key.
	if (key.startsWith(`uploads/${owner}/pictures/portfolio/`) && (await portfolioFileAccess(key)) !== "public")
		throw new Error("Picture unavailable");
	const file = await getStorageService().read(key);
	if (!file || file.size > 12_000_000) throw new Error("Picture unavailable or exceeds 12 MB");
	return file.data;
});

const sharedCall = async <T>(key: string, input: object): Promise<T> => {
	const namespace = requests.getStore()?.bindings.COORDINATION;
	if (!namespace) throw new Error("Cloudflare coordination binding is missing");
	const response = await namespace.get(namespace.idFromName(key)).fetch("https://coordination/", {
		method: "POST",
		body: JSON.stringify(input),
	});
	if (!response.ok) throw new Error("Cloudflare coordination is unavailable");
	return response.json<T>();
};
configureCoordination({
	consume: (key, rule) => sharedCall(key, { operation: "consume", ...rule }),
	get: (key) => sharedCall(key, { operation: "get" }),
	set: async (key, value, ttl) => {
		await sharedCall(key, { operation: "set", value, ttl });
	},
	publish: async (key, value) => {
		await sharedCall(key, { operation: "publish", value });
	},
	async *subscribe(key, signal) {
		const namespace = requests.getStore()?.bindings.COORDINATION;
		if (!namespace) throw new Error("Cloudflare coordination binding is missing");
		const response = await namespace
			.get(namespace.idFromName(key))
			.fetch("https://coordination/", { headers: { upgrade: "websocket" } });
		const socket = response.webSocket;
		if (!socket) throw new Error("Cloudflare subscription is unavailable");
		const closed = new AbortController();
		const stopped = signal ? AbortSignal.any([signal, closed.signal]) : closed.signal;
		const messages = on(socket as unknown as EventTarget, "message", { signal: stopped });
		socket.addEventListener("close", () => closed.abort());
		socket.addEventListener("error", () => closed.abort());
		socket.accept();
		try {
			for await (const [event] of messages) {
				const data = (event as MessageEvent).data as unknown;
				if (typeof data === "string") yield data;
			}
		} catch (error) {
			if (!stopped.aborted) throw error;
		} finally {
			socket.close(1000, "Subscription ended");
		}
	},
} satisfies CoordinationService);

const app = createApp({
	serveStatic: false,
	trustedClient: (request) => request.headers.get("x-real-ip") ?? "unknown",
	readWebFile: async (path) => {
		const assetPath = path.includes("dist-prerender/")
			? `/_prerender/${path.split("dist-prerender/")[1]}`
			: "/index.html";
		const response = await requests.getStore()?.bindings.ASSETS.fetch(new URL(assetPath, env.APP_URL).href);
		if (!response?.ok) throw new Error("Web asset is unavailable");
		return response.text();
	},
});

async function closePool(pool: Pool, store: RequestStore) {
	try {
		let settled = 0;
		while (settled < store.background.length) {
			const pending = store.background.slice(settled);
			settled += pending.length;
			await Promise.allSettled(pending);
		}
	} finally {
		await pool.end();
	}
}

const endPool = (pool: Pool, store: RequestStore) => store.ctx.waitUntil(closePool(pool, store));

function createInvocation(bindings: CloudflareBindings, ctx: ExecutionContext, country?: string) {
	if (!env.CLOUDFLARE || env.STORAGE_BACKEND !== "r2" || !env.FLAG_DISABLE_IMAGE_PROCESSING || env.REDIS_URL) {
		throw new Error("Cloudflare requires CLOUDFLARE=1, R2, disabled image processing and no REDIS_URL.");
	}
	configureEmailBinding(bindings.EMAIL as Parameters<typeof configureEmailBinding>[0]);
	configureStorageService(new R2StorageService(bindings.BUCKET, env.DEPLOYMENT_NAMESPACE));
	const pool = new Pool({
		connectionString: bindings.HYPERDRIVE.connectionString,
		max: 1,
		connectionTimeoutMillis: 10_000,
	});
	const logError = (error: Error) => {
		if (!pool.ending) console.error("[cloudflare] Database connection failed", error.message);
	};
	pool.on("error", logError);
	pool.on("connect", (client) => client.on("error", logError));
	const store: RequestStore = { bindings, ctx, background: [], country };
	return {
		pool,
		store,
		run: <T>(callback: () => T) =>
			requests.run(store, () =>
				withDatabasePool(pool, async () => {
					await initializeAuth();
					await init(wasm);
					return callback();
				}),
			),
	};
}

/** Keep the request's pool alive until streaming and background work finish, including client cancellation. */
function closePoolAfterResponse(response: Response, pool: Pool, store: RequestStore): Response {
	let closed = false;
	const close = () => {
		if (!closed) {
			closed = true;
			endPool(pool, store);
		}
	};
	const run = <T>(callback: () => T) => requests.run(store, () => withDatabasePool(pool, callback));
	if (!response.body) {
		close();
		return response;
	}
	const reader = response.body.getReader();
	return new Response(
		new ReadableStream<Uint8Array>({
			pull(controller) {
				return run(async () => {
					try {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							close();
						} else controller.enqueue(value);
					} catch (error) {
						controller.error(error);
						close();
					}
				});
			},
			cancel(reason) {
				return run(async () => {
					try {
						await reader.cancel(reason);
					} finally {
						close();
					}
				});
			},
		}),
		response,
	);
}

export default {
	async fetch(request: Request, bindings: CloudflareBindings, ctx: ExecutionContext): Promise<Response> {
		if (new URL(request.url).pathname.startsWith("/_prerender")) return new Response("Not Found", { status: 404 });
		const headers = new Headers(request.headers);
		const ip = headers.get("cf-connecting-ip");
		for (const name of TRUSTED_IP_HEADERS) headers.delete(name);
		if (ip && isIP(ip)) {
			headers.set("x-real-ip", ip);
			headers.set("x-forwarded-for", ip);
		}
		const { country } = (request as Request & { cf?: { country?: string } }).cf ?? {};
		const { pool, store, run } = createInvocation(bindings, ctx, country);
		try {
			const response = await run(() => app.fetch(new Request(request, { headers })));
			return closePoolAfterResponse(response, pool, store);
		} catch (error) {
			endPool(pool, store);
			throw error;
		}
	},
	scheduled(_controller: ScheduledController, bindings: CloudflareBindings, ctx: ExecutionContext): void {
		const { pool, store, run } = createInvocation(bindings, ctx);
		// Billing first: its work is short. A failure there never keeps career jobs from running. Portfolio file
		// cleanup goes last (it can wait), and runs whatever happened to career jobs.
		const jobs = async () => {
			await runBillingJobs().catch(() => console.error("[billing] Scheduled work failed; it retries next run."));
			try {
				return await runCareerJobs();
			} finally {
				await runPortfolioJobs().catch(() => console.error("[portfolio] Scheduled work failed; it retries next run."));
				await runCustomDomainJobs().catch(() =>
					console.error("[custom-domain] Scheduled work failed; it retries next run."),
				);
			}
		};
		ctx.waitUntil(run(jobs).finally(() => closePool(pool, store)));
	},
};
