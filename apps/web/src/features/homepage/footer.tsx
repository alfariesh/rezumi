import type { Locale } from "@rezumi/utils/locale";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { defaultLocale, publishedLocales } from "@rezumi/utils/locale";
import { Container } from "./ui";

type FooterLink =
	| { label: string; href: string }
	| { label: string; to: "/ats-checker" | "/auth/register" | "/resume-templates" };

const getColumns = (): { id: string; title: string; links: FooterLink[] }[] => [
	{
		id: "product",
		title: t`Product`,
		links: [
			{ label: t`Features`, href: "#features" },
			{ label: t`Templates`, to: "/resume-templates" },
			{ label: t`ATS checker`, to: "/ats-checker" },
			{ label: t`Pricing`, href: "#pricing" },
		],
	},
	{
		id: "help",
		title: t`Help`,
		links: [
			{ label: t`Guides`, href: "/docs" },
			{ label: t`Blog`, href: "https://blog.rezumi.app" },
			{ label: t`Contact`, href: LEGAL_URLS.contact },
		],
	},
	{
		id: "legal",
		title: t`Legal`,
		links: [
			{ label: t`Privacy policy`, href: LEGAL_URLS.privacy },
			{ label: t`Terms of service`, href: LEGAL_URLS.terms },
			{ label: t`Refund policy`, href: LEGAL_URLS.refund },
			{ label: t`Licenses`, href: LEGAL_URLS.license },
		],
	},
];

const linkClass = "text-muted transition-colors hover:text-foreground";

// Read once at module load, so rendering stays pure.
const year = new Date().getFullYear();

type FooterLinkItemProps = { link: FooterLink };

// Marketing pages published in every language: from a page in another language, link to the same language's version,
// so each one is reachable by a crawler through a plain link (not only the sitemap).
const localizedPages = new Set(["/ats-checker", "/resume-templates"]);

function FooterLinkItem({ link }: FooterLinkItemProps) {
	const { i18n } = useLingui();
	if ("to" in link && localizedPages.has(link.to) && i18n.locale !== defaultLocale) {
		return (
			<a href={`${link.to}?locale=${i18n.locale}`} className={linkClass}>
				{link.label}
			</a>
		);
	}
	if ("to" in link) {
		return (
			<Link to={link.to} className={linkClass}>
				{link.label}
			</Link>
		);
	}
	return (
		<a href={link.href} className={linkClass}>
			{link.label}
		</a>
	);
}

const languageOf = (locale: Locale) => locale.split("-")[0] ?? locale;

/**
 * A language's name in itself ("Deutsch", "日本語"), so a visitor finds their own. The region shows only where two
 * locales share a language (English, Portuguese, Chinese).
 */
function nativeName(locale: Locale) {
	const language = languageOf(locale);
	const shared = publishedLocales.filter((other) => languageOf(other) === language).length > 1;
	try {
		return new Intl.DisplayNames([locale], { type: "language" }).of(shared ? locale : language) ?? locale;
	} catch {
		return locale;
	}
}

/**
 * The home page in every language, as plain links: the language menu is a script, so without these a crawler reaches
 * the other languages only through the sitemap and hreflang tags. Folded by default to keep the footer short.
 */
function FooterLanguages() {
	const { i18n } = useLingui();
	return (
		<details className="group">
			<summary className="cursor-(--cursor-interactive) list-none hover:text-foreground">
				{t`Languages`}: {nativeName(i18n.locale as Locale)}
			</summary>
			<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
				{publishedLocales.map((locale) => (
					<li key={locale}>
						<a
							href={locale === defaultLocale ? "/" : `/?locale=${locale}`}
							hrefLang={locale === "sr-SP" ? "sr" : locale}
							lang={locale}
							aria-current={locale === i18n.locale ? "page" : undefined}
							className={linkClass}
						>
							{nativeName(locale)}
						</a>
					</li>
				))}
			</ul>
		</details>
	);
}

/** The footer: the brand and its promise, the links, the languages, and the build. */
export function LandingFooter() {
	return (
		<footer className="border-t border-separator">
			<Container className="grid gap-12 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
				<div className="flex flex-col items-start gap-4">
					<span className="flex items-center gap-2.5">
						<BrandIcon variant="icon" className="size-8" alt="" />
						<span className="text-lg font-semibold tracking-tight">Rezumi</span>
					</span>
					<p className="max-w-xs text-sm text-pretty text-muted">
						{t`The resume builder that stays with you until the offer.`}
					</p>
				</div>

				<div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
					{getColumns().map((column) => (
						<nav key={column.id} aria-labelledby={`footer-${column.id}`} className="flex flex-col gap-3 text-sm">
							<h2 id={`footer-${column.id}`} className="font-semibold">
								{column.title}
							</h2>
							<ul className="flex flex-col gap-2.5">
								{column.links.map((link) => (
									<li key={link.label}>
										<FooterLinkItem link={link} />
									</li>
								))}
							</ul>
						</nav>
					))}
				</div>
			</Container>

			<Container className="border-t border-separator py-6 text-xs text-muted">
				<FooterLanguages />
			</Container>

			<Container className="flex flex-wrap items-center justify-between gap-2 border-t border-separator py-6 text-xs text-muted">
				<p>© {year} Rezumi</p>
				<p className="font-mono">v{__APP_VERSION__}</p>
			</Container>
		</footer>
	);
}
