import type { IconName } from "@rezumi/schema/icons";

/**
 * Sites people link their work from, by domain, with their logo in the resume icon set (`02-teknis.md` section 20).
 * A domain matches itself and its subdomains (`user.medium.com`). Sites without a logo in the set (Canva) get none.
 */
const DOMAIN_ICONS: ReadonlyArray<readonly [string, IconName]> = [
	["behance.net", "behance-01"],
	["dribbble.com", "dribbble"],
	["github.com", "github"],
	["github.io", "github"],
	["gist.github.com", "github"],
	["gitlab.com", "gitlab"],
	["figma.com", "figma"],
	["medium.com", "medium"],
	["linkedin.com", "linkedin-02"],
	["lnkd.in", "linkedin-02"],
	["notion.so", "notion-01"],
	["notion.site", "notion-01"],
	["drive.google.com", "google-drive"],
	["youtube.com", "youtube"],
	["youtu.be", "youtube"],
	["vimeo.com", "vimeo"],
	["codepen.io", "codepen"],
	["codesandbox.io", "codesandbox"],
	["replit.com", "replit"],
	["instagram.com", "instagram"],
	["tiktok.com", "tiktok"],
	["pinterest.com", "pinterest"],
	["x.com", "new-twitter"],
	["twitter.com", "new-twitter"],
	["threads.net", "threads"],
	["threads.com", "threads"],
	["framer.com", "framer"],
	["framer.website", "framer"],
	["webflow.com", "webflow"],
	["webflow.io", "webflow"],
	["wordpress.com", "wordpress"],
	["upwork.com", "upwork"],
	["fiverr.com", "fiverr"],
	["deviantart.com", "deviantart"],
	["flickr.com", "flickr"],
	["unsplash.com", "unsplash"],
	["spotify.com", "spotify"],
	["soundcloud.com", "soundcloud"],
	["twitch.tv", "twitch"],
	["gitbook.io", "gitbook"],
	["dropbox.com", "dropbox"],
	["loom.com", "loom"],
	["trello.com", "trello"],
	["shopify.com", "shopify"],
	["myshopify.com", "shopify"],
	["npmjs.com", "npm"],
	["sketch.com", "sketch"],
];

/** Google Docs addresses say which kind of document they are in their path. */
const GOOGLE_DOCS: ReadonlyArray<readonly [RegExp, IconName]> = [
	[/^\/spreadsheets\//, "google-sheet"],
	[/^\/document\//, "google-doc"],
];

/** The logo of the site a link points to, or undefined for sites without one. */
export function brandIconForUrl(input: string | URL): IconName | undefined {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return undefined;
	}
	const host = url.hostname.toLowerCase().replace(/\.$/, "");
	if (host === "docs.google.com") return GOOGLE_DOCS.find(([path]) => path.test(url.pathname))?.[1] ?? "google-drive";
	// The longest domain wins, so gist.github.com is checked before github.com.
	let best: readonly [string, IconName] | undefined;
	for (const entry of DOMAIN_ICONS) {
		const [domain] = entry;
		if ((host === domain || host.endsWith(`.${domain}`)) && (!best || domain.length > best[0].length)) best = entry;
	}
	return best?.[1];
}
