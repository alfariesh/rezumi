import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { Page } from "@/components/layout/page";
import { popTransition } from "@/features/settings/root";

// Help and legal documents for the hosted service.
const getProjectLinks = () => [
	{ href: "/docs", label: t`Docs` },
	{ href: LEGAL_URLS.contact, label: t`Contact & complaints` },
	{ href: LEGAL_URLS.terms, label: t`Terms of service` },
	{ href: LEGAL_URLS.privacy, label: t`Privacy policy` },
	{ href: LEGAL_URLS.refund, label: t`Refund policy` },
	{ href: LEGAL_URLS.license, label: t`Licenses` },
];

export const Route = createFileRoute("/dashboard/settings")({ component: RouteComponent });

/** Account and Settings share one centred column; the account menu is how you move between them. */
function RouteComponent() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isRoot = pathname.replace(/\/$/, "") === "/dashboard/settings";

	return (
		// At least the height under the 48px navbar, so the links sit at the bottom without making a short page scroll.
		<Page width="narrow" className="min-h-[calc(100svh-3rem)] gap-8">
			{!isRoot && (
				<Link
					to="/dashboard/settings"
					viewTransition={popTransition}
					className="-mb-4 inline-flex h-9 w-fit items-center gap-1 text-sm text-muted sm:hidden"
				>
					<Icon name="caret-left" size={20} />
					<Trans>Back</Trans>
				</Link>
			)}
			<Outlet />
			<p className="mt-auto text-body-xs text-muted max-sm:hidden">
				<Trans>Rezumi {__APP_VERSION__}</Trans>
				{" · "}
				{getProjectLinks().map((link, index) => (
					<Fragment key={link.href}>
						{index > 0 && " · "}
						<a className="underline hover:text-foreground" href={link.href} target="_blank" rel="noopener noreferrer">
							{link.label}
						</a>
					</Fragment>
				))}
			</p>
		</Page>
	);
}
