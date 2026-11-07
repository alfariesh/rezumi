/** A picture uploaded to this app: a resume photo (`pictures/<file>`) or one of a portfolio's (`pictures/portfolio/`). */
const OWN_PICTURE_PATH = /^\/(?:api\/)?uploads\/[\w-]+\/pictures\/(?:portfolio\/)?[\w-]+\.(?:png|jpe?g|webp|gif)$/i;

/**
 * The address of a picture a portfolio page may show, or undefined: only an upload served from one of `origins` (the
 * app's own origin and its alias), without query, hash or credentials. A page visit never asks another site for
 * anything, so a resume photo kept elsewhere (an imported link) isn't shown (`02-teknis.md` section 20). The server's
 * page and the editor's preview both decide with this, so the preview shows what the page will.
 */
export function ownPictureUrl(source: string, origins: readonly string[]): string | undefined {
	const [base] = origins;
	if (!base) return undefined;
	let url: URL;
	try {
		url = new URL(source.trim(), base);
	} catch {
		return undefined;
	}
	if (!origins.includes(url.origin) || url.search || url.hash || url.username || url.password) return undefined;
	return OWN_PICTURE_PATH.test(url.pathname) ? url.href : undefined;
}
