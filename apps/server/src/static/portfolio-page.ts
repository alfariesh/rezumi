import type { PublicPortfolio } from "@rezumi/api/features/portfolio/public";
import type { PortfolioPage, PortfolioPageKind, PortfolioPageLive } from "@rezumi/portfolio";
import type { PortfolioView, PortfolioViewWork } from "@rezumi/portfolio/view";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { createHash } from "node:crypto";
import { getPortfolioMode } from "@rezumi/api/features/portfolio/mode";
import { findPublicPortfolio, recordPortfolioVisit } from "@rezumi/api/features/portfolio/public";
import { publicPortfolioRequestAllowed, tooManyPortfolioRequests } from "@rezumi/api/features/portfolio/public-limit";
import { isContactFormConfigured } from "@rezumi/api/features/portfolio/turnstile";
import {
	PORTFOLIO_FILE_TOKEN_PARAM,
	portfolioAccess,
	portfolioFileToken,
} from "@rezumi/api/features/portfolio/visitor-access";
import { env } from "@rezumi/env/server";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { renderPortfolioLockPage, renderPortfolioMissingWorkPage } from "@rezumi/portfolio/gate";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { renderPortfolioReportPage } from "@rezumi/portfolio/report";
import { htmlToText, truncateText } from "@rezumi/portfolio/text";
import {
	buildPortfolioView,
	portfolioPageLocale,
	portfolioSourceResume,
	resolvePortfolioWork,
} from "@rezumi/portfolio/view";
import { publicResumePath } from "@rezumi/resume/sharing";
import { BILLING_SELLER } from "@rezumi/schema/billing";
import { PORTFOLIO_SLUG_PATTERN } from "@rezumi/schema/portfolio/data";
import { embedFrameOrigins } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { RESERVED_PROFILE_SEGMENTS } from "@rezumi/utils/app-paths";
import { ownPictureUrl } from "@rezumi/utils/own-picture";
import { serveResumePage, unavailableResponse } from "./resume-page";
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
 * directive: a page with the contact form adds Turnstile's origin to `script-src` and `frame-src`.
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

/** What the Turnstile widget needs on a page that holds the contact form. */
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const TURNSTILE_POLICY: PortfolioPolicyDirectives = {
	"script-src": [TURNSTILE_ORIGIN],
	"frame-src": [TURNSTILE_ORIGIN],
};

function html(
	body: string,
	script: string,
	headers: Record<string, string> = {},
	additions: PortfolioPolicyDirectives = {},
) {
	return new Response(body, {
		status: 200,
		headers: {
			...BASE_SECURITY_HEADERS,
			"Content-Type": "text/html; charset=UTF-8",
			// Visits are counted per request and the page follows every edit, so no cache may keep it.
			"Cache-Control": "private, no-store",
			"Content-Security-Policy": portfolioContentSecurityPolicy(script, additions),
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
	// A locked portfolio's picture carries its file token (`signedFileUrl`) and nothing else in its query.
	const [path = "", query] = source.split("?");
	const token = query === undefined ? null : new URLSearchParams(query);
	if (token && ([...token.keys()].join() !== PORTFOLIO_FILE_TOKEN_PARAM || !token.get(PORTFOLIO_FILE_TOKEN_PARAM)))
		return undefined;
	const own = ownPictureUrl(path, origins);
	return own && token ? `${own}?${token.toString()}` : own;
}

/** A portfolio PDF on the app (`documents/portfolio/<id>.pdf`), the one other kind of stored file a page links to. */
const OWN_PORTFOLIO_PDF_PATH = /^\/(?:api\/)?uploads\/[\w-]+\/documents\/portfolio\/[\w-]+\.pdf$/;

/**
 * The address a page may use for one of this app's stored files: a picture (`portfolioPictureUrl`), or a portfolio's
 * PDF, which the PDF card links to through the same filter. Either may carry a locked portfolio's file token.
 */
export function portfolioFileAddress(source: string): string | undefined {
	const picture = portfolioPictureUrl(source);
	if (picture) return picture;
	let url: URL;
	try {
		url = new URL(source.trim(), origin());
	} catch {
		return undefined;
	}
	const own = [env.APP_URL, env.APP_ALIAS_URL].some((address) => address && new URL(address).origin === url.origin);
	const query = [...url.searchParams.keys()];
	const tokenOnly =
		query.length === 0 || (query.join() === PORTFOLIO_FILE_TOKEN_PARAM && url.searchParams.get(query[0] ?? ""));
	if (!own || !tokenOnly || url.hash || url.username || url.password || !OWN_PORTFOLIO_PDF_PATH.test(url.pathname))
		return undefined;
	return url.href;
}

/**
 * A stored file's address on the app. Behind a visitor password, it carries a file token bound to the file and the
 * current password (`portfolioFileToken`): only pages rendered for a visitor who opened the portfolio hand these out,
 * and the uploads route refuses a locked portfolio's file without one.
 */
function signedFileUrl(key: string, passwordHash: string | null): string {
	const url = `${origin()}/${key}`;
	return passwordHash ? `${url}?${PORTFOLIO_FILE_TOKEN_PARAM}=${portfolioFileToken(key, passwordHash)}` : url;
}

/** The source (a resume or the Profile) as the page may use it: its photo only when it's one of this app's uploads. */
function withOwnPicture(data: ResumeData): ResumeData {
	if (!data.picture.url.trim() || portfolioPictureUrl(data.picture.url)) return data;
	return { ...data, picture: { ...data.picture, url: "" } };
}

type ServeOptions = {
	/** Set on a custom domain: the page lives at its root there. */
	customDomain?: string | undefined;
};

/** The portfolio's home on the domain being served: `/<username>`, or `/` on a custom domain. */
const homePath = (portfolio: Pick<PublicPortfolio, "username">, options: ServeOptions) =>
	options.customDomain ? "/" : `/${encodeURIComponent(portfolio.username)}`;

/** A work's page on the domain being served: `/<username>/work/<slug>`, or `/work/<slug>` on a custom domain. */
const workPath = (portfolio: Pick<PublicPortfolio, "username">, options: ServeOptions, slug: string) =>
	`${options.customDomain ? "" : `/${encodeURIComponent(portfolio.username)}`}/work/${encodeURIComponent(slug)}`;

/** Where search engines are sent: the portfolio's live custom domain, else its address on the app. */
function canonicalBase(portfolio: Pick<PublicPortfolio, "username" | "customDomain">, options: ServeOptions) {
	const domain = options.customDomain ?? portfolio.customDomain;
	const home = domain ? `https://${domain}/` : `${origin()}/${encodeURIComponent(portfolio.username)}`;
	const workBase = domain ? `https://${domain}` : home;
	return { home, work: (slug: string) => `${workBase}/work/${encodeURIComponent(slug)}` };
}

/**
 * The view of a published portfolio as every visitor sees it, with addresses on this app, or on the custom domain it's
 * served at: the home, each work's own page (Phase 13, B2) and the "Save contact" card (B14).
 */
export function publicPortfolioView(portfolio: PublicPortfolio, options: ServeOptions = {}): PortfolioView {
	const { resume, source } = portfolio;
	const locale = portfolioPageLocale(portfolio.data, portfolioSourceResume(source));
	const resumePath = resume ? publicResumePath({ username: portfolio.username, slug: resume.slug }) : null;
	return buildPortfolioView({
		portfolio: { data: portfolio.data },
		resume: source ? { ...source, data: withOwnPicture(source.data) } : null,
		owner: { name: portfolio.ownerName, username: portfolio.username },
		entitlements: portfolio.entitlements,
		contactFormAvailable: isContactFormConfigured(),
		messages: portfolioViewMessages(portfolioMessages(locale)),
		fileUrl: (key) => signedFileUrl(key, portfolio.passwordHash),
		links: {
			resume: resume?.isPublic && resumePath ? `${origin()}${resumePath}` : null,
			// A password-protected PDF needs the visitor to unlock the resume first, so the button goes there instead.
			resumePdf:
				resume?.isPublic && resume.showDownloadButtons && !resume.hasPassword && resumePath
					? `${origin()}/api/resumes${resumePath}/pdf?download`
					: null,
			home: homePath(portfolio, options),
			work: (slug) => workPath(portfolio, options, slug),
			// Relative: a custom domain passes `/api/portfolio/` through to the app.
			vcard: `/api/portfolio/${encodeURIComponent(portfolio.username)}/vcard`,
		},
	});
}

// Rendered pages by everything they draw, so repeat visits skip React and CSS.
// ponytail: per process, cleared at 100 entries, like the resume pages' cache.
const rendered = new Map<string, PortfolioPage>();

async function renderPage(
	view: PortfolioView,
	live: PortfolioPageLive,
	kind: PortfolioPageKind = { kind: "home" },
): Promise<PortfolioPage> {
	const year = new Date().getUTCFullYear();
	const key = createHash("sha256")
		.update(JSON.stringify([view, year, live, kind]))
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
		imageUrl: portfolioFileAddress,
		year,
		creditUrl: origin(),
		live,
		page: kind,
	});
	if (rendered.size >= 100) rendered.clear();
	rendered.set(key, page);
	return page;
}

/** The person and their work, for search engines (`02-teknis.md` 5.3); testimonials stay out (not reviews). */
function structuredData(
	view: PortfolioView,
	url: string,
	updatedAt: Date,
	meLinks: readonly string[],
	workUrl: (slug: string) => string,
) {
	const work = view.sections.find((section) => section.kind === "work");
	const services = view.sections.find((section) => section.kind === "services");
	const picture = view.basics.picture ? portfolioPictureUrl(view.basics.picture.src) : undefined;
	const parts = [
		...(work?.kind === "work"
			? work.works.map((item) => ({
					"@type": "CreativeWork",
					name: item.title,
					url: workUrl(item.slug),
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
export function isSpeculative(headers: Headers): boolean {
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
 * Runs work without holding up the response. Node keeps running it afterwards; Workers does only through
 * `configurePortfolioVisitLifetime`, so without that the caller waits for it there. A failure is logged, never shown.
 */
export function runAfterResponse(work: Promise<unknown>, failure: string): Promise<void> {
	const running = work.then(
		() => undefined,
		(error: unknown) => console.error(failure, error),
	);
	if (keepAlive) {
		keepAlive(running);
		return Promise.resolve();
	}
	return process.env.CLOUDFLARE === "1" ? running : Promise.resolve();
}

/**
 * Counts the visit without holding up the page (`02-teknis.md` section 9): a page someone opens, not a HEAD request,
 * a prefetch or a prerender (which reports itself with a `view` beacon once shown). A work's page counts its work too.
 */
function countVisit(request: Request, portfolio: PublicPortfolio, trustedClient: string, workId?: string) {
	if (request.method !== "GET" || isSpeculative(request.headers)) return Promise.resolve();
	return runAfterResponse(
		recordPortfolioVisit({
			portfolio,
			requestHeaders: request.headers,
			requestUrl: request.url,
			trustedClient,
			...(workId ? { workId } : {}),
		}),
		"Portfolio visit counting failed",
	);
}

/**
 * How the page talks back: where its beacons go and, when the view has a form, how the form works here. A custom
 * domain can't be listed on the Turnstile widget (`02-teknis.md` section 10), so its visitors get a button to the form
 * on the app's own domain.
 */
function liveWiring(
	request: Request,
	portfolio: PublicPortfolio,
	hasForm: boolean,
	options: ServeOptions,
): PortfolioPageLive {
	const path = encodeURIComponent(portfolio.username);
	const live: PortfolioPageLive = {
		eventUrl: `/api/portfolio/${path}/event`,
		// The form lives on the app's domain only, for the same Turnstile reason.
		reportUrl: `${options.customDomain ? origin() : ""}/${path}?report`,
	};
	if (!hasForm) return live;
	if (options.customDomain) return { ...live, form: { kind: "link", url: `${origin()}/${path}#contact` } };
	const status = new URL(request.url).searchParams.get("contact");
	return {
		...live,
		form: {
			kind: "form",
			action: `/api/portfolio/${path}/message`,
			siteKey: env.TURNSTILE_SITE_KEY ?? "",
			...(status === "sent" || status === "failed" ? { status } : {}),
		},
	};
}

async function showPortfolio(
	request: Request,
	portfolio: PublicPortfolio,
	trustedClient: string,
	options: ServeOptions,
) {
	const counted = countVisit(request, portfolio, trustedClient);
	const view = publicPortfolioView(portfolio, options);
	const contact = view.sections.find((section) => section.kind === "contact");
	const live = liveWiring(request, portfolio, contact?.kind === "contact" && contact.contact.form, options);
	const page = await renderPage(view, live);
	const canonical = canonicalBase(portfolio, options);
	const canonicalUrl = canonical.home;
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
				? structuredData(view, canonicalUrl, portfolio.updatedAt, meLinks, canonical.work)
				: undefined,
		},
	});
	await counted;
	return html(
		body,
		page.script,
		portfolio.indexable ? {} : { "X-Robots-Tag": "noindex, follow" },
		live.form?.kind === "form" ? TURNSTILE_POLICY : {},
	);
}

/**
 * The report form at `/<username>?report` (`02-teknis.md` section 14), on its own plain page so a page of any theme gets
 * the same form. A portfolio reached over a custom domain sends visitors to the app's domain, where Turnstile works.
 */
function showReportForm(
	request: Request,
	portfolio: PublicPortfolio,
	options: ServeOptions,
	locked: boolean,
): Response {
	const path = encodeURIComponent(portfolio.username);
	if (options.customDomain) return Response.redirect(`${origin()}/${path}?report`, 302);
	const view = publicPortfolioView(portfolio);
	const status = new URL(request.url).searchParams.get("report");
	const body = renderPortfolioReportPage({
		lang: view.locale,
		dir: view.dir,
		// Behind a password, a visitor who can't open the portfolio learns nothing from its report form, not even the name.
		name: locked ? `@${portfolio.username}` : view.basics.name,
		pageUrl: `/${path}`,
		action: `/api/portfolio/${path}/report`,
		siteKey: isContactFormConfigured() ? (env.TURNSTILE_SITE_KEY ?? null) : null,
		status: status === "sent" || status === "failed" ? status : undefined,
		supportEmail: BILLING_SELLER.supportEmail,
		messages: portfolioMessages(view.locale),
	});
	return html(body, "", { "X-Robots-Tag": "noindex, nofollow" }, TURNSTILE_POLICY);
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
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const portfolio = await findPublicPortfolio(username);
	if (!portfolio) return resume();
	const access = await portfolioAccess(portfolio, request.headers);
	// Not behind the password: whoever is shown a fake lock page must still be able to report it.
	if (new URL(request.url).searchParams.has("report"))
		return showReportForm(request, portfolio, options, access === "locked");
	if (access === "locked") return lockedPage(request, portfolio, options, "home");
	return showPortfolio(request, portfolio, trustedClient, options);
}

/** The password page (`@rezumi/portfolio/gate`, Phase 13 B16): nothing of the portfolio, no script, never cached. */
function lockedPage(request: Request, portfolio: PublicPortfolio, options: ServeOptions, next: string): Response {
	const path = encodeURIComponent(portfolio.username);
	const view = publicPortfolioView(portfolio, options);
	const status = new URL(request.url).searchParams.get("unlock");
	const body = renderPortfolioLockPage({
		lang: view.locale,
		dir: view.dir,
		// Relative: a custom domain passes `/api/portfolio/` through, and the cookie must be set on its own host.
		action: `/api/portfolio/${path}/unlock`,
		next,
		status: status === "wrong" || status === "limited" ? status : undefined,
		reportUrl: `${options.customDomain ? origin() : ""}/${path}?report`,
		messages: portfolioMessages(view.locale),
	});
	return plainPage(body, 401, { "X-Robots-Tag": "noindex, nofollow" });
}

/** A page with no script at all (the password page, a missing work): no cache, nothing to run. */
function plainPage(body: string, status: number, headers: Record<string, string> = {}) {
	return new Response(body, {
		status,
		headers: {
			...BASE_SECURITY_HEADERS,
			"Content-Type": "text/html; charset=UTF-8",
			"Cache-Control": "private, no-store",
			"Content-Security-Policy": portfolioContentSecurityPolicy("", {}),
			...headers,
		},
	});
}

const isWorkSlug = (slug: string) => slug.length <= PORTFOLIO_LIMITS.text.slug && PORTFOLIO_SLUG_PATTERN.test(slug);

/** `/<username>/work/<slug>` (Phase 13, B2): exactly three segments, a possible username, `work`, and a work's slug. */
export function isPortfolioWorkPath(pathname: string): boolean {
	const segments = pathname.split("/");
	if (segments.length !== 4 || segments[0] !== "") return false;
	const [, username = "", work, slug = ""] = segments;
	return (
		username !== "" && !RESERVED_PROFILE_SEGMENTS.has(username.toLowerCase()) && work === "work" && isWorkSlug(slug)
	);
}

/** A custom domain's `/work/<slug>`: the slug, or null for any other path. */
export function customDomainWorkSlug(pathname: string): string | null {
	const match = /^\/work\/([^/]+)$/.exec(pathname);
	return match?.[1] && isWorkSlug(match[1]) ? match[1] : null;
}

/** Whether the routes Phase 13 adds answer at all: while portfolios are off, their paths fall through as before. */
export const portfolioRoutesEnabled = () => getPortfolioMode() !== "off";

/**
 * A work's own page (Phase 13, B2): `/<username>/work/<slug>`, or `/work/<slug>` on a custom domain. The password gate
 * comes before the work is looked up, so a locked page doesn't tell whether a work exists. A previous address forwards
 * (301) to the current one; a work the page doesn't list (hidden, untitled, or the Work section hidden) is a 404 that
 * links back to the portfolio; an address with no portfolio is the same 404 as a resume that isn't shared.
 */
export async function servePortfolioWork(
	request: Request,
	username: string,
	slug: string,
	trustedClient: string,
	options: ServeOptions = {},
): Promise<Response> {
	if (!(await publicPortfolioRequestAllowed(trustedClient))) return tooManyPortfolioRequests();
	const portfolio = await findPublicPortfolio(username);
	if (!portfolio) return unavailableResponse(request);
	if ((await portfolioAccess(portfolio, request.headers)) === "locked")
		return lockedPage(request, portfolio, options, `work:${slug}`);
	const view = publicPortfolioView(portfolio, options);
	const found = resolvePortfolioWork(view, slug);
	if (!found) {
		const body = renderPortfolioMissingWorkPage({
			lang: view.locale,
			dir: view.dir,
			homeUrl: homePath(portfolio, options),
			messages: portfolioMessages(view.locale),
		});
		return plainPage(body, 404, { "X-Robots-Tag": "noindex, follow" });
	}
	if (found.status === "moved")
		return new Response(null, {
			status: 301,
			headers: { Location: workPath(portfolio, options, found.slug), "Cache-Control": "private, no-store" },
		});
	return showWork(request, portfolio, found.work, view, trustedClient, options);
}

/** A work's description for search engines and previews: its summary, else its first text, else the portfolio's. */
function workDescription(work: PortfolioViewWork, view: PortfolioView): string {
	if (work.summary.trim()) return work.summary.trim();
	const text = work.blocks.find((block) => block.type === "text");
	const words = text?.type === "text" ? htmlToText(text.html) : "";
	return words ? truncateText(words, PORTFOLIO_LIMITS.text.seoDescription) : view.seo.description;
}

async function showWork(
	request: Request,
	portfolio: PublicPortfolio,
	work: PortfolioViewWork,
	view: PortfolioView,
	trustedClient: string,
	options: ServeOptions,
) {
	const counted = countVisit(request, portfolio, trustedClient, work.id);
	const live = liveWiring(request, portfolio, false, options);
	const page = await renderPage(view, live, { kind: "work", workId: work.id });
	const canonical = canonicalBase(portfolio, options);
	const canonicalUrl = canonical.work(work.slug);
	const description = workDescription(work, view);
	const cover = work.cover ? portfolioPictureUrl(work.cover.src) : undefined;
	const body = renderPortfolioDocument({
		page,
		head: {
			title: `${work.title} — ${view.basics.name}`,
			description,
			canonicalUrl,
			indexable: portfolio.indexable,
			type: "article",
			imageUrl: `${origin()}/cards/${encodeURIComponent(portfolio.username)}/work/${encodeURIComponent(work.slug)}.png`,
			structuredData: portfolio.indexable
				? {
						"@context": "https://schema.org",
						"@type": "CreativeWork",
						name: work.title,
						...(description ? { description } : {}),
						url: canonicalUrl,
						...(cover ? { image: cover } : {}),
						...(work.tags.length ? { keywords: work.tags.join(", ") } : {}),
						inLanguage: view.locale,
						dateModified: portfolio.updatedAt.toISOString(),
						author: { "@type": "Person", name: view.basics.name, url: canonical.home },
						isPartOf: { "@type": "ProfilePage", url: canonical.home },
					}
				: undefined,
		},
	});
	await counted;
	// Only the providers this work embeds may be framed (Phase 13, B17); a work page has no form, so no Turnstile.
	const providers = new Set(work.blocks.flatMap((block) => (block.type === "embed" ? [block.provider] : [])));
	return html(body, page.script, portfolio.indexable ? {} : { "X-Robots-Tag": "noindex, follow" }, {
		"frame-src": embedFrameOrigins(providers),
	});
}
