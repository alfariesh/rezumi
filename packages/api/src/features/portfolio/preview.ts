import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { createHash } from "node:crypto";
import { env } from "@rezumi/env/server";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { PORTFOLIO_IMAGE_KEY_PATTERN } from "@rezumi/schema/portfolio/files";
import { escapeHtml } from "@rezumi/utils/string";
import { requireEnabled } from "./access";
import { portfolioErrors } from "./errors";
import { PORTFOLIO_PREVIEW_FILE_PARAM, PORTFOLIO_PREVIEW_FILE_TTL_MS, portfolioPreviewFileToken } from "./preview-file";
import { findOwnerPortfolio } from "./public";
import { homePath, portfolioFileAddress, publicPortfolioView, renderPortfolioOnServer, workPath } from "./render";

type PreviewInput = {
	theme?: PortfolioTheme | undefined;
	workId?: string | undefined;
	width?: "phone" | "desktop" | undefined;
};

// Preview anchors stay in this document, and media providers open in the system browser.
const PREVIEW_LINKS = `document.addEventListener("click", event => {
	const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
	const href = link?.getAttribute("href");
	if (href?.startsWith("#")) {
		event.preventDefault();
		document.getElementById(href.slice(1))?.scrollIntoView();
	}
	else if (href && !link.hasAttribute("data-lightbox")) {
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		if (link.hasAttribute("data-embed")) event.stopPropagation();
	}
}, true);`;

export async function previewPortfolio(userId: string, input: PreviewInput) {
	await requireEnabled(userId);
	const portfolio = await findOwnerPortfolio(userId);
	if (!portfolio) throw portfolioErrors.notFound();
	const origin = new URL(env.APP_URL).origin;
	const expires = Date.now() + PORTFOLIO_PREVIEW_FILE_TTL_MS;
	const prefix = `uploads/${userId}/`;
	const files = new Map(
		portfolioFileKeys(portfolio.data)
			.filter((key) => key.startsWith(prefix) && PORTFOLIO_IMAGE_KEY_PATTERN.test(key))
			.map((key) => [
				key,
				`${origin}/api/${key}?${PORTFOLIO_PREVIEW_FILE_PARAM}=${portfolioPreviewFileToken(key, expires)}`,
			]),
	);
	const allowed = new Set(files.values());
	const view = publicPortfolioView(
		input.theme ? { ...portfolio, data: { ...portfolio.data, theme: input.theme } } : portfolio,
		{},
		(key) => files.get(key) ?? "",
	);
	if (input.workId && !view.works.some((work) => work.id === input.workId)) throw portfolioErrors.workNotFound();

	const page = await renderPortfolioOnServer(view, new Date().getUTCFullYear(), {
		page: input.workId ? { kind: "work", workId: input.workId } : { kind: "home" },
		imageUrl: (url) => (allowed.has(url) ? url : portfolioFileAddress(url)),
	});
	// Start loading images while their private URLs are fresh, even when the image is below the fold.
	page.html = page.html.replaceAll(' loading="lazy"', ' loading="eager"');
	page.script = PREVIEW_LINKS + page.script;
	const hash = createHash("sha256").update(page.script).digest("base64");
	const policy = [
		"default-src 'none'",
		`script-src 'sha256-${hash}'`,
		"style-src 'unsafe-inline'",
		`img-src ${origin} ${env.APP_ALIAS_URL ? new URL(env.APP_ALIAS_URL).origin : ""} data:`,
		"font-src https:",
		"form-action 'none'",
		`base-uri ${origin}`,
	].join("; ");
	const head = [
		'<meta charset="utf-8">',
		`<meta http-equiv="Content-Security-Policy" content="${escapeHtml(policy)}">`,
		'<meta name="referrer" content="no-referrer">',
		'<meta name="robots" content="noindex, nofollow">',
		`<base href="${escapeHtml(origin)}/">`,
	].join("");
	const html = renderPortfolioDocument({ page })
		.replace('<meta charset="utf-8">', head)
		.replace(
			"width=device-width,initial-scale=1",
			input.width === "desktop" ? "width=1200" : "width=device-width,initial-scale=1",
		);
	return {
		html,
		origin,
		homePath: homePath(portfolio, {}),
		works: view.works.map((work) => ({ id: work.id, path: workPath(portfolio, {}, work.slug) })),
	};
}
