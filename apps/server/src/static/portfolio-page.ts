import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import type { PortfolioPage } from "@rezumi/portfolio";
import type { PortfolioView } from "@rezumi/portfolio/view";
import { createHash } from "node:crypto";
import { findPublicPortfolio, recordPortfolioVisit } from "@rezumi/api/features/portfolio/public";
import { env } from "@rezumi/env/server";
import { webPageImageUrl } from "@rezumi/pdf/web-page";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { publicResumePath } from "@rezumi/resume/sharing";
import { serveResumePage } from "./resume-page";
import { BASE_SECURITY_HEADERS, contentSecurityPolicy } from "./web";

const origin = () => new URL(env.APP_URL).origin;

/**
 * The page's policy: the app's own, which allows the page's script by its hash (the shared page script, plus the intro
 * effect's when the page plays a script effect), plus the players a video block may load after a click
 * (`02-teknis.md` section 18). Turnstile joins in Phase 08.
 */
function portfolioContentSecurityPolicy(script: string): string {
	return contentSecurityPolicy(`<script>${script}</script>`).replace(
		"frame-src 'self' blob:",
		"frame-src 'self' blob: https://www.youtube-nocookie.com https://player.vimeo.com",
	);
}

function html(body: string, script: string, headers: Record<string, string> = {}) {
	return new Response(body, {
		status: 200,
		headers: {
			...BASE_SECURITY_HEADERS,
			"Content-Type": "text/html; charset=UTF-8",
			// Visits are counted per request and the page follows every edit, so no cache may keep it.
			"Cache-Control": "private, no-store",
			"Content-Security-Policy": portfolioContentSecurityPolicy(script),
			...headers,
		},
	});
}

/** The view of a published portfolio as every visitor sees it, with addresses on this app. */
export function publicPortfolioView(portfolio: PublicPortfolio): PortfolioView {
	const { resume } = portfolio;
	const locale = portfolio.data.locale ?? resume?.data.metadata.page.locale ?? "en-US";
	const resumePath = resume ? publicResumePath({ username: portfolio.username, slug: resume.slug }) : null;
	return buildPortfolioView({
		portfolio: { data: portfolio.data },
		resume: resume ? { data: resume.data } : null,
		owner: { name: portfolio.ownerName, username: portfolio.username },
		// Plans arrive in Phase 07; until then every portfolio shows the credit.
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(portfolioMessages(locale)),
		fileUrl: (key) => `${origin()}/${key}`,
		links: {
			resume: resume?.isPublic && resumePath ? `${origin()}${resumePath}` : null,
			// A password-protected PDF needs the visitor to unlock the resume first, so the button goes there instead.
			resumePdf:
				resume?.isPublic && resume.showDownloadButtons && !resume.hasPassword && resumePath
					? `${origin()}/api/resumes${resumePath}/pdf?download`
					: null,
		},
	});
}

// Rendered pages by everything they draw, so repeat visits skip React and CSS.
// ponytail: per process, cleared at 100 entries, like the resume pages' cache.
const rendered = new Map<string, PortfolioPage>();

async function renderPage(view: PortfolioView): Promise<PortfolioPage> {
	const year = new Date().getUTCFullYear();
	const key = createHash("sha256")
		.update(JSON.stringify([view, year]))
		.digest("hex");
	const hit = rendered.get(key);
	if (hit) return hit;
	const names = portfolioIconNames(view);
	// Icon shapes load with the first page that uses one; most pages use none.
	const glyphs = names.length
		? await import("@rezumi/pdf/icon-glyphs").then(({ loadIconGlyphs }) => loadIconGlyphs("standard"))
		: {};
	const icons = Object.fromEntries(names.flatMap((name) => (glyphs[name] ? [[name, glyphs[name]]] : [])));
	const page = renderPortfolioPage({
		view,
		messages: portfolioMessages(view.locale),
		icons,
		imageUrl: webPageImageUrl(origin()),
		year,
		creditUrl: origin(),
	});
	if (rendered.size >= 100) rendered.clear();
	rendered.set(key, page);
	return page;
}

/** The person and their work, for search engines (`02-teknis.md` 5.3); testimonials stay out (not reviews). */
function structuredData(view: PortfolioView, url: string, updatedAt: Date, meLinks: readonly string[]) {
	const work = view.sections.find((section) => section.kind === "work");
	const services = view.sections.find((section) => section.kind === "services");
	const picture = view.basics.picture ? webPageImageUrl(origin())(view.basics.picture.src) : undefined;
	const parts = [
		...(work?.kind === "work"
			? work.works.map((item) => ({
					"@type": "CreativeWork",
					name: item.title,
					url: `${url}#${item.anchor}`,
					...(item.summary ? { description: item.summary } : {}),
				}))
			: []),
		...(services?.kind === "services"
			? services.services.map((item) => ({
					"@type": "Service",
					name: item.title,
					...(item.description ? { description: item.description } : {}),
				}))
			: []),
	];
	return {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		url,
		dateModified: updatedAt.toISOString(),
		inLanguage: view.locale,
		mainEntity: {
			"@type": "Person",
			name: view.basics.name,
			...(view.basics.headline ? { jobTitle: view.basics.headline } : {}),
			...(view.location?.label ? { homeLocation: { "@type": "Place", name: view.location.label } } : {}),
			...(picture && !picture.startsWith("data:") ? { image: picture } : {}),
			...(meLinks.length > 0 ? { sameAs: meLinks } : {}),
		},
		...(parts.length > 0 ? { hasPart: parts } : {}),
	};
}

type ServeOptions = {
	/** Set on a custom domain: the page lives at its root there. */
	customDomain?: string | undefined;
};

async function showPortfolio(
	request: Request,
	portfolio: PublicPortfolio,
	trustedClient: string,
	options: ServeOptions,
) {
	const view = publicPortfolioView(portfolio);
	const page = await renderPage(view);
	const domain = options.customDomain ?? portfolio.customDomain;
	const canonicalUrl = domain ? `https://${domain}/` : `${origin()}/${encodeURIComponent(portfolio.username)}`;
	const contact = view.sections.find((section) => section.kind === "contact");
	const meLinks =
		contact?.kind === "contact"
			? [
					...(contact.contact.website ? [contact.contact.website.href] : []),
					...contact.contact.profiles.flatMap((profile) => (profile.href ? [profile.href] : [])),
				].filter((link) => /^https?:\/\//i.test(link))
			: [];
	const body = renderPortfolioDocument({
		page,
		head: {
			title: view.seo.title,
			description: view.seo.description,
			canonicalUrl,
			indexable: portfolio.indexable,
			imageUrl: `${origin()}/cards/${encodeURIComponent(portfolio.username)}.png`,
			meLinks,
			structuredData: portfolio.indexable
				? structuredData(view, canonicalUrl, portfolio.updatedAt, meLinks)
				: undefined,
		},
	});
	await recordPortfolioVisit({ portfolio, requestHeaders: request.headers, trustedClient }).catch((error: unknown) =>
		console.error("Portfolio visit counting failed", error),
	);
	return html(body, page.script, portfolio.indexable ? {} : { "X-Robots-Tag": "noindex, follow" });
}

/**
 * `/<username>` and a custom domain's root: the account's portfolio when one is published and the switch lets its
 * owner show it, otherwise the primary resume exactly as before (`02-teknis.md` section 6). POST is always the resume's
 * password form; the portfolio's own forms post to `/api/portfolio/…`.
 */
export async function servePortfolioOrResume(
	request: Request,
	username: string,
	trustedClient: string,
	options: ServeOptions = {},
): Promise<Response> {
	const resume = () => serveResumePage(request, { username, primary: true }, trustedClient, options);
	if (request.method !== "GET" && request.method !== "HEAD") return resume();
	const portfolio = await findPublicPortfolio(username);
	return portfolio ? showPortfolio(request, portfolio, trustedClient, options) : resume();
}
