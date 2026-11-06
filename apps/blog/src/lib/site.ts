/** The blog's public origin. Canonical URLs, hreflang links, feeds and structured data are built from it. */
export const SITE_URL = "https://blog.rezumi.app";

/** The Rezumi app the blog sends readers to. */
export const APP_URL = "https://rezumi.app";

/**
 * Legal pages, as linked from the app's footer. The source of truth is `LEGAL_URLS` in
 * packages/schema/src/billing/seller.ts; the blog keeps its own copy so it builds and deploys without the app's
 * packages.
 */
export const LEGAL_URLS = {
	privacy: "https://docs.rezumi.app/legal/kebijakan-privasi",
	terms: "https://docs.rezumi.app/legal/syarat-dan-ketentuan",
	contact: "https://docs.rezumi.app/legal/kontak",
} as const;
