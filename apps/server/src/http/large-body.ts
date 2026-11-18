import type { RequestAuthentication } from "@rezumi/api/context";
import { ORPCError } from "@orpc/server";
import { resolveAuthenticationFromRequestHeaders } from "@rezumi/api/context";

/**
 * The largest body RPC and REST read before knowing who sent it. oRPC buffers and decodes a whole body (JSON, forms,
 * batches) before any procedure checks credentials or input sizes, and a few MB of JSON can grow many times over in
 * memory: a Worker isolate has 128 MB, shared with other requests. Procedures anyone may call take small inputs, so a
 * larger body is read only once its sender has signed in.
 */
export const ANONYMOUS_BODY_LIMIT = 1024 * 1024;

/** The ATS check is public and takes a PDF of up to 25 MB, as a multipart upload (a file part, not JSON). */
const PUBLIC_UPLOADS: readonly { path: string; maxSize: number }[] = [
	{ path: "/api/openapi/pdf-checks", maxSize: 26 * 1024 * 1024 },
];

const reply = (status: 401 | 403, code: string, message: string) =>
	Response.json({ defined: false, code, status, message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Null when the request may go on to the handler; otherwise the refusal, decided from its headers alone (its body is
 * never read here). A body that doesn't say its length counts as large.
 */
export async function guardLargeBody(
	request: Request,
	resolve: (headers: Headers) => Promise<RequestAuthentication | null> = resolveAuthenticationFromRequestHeaders,
): Promise<Response | null> {
	if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
	const declared = request.headers.get("content-length");
	const length = declared !== null && /^\d+$/.test(declared) ? Number(declared) : Number.POSITIVE_INFINITY;
	if (length <= ANONYMOUS_BODY_LIMIT) return null;
	const pathname = new URL(request.url).pathname;
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (
		contentType.startsWith("multipart/form-data") &&
		PUBLIC_UPLOADS.some((upload) => upload.path === pathname && length <= upload.maxSize)
	)
		return null;
	try {
		if (await resolve(request.headers)) return null;
	} catch (error) {
		if (error instanceof ORPCError && error.code === "FORBIDDEN") return reply(403, "FORBIDDEN", error.message);
		throw error;
	}
	return reply(401, "UNAUTHORIZED", "Sign in to send a request this large.");
}
