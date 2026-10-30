import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { popTransition } from "@/features/settings/root";

// The project's own links: where to read up, see the code, help translate or report a problem.
const getProjectLinks = () => [
	{ href: "https://docs.rezumi.app", label: t`Docs` },
	{ href: "https://github.com/alfariesh/rezumi", label: t`Source` },
	{ href: "https://crowdin.com/project/reactive-resume", label: t`Translate` },
	{ href: "https://github.com/alfariesh/rezumi/issues", label: t`Report a bug` },
];

export const Route = createFileRoute("/dashboard/settings")({ component: RouteComponent });

/** Account and Settings share one centred column; the account menu is how you move between them. */
function RouteComponent() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isRoot = pathname.replace(/\/$/, "") === "/dashboard/settings";

	return (
		<div className="mx-auto flex min-h-svh w-full max-w-[720px] flex-col gap-8 px-8 py-8 max-sm:px-4 max-sm:py-5">
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
			<p className="mt-auto text-xs leading-[18px] text-muted max-sm:hidden">
				<Trans>Rezumi {__APP_VERSION__} · MIT</Trans>
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
		</div>
	);
}
