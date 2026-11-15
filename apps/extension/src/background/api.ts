/**
 * The service worker's own Rezumi API client, for the little it fetches by itself (the saved posting keys behind the
 * "Saved" marks, the due follow-ups behind the badge count and desktop reminders). Same rules as the panel's
 * (src/sidepanel/api.ts): Bearer token, never cookies, the extension's version header; a 401 refreshes once, a second
 * one ends the connection.
 */
import type { RouterClient } from "@orpc/server";
// @boundaries-ignore type-only import of the server router
import type router from "@rezumi/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { EXTENSION_VERSION, REZUMI_ORIGIN } from "../shared/config";

type TokenSource = {
	accessToken(options?: { force?: boolean }): Promise<string | null>;
	expire(): Promise<void>;
};

export function createWorkerClient(auth: TokenSource): RouterClient<typeof router> {
	const rpcFetch = async (request: Request): Promise<Response> => {
		if (!request.url.startsWith(`${REZUMI_ORIGIN}/api/rpc`)) throw new Error("Unexpected request URL.");
		const body = request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer();
		const send = (token: string | null) => {
			const headers = new Headers(request.headers);
			headers.set("x-rezumi-extension", EXTENSION_VERSION);
			// "Due today" is today in this device's time zone (applications.dueFollowUps).
			headers.set("x-client-timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
			if (token) headers.set("authorization", `Bearer ${token}`);
			return fetch(request.url, { method: request.method, headers, body, credentials: "omit", signal: request.signal });
		};
		const response = await send(await auth.accessToken());
		if (response.status !== 401) return response;
		const retryToken = await auth.accessToken({ force: true });
		if (!retryToken) return response;
		const second = await send(retryToken);
		if (second.status === 401) await auth.expire();
		return second;
	};
	return createORPCClient(new RPCLink({ url: `${REZUMI_ORIGIN}/api/rpc`, fetch: rpcFetch }));
}
