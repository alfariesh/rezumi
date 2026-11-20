import { downloadLogo } from "../applications/logo";
import { readListing } from "./cache";

/**
 * A listing's company logo, served from Rezumi's own address (`/api/jobs/listings/<id>/logo`) instead of linked from
 * the provider's image host: the host doesn't learn who looks at the listing, and the browser may read the picture's
 * colours (the Jobs page tints the open listing with them), which a host without CORS headers would forbid. Fetched
 * with the same checks as a logo copied into an application: public https only, 200 KB, PNG, JPEG or WebP by its bytes.
 */
export async function readListingLogo(
	listingId: string,
	signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	const listing = await readListing(listingId);
	const address = listing?.company.logoUrl;
	if (!address) return null;
	const logo = await downloadLogo(address, { signal });
	return logo.ok ? { bytes: logo.bytes, contentType: logo.contentType } : null;
}
