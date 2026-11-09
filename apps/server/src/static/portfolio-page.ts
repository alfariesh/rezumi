import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import type { PortfolioPage } from "@rezumi/portfolio";
import type { PortfolioView } from "@rezumi/portfolio/view";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { createHash } from "node:crypto";
import { findPublicPortfolio, recordPortfolioVisit } from "@rezumi/api/features/portfolio/public";
import { env } from "@rezumi/env/server";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView, portfolioPageLocale } from "@rezumi/portfolio/view";
import { publicResumePath } from "@rezumi/resume/sharing";
import { ownPictureUrl } from "@rezumi/utils/own-picture";
import { serveResumePage } from "./resume-page";
import { BASE_SECURITY_HEADERS } from "./web";

const origin = () => new URL(env.APP_URL).origin;

/** The players a video block loads after a click (`02-teknis.md` section 18); nothing else is ever framed. */
const VIDEO_PLAYER_ORIGINS = ["https://www.youtube-nocookie.com", "https://player.vimeo.com"] as const;

/** Sources a directive of the page's policy allows, as written in the header. */
export type PortfolioPolicyDirectives = Record<string, readonly string[]>;

/**
 * The page's policy, directive by directive (`02-teknis.md` section 18). Its one script runs by hash (the shared page
 * script, plus the intro effect's when the page plays a script effect); Cloudflare Web Analytics may add its beacon.
 * Pictures and fonts load like on the app's other pages. Only the video players may be framed, nothing is embedded or
 * run as a worker, forms post to this site only, and no other site may frame the page. `additions` adds sources to a
 * directive: Phase 08's Turnstile widget adds `https://challenges.cloudflare.com` to `script-src` and `frame-src`.
 */
export function portfolioContentSecurityPolicy(script: string, additions: PortfolioPolicyDirectives = {}): string {
	const hash = `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
	const directives: PortfolioPolicyDirectives = {
		"default-src": ["'self'"],
		"script-src": ["'self'", "https://static.cloudflareinsights.com", hash],
		"style-src": ["'self'", "'unsafe-inline'"],
		"img-src": ["'self'", "data:", "blob:", "https:"],
		"font-src": ["'self'", "data:", "https:"],
		"connect-src": ["'self'", "data:", "blob:", "https:"],
		"media-src": ["'self'", "data:", "blob:"],
		"frame-src": VIDEO_PLAYER_ORIGINS,
		"worker-src": ["'none'"],
		"object-src": ["'none'"],
		"frame-ancestors": ["'none'"],
		"base-uri": ["'self'"],
		"form-action": ["'self'"],
	};
	for (const [name, sources] of Object.entries(additions))
		directives[name] = [...new Set([...(directives[name] ?? []).filter((source) => source !== "'none'"), ...sources])];
	return Object.entries(directives)
		.map(([name, sources]) => [name, ...sources].join(" "))
		.join("; ");
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

/**
 * The address of a picture the page may show, or undefined: only this app's own uploads (`ownPictureUrl`,
 * `02-teknis.md` section 20). A visit never asks another site for anything, so a resume photo kept elsewhere (an
 * imported link) isn't shown.
 */
export function portfolioPictureUrl(source: string): string | undefined {
	// The app's own origin first: a relative address resolves against it.
	const origins = [env.APP_URL, env.APP_ALIAS_URL].flatMap((address) => (address ? [new URL(address).origin] : []));
	return ownPictureUrl(source, origins);
}

/** The resume as the page may use it: its photo only when it's one of this app's uploads. */
function withOwnPicture(data: ResumeData): ResumeData {
	if (!data.picture.url.trim() || portfolioPictureUrl(data.picture.url)) return data;
	return { ...data, picture: { ...data.picture, url: "" } };
}

/** The view of a published portfolio as every visitor sees it, with addresses on this app. */
export function publicPortfolioView(portfolio: PublicPortfolio): PortfolioView {
	const { resume } = portfolio;
	const locale = portfolioPageLocale(portfolio.data, resume?.data);
	const resumePath = resume ? publicResumePath({ username: portfolio.username, slug: resume.slug }) : null;
	return buildPortfolioView({
		portfolio: { data: portfolio.data },
		resume: resume ? { data: withOwnPicture(resume.data) } : null,
		owner: { name: portfolio.ownerName, username: portfolio.username },
		entitlements: portfolio.entitlements,
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
		imageUrl: portfolioPictureUrl,
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
	const picture = view.basics.picture ? portfolioPictureUrl(view.basics.picture.src) : undefined;
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
			...(picture ? { image: picture } : {}),
			...(meLinks.length > 0 ? { sameAs: meLinks } : {}),
		},
		...(parts.length > 0 ? { hasPart: parts } : {}),
	};
}

/**
 * Requests a browser makes on its own, before anyone opens the page (or without them ever opening it): Chrome's
 * prefetch and prerender (`Sec-Purpose`, formerly `Purpose`), Safari's previews (`X-Purpose`), Firefox's prefetch.
 */
function isSpeculative(headers: Headers): boolean {
	const purpose = ["sec-purpose", "purpose", "x-purpose", "x-moz"].map((name) => headers.get(name) ?? "").join(",");
	return /\b(?:prefetch|prerender|preview)\b/i.test(purpose);
}

type KeepAlive = (work: Promise<unknown>) => void;
let keepAlive: KeepAlive | undefined;

/**
 * How the platform keeps work going after a response is sent, set once at startup. Workers passes `ctx.waitUntil`
 * together with the request's database pool (`apps/server/src/cloudflare/index.ts`, like the assistant's streams).
 */
export function configurePortfolioVisitLifetime(callback: KeepAlive | undefined): void {
	keepAlive = callback;
}

/**
 * Counts the visit without holding up the page (`02-teknis.md` section 9). Node keeps running it after the response;
 * Workers does only through `configurePortfolioVisitLifetime`, so without that the page waits for it there, as before.
 * Counting that fails is logged, never shown.
 */
function countVisit(request: Request, portfolio: PublicPortfolio, trustedClient: string): Promise<void> {
	const counting = recordPortfolioVisit({ portfolio, requestHeaders: request.headers, trustedClient }).catch(
		(error: unknown) => console.error("Portfolio visit counting failed", error),
	);
	if (keepAlive) {
		keepAlive(counting);
		return Promise.resolve();
	}
	return process.env.CLOUDFLARE === "1" ? counting : Promise.resolve();
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
	// A visit is a page someone opens: not a HEAD request, a prefetch or a prerender.
	const counted =
		request.method === "GET" && !isSpeculative(request.headers)
			? countVisit(request, portfolio, trustedClient)
			: Promise.resolve();
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
	await counted;
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
