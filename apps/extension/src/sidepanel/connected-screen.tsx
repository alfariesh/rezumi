import type { Account } from "../shared/storage";
import type { ReactNode } from "react";
import { buttonVariants, Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { rezumiLink } from "../shared/config";
import { orpc } from "./api";
import { PanelError } from "./panel-error";
import { SettingsScreen } from "./settings-screen";

type ConnectedScreenProps = { account: Account | null };

/**
 * Connected: the home screen (01-desain.md §3.2; the due and recent lists arrive in Phases 04–05) and the settings
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
					<HomeScreen />
				)}
			</main>
		</div>
	);
}

/** 01-desain.md §3.2, before the lists: what to do next. */
function HomeScreen() {
	return (
		<section className="flex flex-col items-center gap-y-4 px-2 py-8 text-center">
			<span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-control text-muted">
				<Icon name="briefcase" size={24} />
			</span>
			<p className="text-sm text-balance text-muted">
				<Trans comment="Browser extension home screen when the open tab is not a job posting">
					Open a job posting to save it to Rezumi.
				</Trans>
			</p>
			<ExternalButton href={rezumiLink("/dashboard/applications")}>
				<Trans comment="Button in the browser extension that opens the application tracker on the web">
					Open application tracker
				</Trans>
			</ExternalButton>
		</section>
	);
}

type ExternalButtonProps = { href: string; children: ReactNode };

/** A link styled as a secondary button that opens Rezumi on the web in a new tab. */
function ExternalButton({ href, children }: ExternalButtonProps) {
	return (
		<a href={href} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
			{children}
			<Icon name="arrow-square-out" size={14} aria-hidden />
		</a>
	);
}
