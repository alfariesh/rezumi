import type { Account } from "../shared/storage";
import type { RouterOutput } from "./api";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { EXTENSION_VERSION } from "../shared/config";
import { askWorker } from "./api";

type SettingsScreenProps = {
	account: Account | null;
	summary: RouterOutput["billing"]["summary"];
};

const planName = (planId: string) => (planId === "plus" ? "Plus" : planId === "pro-ai" ? "Pro AI" : null);

/**
 * 01-desain.md §3.8, first part: the connected account (name, email, plan) and Sign out. Language, default resume,
 * the on-page button and notifications join in Phases 04–05.
 */
export function SettingsScreen({ account, summary }: SettingsScreenProps) {
	const { t } = useLingui();
	const signOut = useMutation({ mutationFn: () => askWorker({ type: "disconnect" }) });
	// Plans that don't apply (billing off) say nothing about a plan.
	const plan = summary.enabled ? (planName(summary.planId) ?? t`Free`) : null;

	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="account-heading" className="flex flex-col gap-3">
				<h2 id="account-heading" className="text-xs font-semibold text-muted">
					<Trans>Account</Trans>
				</h2>
				<div className="flex items-center gap-3">
					<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-control">
						<Icon name="user-circle" size={22} />
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{account?.name || t`Rezumi account`}</p>
						{account?.email ? <p className="truncate text-sm text-muted">{account.email}</p> : null}
					</div>
					{plan ? (
						<span className="shrink-0 rounded-full bg-control px-2.5 py-0.5 text-xs font-medium">{plan}</span>
					) : null}
				</div>
				<Button variant="secondary" isPending={signOut.isPending} onPress={() => signOut.mutate()}>
					<Icon name="sign-out" size={16} aria-hidden />
					<Trans comment="Button in the browser extension that disconnects it from the Rezumi account">Sign out</Trans>
				</Button>
			</section>

			<p className="text-xs text-muted">
				<Trans>Version {EXTENSION_VERSION}</Trans>
			</p>
		</div>
	);
}
