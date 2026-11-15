import type { Account } from "../shared/storage";
import { Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { orpc } from "./api";
import { PageScreen } from "./page-screen";
import { PanelError } from "./panel-error";
import { SettingsScreen } from "./settings-screen";

type ConnectedScreenProps = { account: Account | null };

/**
 * Connected: the open tab's posting with the save form, or the home screen (page-screen.tsx), and the settings
 * (§3.8) behind the gear. Reading the plan first also proves the connection works, so a failure shows here (§3.7).
 */
export function ConnectedScreen({ account }: ConnectedScreenProps) {
	const { t } = useLingui();
	const [view, setView] = useState<"home" | "settings">("home");
	const summary = useQuery(orpc.billing.summary.queryOptions({ input: {} }));

	return (
		<div className="flex min-h-svh flex-col">
			<header className="flex items-center gap-2 border-b border-separator px-4 py-3">
				{view === "settings" ? (
					<IconButton icon="arrow-left" label={t`Back`} variant="ghost" size="sm" onPress={() => setView("home")} />
				) : (
					<BrandIcon variant="icon" className="size-7" />
				)}
				<h1 className="flex-1 text-base font-semibold">{view === "settings" ? <Trans>Settings</Trans> : "Rezumi"}</h1>
				{view === "home" && (
					<IconButton
						icon="gear-six"
						label={t`Settings`}
						variant="ghost"
						size="sm"
						onPress={() => setView("settings")}
					/>
				)}
			</header>

			<main className="flex flex-1 flex-col gap-4 p-4">
				{summary.isPending ? (
					<p role="status" className="flex items-center gap-2 text-sm text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						<Trans>Loading your account…</Trans>
					</p>
				) : summary.isError ? (
					<PanelError error={summary.error} onRetry={() => void summary.refetch()} />
				) : view === "settings" ? (
					<SettingsScreen account={account} summary={summary.data} />
				) : (
					<PageScreen editable />
				)}
			</main>
		</div>
	);
}
