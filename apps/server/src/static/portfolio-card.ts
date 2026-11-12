import type { PortfolioViewImage } from "@rezumi/portfolio/view";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { findPublicPortfolio } from "@rezumi/api/features/portfolio/public";
import { publicPortfolioRequestAllowed, tooManyPortfolioRequests } from "@rezumi/api/features/portfolio/public-limit";
import { env } from "@rezumi/env/server";
import { CARD_WIDTH, resumeCardSvg } from "@rezumi/pdf/web-page-card";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { matchesIfNoneMatch } from "@rezumi/utils/http";
import { publicPortfolioView } from "./portfolio-page";

let ready: Promise<void> | undefined;
const initialize = () =>
	(ready ??= readFile(fileURLToPath(import.meta.resolve("@resvg/resvg-wasm/index_bg.wasm"))).then((bytes) =>
		initWasm(bytes),
	));

// Recent cards by what they draw; crawlers fetch a card once per share, so a small cache covers bursts.
const cache = new Map<string, Uint8Array>();
const CACHE_LIMIT = 200;

/** The generic banner, never cached: once the portfolio shows again, its own card should. */
const banner = () =>
	new Response(null, {
		status: 302,
		headers: { Location: new URL("/opengraph/banner.jpg", env.APP_URL).href, "Cache-Control": "no-store" },
	});

/** Formats the card's renderer (resvg) draws. It can't draw WebP, which the editor uploads pictures as. */
const DRAWABLE_PICTURE = /\.(?:jpe?g|png)$/i;

/**
 * The photo the card draws: the small copy when it's a PNG or JPEG, else the photo itself when it is, else none. A
 * portfolio's picture names its format (the server names each upload after its bytes), and the view only holds this
 * app's own uploads.
 */
function cardPicture(picture: PortfolioViewImage | null): string {
	if (!picture) return "";
	return (
		[picture.srcSmall, picture.src].find((src) => {
			if (!src) return false;
			try {
				return DRAWABLE_PICTURE.test(new URL(src, env.APP_URL).pathname);
			} catch {
				return false;
			}
		}) ?? ""
	);
}

/**
 * `GET /cards/<username>.png`: a published portfolio's link preview (WhatsApp, LinkedIn): name, headline, photo and
 * address in the portfolio's fonts and accent. An address that doesn't show a portfolio gets the generic banner, so a
 * card never shows what a visitor can't. HEAD answers with the headers only.
 */
export async function handlePortfolioCard(
	request: Request,
	username: string,
	trustedClient?: string,
): Promise<Response> {
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const portfolio = await findPublicPortfolio(username).catch(() => null);
	if (!portfolio) return banner();
	const view = publicPortfolioView(portfolio);

	const address = portfolio.customDomain ?? `${new URL(env.APP_ALIAS_URL ?? env.APP_URL).host}/${portfolio.username}`;
	const text = { name: view.basics.name, headline: view.basics.headline, address, color: view.design.accent };
	const picture = cardPicture(view.basics.picture);
	const fonts = { heading: view.design.fonts.heading, body: view.design.fonts.body };
	const key = createHash("sha256")
		.update(JSON.stringify([text, fonts, picture, view.locale]))
		.digest("hex");
	// Checked again on every use (`no-cache`, answered with 304 while it's the same card), so a card stops showing as
	// soon as its portfolio is unpublished or taken down, instead of an hour later.
	const headers = { "Cache-Control": "public, no-cache", ETag: `"${key.slice(0, 32)}"` };
	if (matchesIfNoneMatch(request.headers.get("if-none-match"), headers.ETag))
		return new Response(null, { status: 304, headers });
	// A crawler checking the link needs no picture drawn.
	if (request.method === "HEAD") return new Response(null, { headers: { ...headers, "Content-Type": "image/png" } });

	let png = cache.get(key);
	if (!png) {
		try {
			// The card's fonts and photo load the way a resume card's do: a resume shaped like the portfolio's choices.
			const data = structuredClone(defaultResumeData);
			data.metadata.page.locale = view.locale;
			data.metadata.typography.heading.fontFamily = fonts.heading;
			data.metadata.typography.body.fontFamily = fonts.body;
			data.picture = { ...data.picture, url: picture, hidden: !picture };
			const [{ loadResumeCardAssets }, { readUploadedFont }] = await Promise.all([
				import("@rezumi/pdf/server"),
				import("@rezumi/api/features/storage"),
			]);
			const assets = await loadResumeCardAssets(data, env.APP_URL, readUploadedFont);
			// Bytes that turn out to be WebP whatever the name says would draw as a blank circle: leave the photo out.
			const photo = assets.picture?.startsWith("data:image/webp") ? undefined : assets.picture;
			const svg = resumeCardSvg({
				...text,
				headingFamily: assets.headingFamily,
				bodyFamily: assets.bodyFamily,
				picture: photo,
			});
			await initialize();
			const resvg = new Resvg(svg, {
				fitTo: { mode: "width", value: CARD_WIDTH },
				font: { fontBuffers: assets.fonts, defaultFontFamily: assets.bodyFamily, loadSystemFonts: false },
			});
			png = resvg.render().asPng();
			resvg.free();
			if (cache.size >= CACHE_LIMIT) cache.clear();
			// A photo that failed to load or draw is tried again next time.
			if (!picture || photo) cache.set(key, png);
		} catch (error) {
			console.error("Portfolio card rendering failed", error);
			return banner();
		}
	}
	return new Response(png as Uint8Array<ArrayBuffer>, { headers: { ...headers, "Content-Type": "image/png" } });
}
