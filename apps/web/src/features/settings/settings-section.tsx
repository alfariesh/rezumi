import type { SectionNavItem } from "@/components/layout/section-layout";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useRouteContext } from "@tanstack/react-router";
import { SectionLayout } from "@/components/layout/section-layout";
import { usePlan } from "@/features/billing/plan";

type SettingsSectionProps = { children: ReactNode };

/**
 * Settings: Account, Plan (while plans apply) and the app's own settings, with the admin tools for administrators. The
 * section's menu on the left (chips on phones); each page has its own header. The admin pages render in it too, so the
 * menu stays. The version, docs and legal documents have a page of their own (Help & legal, `/dashboard/help`).
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
						link: { to: "/dashboard/admin/accounts", search: {} },
						match: { to: "/dashboard/admin/accounts", fuzzy: true },
						icon: "rows",
						label: t`Accounts`,
						group: t`Admin`,
					} satisfies SectionNavItem,
					{
						link: { to: "/dashboard/admin/billing" },
						match: { to: "/dashboard/admin/billing", fuzzy: true },
						icon: "shield-check",
						label: t`Billing admin`,
					} satisfies SectionNavItem,
					{
						link: { to: "/dashboard/admin/portfolios", search: {} },
						match: { to: "/dashboard/admin/portfolios", fuzzy: true },
						icon: "warning-circle",
						label: t`Portfolio reports`,
					} satisfies SectionNavItem,
					{
						link: { to: "/dashboard/admin/jobs" },
						match: { to: "/dashboard/admin/jobs", fuzzy: true },
						icon: "list-magnifying-glass",
						label: t`Job search costs`,
					} satisfies SectionNavItem,
				]
			: []),
	];

	return (
		<SectionLayout title={t`Settings`} items={items}>
			{children}
		</SectionLayout>
	);
}
