import type { Page, Route } from "@playwright/test";

/** Answers one oRPC procedure (`billing/checkout`) with the procedure's input; the result is what the server returns. */
export type RpcHandler = (input: unknown) => unknown;

type BatchItem = { url: string; method?: string; headers?: Record<string, string>; body?: unknown };

/** A refusal a handler returns instead of a result, as the server would send it (`SOURCE_FAILED` with 502, say). */
class RpcError {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly message: string,
	) {}
}

export const rpcError = (status: number, code: string, message = code) => new RpcError(status, code, message);

/** A handler's answer: its result with status 200, or the refusal it returned with that refusal's status. */
async function answer(handler: RpcHandler, input: unknown) {
	const result = await handler(input);
	if (result instanceof RpcError) {
		const { status, code, message } = result;
		return { status, body: { json: { defined: true, code, status, message, data: {} }, meta: [] } };
	}
	return { status: 200, body: serialize(result) };
}

/** The oRPC RPC wire format: JSON plus `meta` that marks the values JSON can't hold, here only dates (type 1). */
function serialize(value: unknown) {
	const meta: (string | number)[][] = [];
	const walk = (current: unknown, path: (string | number)[]): unknown => {
		if (current instanceof Date) {
			meta.push([1, ...path]);
			return current.toISOString();
		}
		if (Array.isArray(current)) return current.map((item, index) => walk(item, [...path, index]));
		if (current && typeof current === "object")
			return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, walk(item, [...path, key])]));
		return current;
	};
	return { json: walk(value, []), meta };
}

const inputOf = (body: unknown) => (body && typeof body === "object" && "json" in body ? body.json : undefined);

/** The procedure an RPC address calls: `/api/rpc/billing/checkout` → `billing/checkout`. */
const procedureOf = (url: string) => new URL(url).pathname.replace(/^\/api\/rpc\//, "");

/**
 * Answers the given procedures in the browser instead of the server, so a test never reaches Dodo Payments or needs billing
 * switched on. Everything else still goes to the server. The web client batches calls made together, so a batch is
 * split: mocked items are answered here and the rest are sent on one by one.
 */
export async function mockRpc(page: Page, handlers: Record<string, RpcHandler>) {
	const forward = async (route: Route, item: BatchItem, method: string) => {
		const { "x-orpc-batch": _batch, ...headers } = route.request().headers();
		const response = await route.fetch({
			url: item.url,
			method: item.method ?? method,
			headers: { ...headers, ...item.headers, "content-type": "application/json" },
			...(item.body === undefined ? {} : { postData: JSON.stringify(item.body) }),
		});
		return { status: response.status(), body: await response.json().catch(() => undefined) };
	};

	await page.route("**/api/rpc/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.pathname.endsWith("/__batch__")) {
			const items: BatchItem[] =
				request.method() === "GET" ? JSON.parse(url.searchParams.get("batch") ?? "[]") : request.postDataJSON();
			if (!items.some((item) => handlers[procedureOf(item.url)])) return route.continue();
			const answers = await Promise.all(
				items.map(async (item, index) => {
					const handler = handlers[procedureOf(item.url)];
					if (handler) return { index, ...(await answer(handler, inputOf(item.body))) };
					return { index, ...(await forward(route, item, request.method())) };
				}),
			);
			return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answers) });
		}
		const handler = handlers[procedureOf(request.url())];
		if (!handler) return route.continue();
		const body = request.method() === "GET" ? JSON.parse(url.searchParams.get("data") ?? "{}") : request.postDataJSON();
		const { status, body: payload } = await answer(handler, inputOf(body));
		return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
	});
}
