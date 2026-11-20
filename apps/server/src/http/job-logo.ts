/**
 * `GET /api/jobs/listings/:id/logo`: a job listing's company logo through Rezumi (`@rezumi/api/features/jobs/logo`),
 * for signed-in accounts. Kept a day in the browser's private cache; logos don't change under a listing.
 */

const headers = {
	"X-Content-Type-Options": "nosniff",
	"Content-Security-Policy": "default-src 'none'",
	"Referrer-Policy": "no-referrer",
};

const LISTING_ID = /^[\w-]{1,64}$/;

const notFound = () => new Response("Not Found", { status: 404, headers: { ...headers, "Cache-Control": "no-store" } });

export async function handleJobListingLogo(request: Request, listingId: string) {
	if (!LISTING_ID.test(listingId)) return notFound();
	const { resolveAuthenticationFromRequestHeaders } = await import("@rezumi/api/context");
	const authentication = await resolveAuthenticationFromRequestHeaders(request.headers).catch(() => null);
	if (!authentication)
		return new Response("Unauthorized", { status: 401, headers: { ...headers, "Cache-Control": "no-store" } });
	const { readListingLogo } = await import("@rezumi/api/features/jobs/logo");
	const logo = await readListingLogo(listingId, request.signal).catch(() => null);
	if (!logo) return notFound();
	return new Response(logo.bytes as Uint8Array<ArrayBuffer>, {
		headers: { ...headers, "Content-Type": logo.contentType, "Cache-Control": "private, max-age=86400" },
	});
}
