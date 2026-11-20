/**
 * Size limits on what the browser extension reads from a page. Plain constants (no Zod), so the extension's content
 * script can import them without shipping Zod.
 */

/**
 * The most posting text the extension sends and the server keeps: the server's web reader cap (MAX_CONTENT_CHARS in
 * packages/api/src/features/web/contracts.ts; a test there keeps the two equal).
 */
export const MAX_CAPTURE_TEXT_CHARS = 20_000;

/** At most this many JSON-LD blocks of at most this many characters each are read from a page. */
export const MAX_JSON_LD_BLOCKS = 5;
export const MAX_JSON_LD_CHARS = 50_000;
