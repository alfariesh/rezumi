import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Link, useRouteContext } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { PageHeader } from "@/components/layout/page-header";
import { usePlan } from "@/features/billing/plan";
import { UserAvatar } from "@/features/user/avatar";

// Phones: a section pushes in from the end and Back returns from the start (styles in index.css, after the page
// transition). Browsers without view-transition types swap instantly, as for every other navigation.
const supportsTransitionTypes = globalThis.CSS?.supports?.("selector(:active-view-transition-type(a))") === true;
const pushTransition = supportsTransitionTypes && { types: ["page", "forward"] };
export const popTransition = supportsTransitionTypes && { types: ["page", "back"] };

type RowProps = { icon: IconName; label: ReactNode };

function Row({ icon, label }: RowProps) {
	return (
		<>
			<Icon name={icon} size={22} className="text-muted" />
			<span className="flex-1">{label}</span>
			<Icon name="caret-right" size={22} className="text-muted" />
		</>
	);
}

const rowClass =
	"flex h-14 items-center gap-3 px-3.5 font-medium text-base transition-colors duration-quick ease-enter active:bg-default";

/**
 * Phones: the root lists the pages (Plan only while plans apply, Billing admin only for administrators), with a link
 * to the docs. Sign out is in the sidebar menu.
 */
export function SettingsRoot() {
	const { session } = useRouteContext({ from: "/dashboard" });
	const plan = usePlan();

	return (
		<div className="grid gap-4">
			<PageHeader title={<Trans>Settings</Trans>} />
			<div className="flex items-center gap-3">
				<UserAvatar name={session.user.name} image={session.user.image} className="size-12" />
				<span className="grid min-w-0">
					<b className="truncate text-lg font-semibold">{session.user.name}</b>
					<span className="truncate text-sm text-muted">{session.user.email}</span>
				</span>
			</div>

			<nav aria-label={t`Settings`} className="overflow-hidden rounded-2xl bg-surface shadow-surface">
				<Link to="/dashboard/settings/account" viewTransition={pushTransition} className={rowClass}>
					<Row icon="user-circle" label={<Trans>Account</Trans>} />
				</Link>
				{/* Starts under the label: 14px padding, the 22px icon and the 12px gap. */}
				<Separator className="ms-12" />
				{plan?.enabled && (
					<>
						<Link to="/dashboard/settings/billing" viewTransition={pushTransition} className={rowClass}>
							<Row icon="seal-check" label={<Trans>Plan</Trans>} />
						</Link>
						<Separator className="ms-12" />
					</>
				)}
				<Link to="/dashboard/settings/app" viewTransition={pushTransition} className={rowClass}>
					<Row icon="gear-six" label={<Trans>Settings</Trans>} />
				</Link>
				{session.user.role === "admin" && (
					<>
						<Separator className="ms-12" />
						<Link to="/dashboard/admin/billing" viewTransition={pushTransition} className={rowClass}>
							<Row icon="shield-check" label={<Trans>Billing admin</Trans>} />
						</Link>
					</>
				)}
			</nav>

			<a
				href="https://docs.rezumi.app"
				target="_blank"
				rel="noopener noreferrer"
				className="flex h-12 items-center rounded-2xl bg-surface px-3.5 font-medium shadow-surface transition-colors duration-quick ease-enter active:bg-default"
			>
				<Trans>Help & docs</Trans>
			</a>
		</div>
	);
}
