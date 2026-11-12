import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { abortable, fetchPublic, isPrivateOrLoopbackHost, resolveHostAddresses } from "@rezumi/utils/url-security.node";

/**
 * Reading other sites for a pasted link (`02-teknis.md` section 20): the page itself, a video's oEmbed answer, or a
 * preview picture the owner approved. Only public addresses, every redirect checked again, no cookies or user data,
 * a deadline, and a cap on what is read.
 */

/** Why another site couldn't be read. */
export type RemoteProblem = "unreachable" | "timeout" | "unsafe-url" | "blocked" | "too-large" | "wrong-type";

export class RemoteFetchError extends Error {
	constructor(
		readonly reason: RemoteProblem,
		options?: ErrorOptions,
	) {
		super(`Remote fetch failed: ${reason}`, options);
		this.name = "RemoteFetchError";
	}
}

/**
 * Whether a link may be asked at all, from the address alone: http(s) on the scheme's own port (a port is how probes
 * for internal services look: `:6379`, `:8080`), no credentials, and an allowed host.
 */
function isFetchableUrl(url: URL, isAllowedHost: (hostname: string) => boolean): boolean {
	return /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.port && isAllowedHost(url.hostname);
}

/** One request to one address; redirects come back as they are. Tests swap it for a local server. */
export type RemoteHop = (url: URL, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;

export type RemoteFetchOptions = {
	/** Ends the whole read, redirects included. A `TimeoutError` reason counts as a timeout. */
	signal: AbortSignal;
	accept: string;
	acceptsType: (contentType: string) => boolean;
	maxBytes: number;
	/** Past `maxBytes`: keep what was read (a page's head is all it needs) or refuse (a picture must be whole). */
	overflow: "truncate" | "refuse";
	hop?: RemoteHop | undefined;
	/** Which hosts may be asked; private and loopback addresses never by default. */
	isAllowedHost?: ((hostname: string) => boolean) | undefined;
};

export type RemoteBody = { url: URL; contentType: string; headers: Headers; bytes: Uint8Array; truncated: boolean };

const MAX_REMOTE_REDIRECTS = 3;
// Generic, like any link preview: no account, address or cookie of the person who pasted the link.
const USER_AGENT = "Mozilla/5.0 (compatible; Rezumi; link preview)";
/** Statuses sites answer bots they turn away with. */
const BLOCKED_STATUSES = new Set([401, 403, 407, 429, 451]);

/**
 * The real request. On Node, `fetchPublic` checks every address a name resolves to when it connects, so DNS can't
 * swap in a private one after the check. On Workers the guard is resolving the host first (as `fetchWorkerPublicUrl`
 * does) and refusing private answers; `fetch` then resolves again on its own, which a rebinding name could exploit,
 * but a Worker's outbound requests can't reach private networks in the first place. (`global_fetch_strictly_public`
 * only sends requests for the app's own zone out through the public front door; it isn't an address filter.) A name
 * that resolves to a private address fails like one that doesn't resolve at all (see `toRemoteError`), so the answer
 * never tells which internal names exist.
 */
const publicHop: RemoteHop = async (url, init) => {
	if (process.env.CLOUDFLARE === "1") {
		const addresses = await abortable(resolveHostAddresses(url.hostname), init.signal);
		if (!addresses.length || addresses.some(({ address }) => isPrivateOrLoopbackHost(address)))
			throw new RemoteFetchError("unreachable");
	}
	return fetchPublic(url, { method: "GET", headers: init.headers, signal: init.signal, redirect: "manual" });
};

/**
 * The address as typed, when it's one this may fetch: http(s) on its default port, no credentials, an allowed host;
 * else null.
 */
export function remoteUrl(input: string, isAllowedHost = (hostname: string) => !isPrivateOrLoopbackHost(hostname)) {
	const text = input.trim();
	if (!text || text.length > PORTFOLIO_LIMITS.text.url || /\s/.test(text)) return null;
	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (!url.hostname || !isFetchableUrl(url, isAllowedHost)) return null;
	url.hash = "";
	return url;
}

async function readBody(
	body: ReadableStream<Uint8Array> | null,
	options: Pick<RemoteFetchOptions, "maxBytes" | "overflow" | "signal">,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
	if (!body) return { bytes: new Uint8Array(), truncated: false };
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let truncated = false;
	try {
		for (;;) {
			const { done, value } = await abortable(reader.read(), options.signal);
			if (done) break;
			if (size + value.byteLength > options.maxBytes) {
				if (options.overflow === "refuse") throw new RemoteFetchError("too-large");
				chunks.push(value.subarray(0, options.maxBytes - size));
				size = options.maxBytes;
				truncated = true;
				break;
			}
			chunks.push(value);
			size += value.byteLength;
		}
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let at = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, at);
		at += chunk.byteLength;
	}
	return { bytes, truncated };
}

function toRemoteError(error: unknown, signal: AbortSignal): unknown {
	if (error instanceof RemoteFetchError) return error;
	if (signal.aborted) {
		const reason: unknown = signal.reason;
		if (reason instanceof DOMException && reason.name === "TimeoutError") return new RemoteFetchError("timeout");
		// The caller went away (the request was cancelled): nothing to report to anyone.
		return reason;
	}
	// The address itself was checked before the request, so a refusal from the transport comes from DNS: the name
	// resolved to a private address. It reads as a name that doesn't resolve, which says nothing about the network.
	if (error instanceof Error && error.cause === "unsafe-url")
		return new RemoteFetchError("unreachable", { cause: error });
	// fetchPublic refuses statuses a Response can't hold (LinkedIn answers bots with 999): on Node with its own message,
	// on Workers as the RangeError the Response constructor throws.
	if (
		error instanceof Error &&
		(error.message.startsWith("Invalid response status") ||
			(error instanceof RangeError && /status/i.test(error.message)))
	)
		return new RemoteFetchError("blocked");
	return new RemoteFetchError("unreachable");
}

/**
 * Reads one address, following at most three redirects, each one checked like the first (default port included) and
 * never from https down to http. Refuses anything but a 2xx answer of an accepted type.
 */
export async function fetchRemote(input: URL, options: RemoteFetchOptions): Promise<RemoteBody> {
	const isAllowedHost = options.isAllowedHost ?? ((hostname: string) => !isPrivateOrLoopbackHost(hostname));
	const hop = options.hop ?? publicHop;
	const { signal } = options;
	try {
		let url = input;
		for (let redirects = 0; ; redirects++) {
			signal.throwIfAborted();
			if (!isFetchableUrl(url, isAllowedHost)) throw new RemoteFetchError("unsafe-url");
			const response = await hop(url, {
				signal,
				headers: { accept: options.accept, "accept-language": "en, *;q=0.5", "user-agent": USER_AGENT },
			});
			const location = response.headers.get("location");
			if (response.status >= 300 && response.status < 400 && location) {
				await response.body?.cancel().catch(() => {});
				if (redirects >= MAX_REMOTE_REDIRECTS) throw new RemoteFetchError("unreachable");
				let next: URL;
				try {
					next = new URL(location, url);
				} catch {
					throw new RemoteFetchError("unreachable");
				}
				if (url.protocol === "https:" && next.protocol !== "https:") throw new RemoteFetchError("unsafe-url");
				next.hash = "";
				url = next;
				continue;
			}
			if (response.status < 200 || response.status >= 300) {
				await response.body?.cancel().catch(() => {});
				throw new RemoteFetchError(BLOCKED_STATUSES.has(response.status) ? "blocked" : "unreachable");
			}
			const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
			if (!options.acceptsType(contentType)) {
				await response.body?.cancel().catch(() => {});
				throw new RemoteFetchError("wrong-type");
			}
			const { bytes, truncated } = await readBody(response.body, options);
			return { url, contentType, headers: response.headers, bytes, truncated };
		}
	} catch (error) {
		throw toRemoteError(error, signal);
	}
}

/** The deadline for one remote read, together with the caller's own cancellation when there is one. */
export function remoteDeadline(milliseconds: number, signal?: AbortSignal | undefined): AbortSignal {
	const timeout = AbortSignal.timeout(milliseconds);
	return signal ? AbortSignal.any([timeout, signal]) : timeout;
}
