/** The blog's public origin. Canonical URLs, hreflang links, feeds and structured data are built from it. */
export const SITE_URL = "https://blog.rezumi.app";

/**
 * Google Analytics 4: the same web stream as the app (property "Rezumi", stream "Rezumi web + blog"), so a reader who
 * moves from an article to sign-up stays one visitor. Reports split the two by hostname. The app's copy is
 * `GOOGLE_ANALYTICS_ID` in the root wrangler.jsonc.
 */
export const GOOGLE_ANALYTICS_ID = "G-MWSWTR7JB1";

/** The Rezumi app the blog sends readers to. */
export const APP_URL = "https://rezumi.app";

/**
 * Legal pages, as linked from the app's footer. The source of truth is `LEGAL_URLS` in
 * packages/schema/src/billing/seller.ts; the blog keeps its own copy so it builds and deploys without the app's
 * packages.
 */
export const LEGAL_URLS = {
	privacy: "https://rezumi.app/docs/legal/kebijakan-privasi",
	terms: "https://rezumi.app/docs/legal/syarat-dan-ketentuan",
	contact: "https://rezumi.app/docs/legal/kontak",
} as const;
