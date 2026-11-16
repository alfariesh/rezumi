import type { SectionNavItem } from "@/components/layout/section-layout";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRouteContext } from "@tanstack/react-router";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { cn } from "@rezumi/utils/style";
import { SectionLayout } from "@/components/layout/section-layout";
import { usePlan } from "@/features/billing/plan";

// Help and legal documents for the hosted service.
const getProjectLinks = () => [
	{ href: "/docs", label: t`Docs` },
	{ href: LEGAL_URLS.contact, label: t`Contact & complaints` },
	{ href: LEGAL_URLS.terms, label: t`Terms of service` },
	{ href: LEGAL_URLS.privacy, label: t`Privacy policy` },
	{ href: LEGAL_URLS.refund, label: t`Refund policy` },
	{ href: LEGAL_URLS.license, label: t`Licenses` },
];

type SettingsSectionProps = { children: ReactNode };

/**
 * Settings: Account, Plan (while plans apply) and the app's own settings, with the admin tools for administrators. The
 * section's menu on the left (chips on phones); each page has its own header. The version and legal links sit under
 * the menu on wide screens and after the page on phones. The admin pages render in it too, so the menu stays.
 */
export function SettingsSection({ children }: SettingsSectionProps) {
	const { session } = useRouteContext({ from: "/dashboard" });
	const plan = usePlan();

	const items: SectionNavItem[] = [
		{
			link: { to: "/dashboard/settings/account" },
			match: { to: "/dashboard/settings/account", fuzzy: true },
			icon: "user-circle",
			label: t`Account`,
		},
		...(plan?.enabled
			? [
					{
						link: { to: "/dashboard/settings/billing" },
						// Also the payment's return page and its receipt.
						match: { to: "/dashboard/settings/billing", fuzzy: true },
						icon: "seal-check",
						label: t`Plan`,
					} satisfies SectionNavItem,
				]
			: []),
		{
			link: { to: "/dashboard/settings/app" },
			match: { to: "/dashboard/settings/app", fuzzy: true },
			icon: "gear-six",
			label: t`App settings`,
		},
		...(session.user.role === "admin"
			? [
					{
						link: { to: "/dashboard/admin/billing" },
						match: { to: "/dashboard/admin/billing", fuzzy: true },
						icon: "shield-check",
						label: t`Billing admin`,
						group: t`Admin`,
					} satisfies SectionNavItem,
					{
						link: { to: "/dashboard/admin/portfolios", search: {} },
						match: { to: "/dashboard/admin/portfolios", fuzzy: true },
						icon: "warning-circle",
						label: t`Portfolio reports`,
					} satisfies SectionNavItem,
				]
			: []),
	];

	return (
		<SectionLayout title={t`Settings`} items={items} footer={<ProjectLinks />}>
			{children}
			{/* Phones: the menu's small print, after the page. */}
			<ProjectLinks className="mt-6 md:hidden" />
		</SectionLayout>
	);
}

type ProjectLinksProps = { className?: string };

/** The app's version, then the docs and the legal documents, each opening in a new tab. */
function ProjectLinks({ className }: ProjectLinksProps) {
	return (
		<div className={cn("grid gap-1.5 text-body-xs text-muted", className)}>
			<p>
				<Trans>Rezumi {__APP_VERSION__}</Trans>
			</p>
			<ul className="flex flex-wrap gap-x-3 gap-y-1.5 md:grid">
				{getProjectLinks().map((link) => (
					<li key={link.href}>
						<a className="underline hover:text-foreground" href={link.href} target="_blank" rel="noopener noreferrer">
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}
