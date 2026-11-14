/**
 * The panel's typed Rezumi API (02-teknis.md §1, §8): oRPC over `/api/rpc` with the service worker's access token as
 * `Authorization: Bearer`, never cookies (`credentials: "omit"`: the server refuses cookie requests from another
 * origin), and the extension's version in `x-rezumi-extension` so the server can ask an old one to update.
 */
import type { MessageResults, PanelMessage } from "../shared/messages";
import type { InferRouterOutputs, RouterClient } from "@orpc/server";
// The server router is a type-only peer dependency, as in apps/mobile/src/api/client.ts; the extension override in
// the root vite.config.ts rejects value imports from it.
// @boundaries-ignore type-only import of the server router
import type router from "@rezumi/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { EXTENSION_VERSION, REZUMI_ORIGIN } from "../shared/config";

/** Sends one message to the service worker and returns its answer, or throws when it refused or failed. */
export async function askWorker<T extends PanelMessage>(message: T): Promise<MessageResults[T["type"]]> {
	const response = (await chrome.runtime.sendMessage(message)) as
		| { ok: true; data: MessageResults[T["type"]] }
		| { ok: false; error: string }
		| undefined;
	if (!response?.ok) throw new Error(`The extension could not answer (${response?.error ?? "no answer"}).`);
	return response.data;
}

/** The browser is offline, or a token refresh could not reach Rezumi. */
export class OfflineError extends Error {
	constructor() {
		super("Offline");
		this.name = "OfflineError";
	}
}

const tokenFromWorker = async (force: boolean) => {
	const { accessToken, offline } = await askWorker({ type: "token", force });
	if (offline) throw new OfflineError();
	return accessToken;
};

/**
 * Sends a request with the current token. A 401 to it refreshes once and retries; a second 401 means the server no
 * longer accepts this connection (access revoked in Rezumi's settings), and the panel goes back to "Connect again".
 */
async function rpcFetch(request: Request): Promise<Response> {
	if (!request.url.startsWith(`${REZUMI_ORIGIN}/api/rpc`)) throw new Error("Unexpected request URL.");
	const body = request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer();
	const send = (token: string | null) => {
		const headers = new Headers(request.headers);
		headers.set("x-rezumi-extension", EXTENSION_VERSION);
		headers.set("x-client-timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
		if (token) headers.set("authorization", `Bearer ${token}`);
		return fetch(request.url, { method: request.method, headers, body, credentials: "omit", signal: request.signal });
	};

	let response: Response;
	try {
		response = await send(await tokenFromWorker(false));
	} catch (error) {
		if (error instanceof TypeError || !navigator.onLine) throw new OfflineError();
		throw error;
	}
	if (response.status !== 401) return response;
	const retryToken = await tokenFromWorker(true);
	if (!retryToken) return response;
	const second = await send(retryToken);
	if (second.status === 401) await askWorker({ type: "expire" });
	return second;
}

export const client: RouterClient<typeof router> = createORPCClient(
	new RPCLink({ url: `${REZUMI_ORIGIN}/api/rpc`, fetch: rpcFetch }),
);

/** TanStack Query helpers: `orpc.billing.summary.queryOptions()` and friends. */
export const orpc = createTanstackQueryUtils(client);

export type RouterOutput = InferRouterOutputs<typeof router>;
