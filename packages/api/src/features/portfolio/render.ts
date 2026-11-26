import type { PublicPortfolio } from "./public";
import type { PortfolioPage, RenderPortfolioPageInput } from "@rezumi/portfolio";
import type { PortfolioView } from "@rezumi/portfolio/view";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { env } from "@rezumi/env/server";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView, portfolioPageLocale, portfolioSourceResume } from "@rezumi/portfolio/view";
import { publicResumePath } from "@rezumi/resume/sharing";
import { ownPictureUrl } from "@rezumi/utils/own-picture";
import { isContactFormConfigured } from "./turnstile";
import { PORTFOLIO_FILE_TOKEN_PARAM, portfolioFileToken } from "./visitor-access";

const origin = () => new URL(env.APP_URL).origin;

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

export type ServeOptions = {
	/** Set on a custom domain: the page lives at its root there. */
	customDomain?: string | undefined;
};

/** The portfolio's home on the domain being served: `/<username>`, or `/` on a custom domain. */
export const homePath = (portfolio: Pick<PublicPortfolio, "username">, options: ServeOptions) =>
	options.customDomain ? "/" : `/${encodeURIComponent(portfolio.username)}`;

/** A work's page on the domain being served: `/<username>/work/<slug>`, or `/work/<slug>` on a custom domain. */
export const workPath = (portfolio: Pick<PublicPortfolio, "username">, options: ServeOptions, slug: string) =>
	`${options.customDomain ? "" : `/${encodeURIComponent(portfolio.username)}`}/work/${encodeURIComponent(slug)}`;

/**
 * The view of a published portfolio as every visitor sees it, with addresses on this app, or on the custom domain it's
 * served at: the home, each work's own page (Phase 13, B2) and the "Save contact" card (B14).
 */
export function publicPortfolioView(
	portfolio: PublicPortfolio,
	options: ServeOptions = {},
	fileUrl = (key: string) => signedFileUrl(key, portfolio.passwordHash),
): PortfolioView {
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
		fileUrl,
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

/** Shared renderer with the fonts, icons and asset filters used by the public page. */
export async function renderPortfolioOnServer(
	view: PortfolioView,
	year: number,
	options: Pick<RenderPortfolioPageInput, "live" | "page" | "imageUrl">,
): Promise<PortfolioPage> {
	const names = portfolioIconNames(view);
	// Icon shapes load with the first page that uses one; most pages use none.
	const glyphs = names.length
		? await import("@rezumi/pdf/icon-glyphs").then(({ loadIconGlyphs }) => loadIconGlyphs("standard"))
		: {};
	const icons = Object.fromEntries(names.flatMap((name) => (glyphs[name] ? [[name, glyphs[name]]] : [])));
	return renderPortfolioPage({
		view,
		messages: portfolioMessages(view.locale),
		icons,
		year,
		creditUrl: origin(),
		...options,
		imageUrl: options.imageUrl ?? portfolioFileAddress,
	});
}
