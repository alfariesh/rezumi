import type { IconName } from "@rezumi/ui/components/icon";
import { Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { renderAsH2 } from "@/libs/typography";

type HelpLink = { href: string; icon: IconName; label: string };

/** The docs and the hosted service's legal documents, each opening in a new tab. */
const getHelpLinks = (): HelpLink[] => [
	{ href: "/docs", icon: "book-open", label: t`Docs` },
	{ href: LEGAL_URLS.contact, icon: "chat-centered-text", label: t`Contact & complaints` },
	{ href: LEGAL_URLS.terms, icon: "scroll", label: t`Terms of service` },
	{ href: LEGAL_URLS.privacy, icon: "shield-check", label: t`Privacy policy` },
	{ href: LEGAL_URLS.refund, icon: "arrow-counter-clockwise", label: t`Refund policy` },
	{ href: LEGAL_URLS.license, icon: "code", label: t`Licenses` },
];

/** Help & legal: the app's version, then the docs and legal documents as a grid of cards. Opened from the account menu. */
export function HelpPage() {
	return (
		<Page>
			<PageHeader title={t`Help & legal`} description={<Trans>Rezumi {__APP_VERSION__}</Trans>} />
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{getHelpLinks().map((link) => (
					<li key={link.href}>
						<HelpCard link={link} />
					</li>
				))}
			</ul>
		</Page>
	);
}

type HelpCardProps = { link: HelpLink };

/** One card: the icon at the top, the title at the bottom; it opens in a new tab. */
function HelpCard({ link }: HelpCardProps) {
	return (
		<a
			href={link.href}
			target="_blank"
			rel="noopener noreferrer"
			className="flex h-full min-h-32 flex-col gap-6 rounded-3xl bg-surface p-4 shadow-surface transition-[background-color,scale] duration-quick ease-enter outline-none hover:bg-default/50 focus-visible:ring-2 focus-visible:ring-focus active:scale-[0.98]"
		>
			<span className="flex items-start justify-between gap-2">
				<Icon name={link.icon} size={24} className="text-muted" />
				<Icon name="arrow-up-right" size={16} className="text-muted" aria-hidden />
			</span>
			<Typography type="h5" render={renderAsH2} className="mt-auto">
				{link.label}
			</Typography>
		</a>
	);
}
