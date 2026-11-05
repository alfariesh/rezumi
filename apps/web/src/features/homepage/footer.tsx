import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
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

function FooterLinkItem({ link }: FooterLinkItemProps) {
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

/** The footer: the brand and its promise, the links, and the build. */
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

			<Container className="flex flex-wrap items-center justify-between gap-2 border-t border-separator py-6 text-xs text-muted">
				<p>© {year} Rezumi</p>
				<p className="font-mono">v{__APP_VERSION__}</p>
			</Container>
		</footer>
	);
}
