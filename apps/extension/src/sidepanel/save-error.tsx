import type { PanelErrorKind } from "./errors";
import { Alert, Button } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { askWorker } from "./api";

type SaveErrorProps = {
	kind: PanelErrorKind;
	onRetry: () => void;
	/** For "credits": save without AI instead. */
	onWithoutAi?: () => void;
};

/**
 * 01-desain.md §3.7 for a save, a status change or a note: what went wrong and one way forward. The form keeps what
 * the person typed (its draft is in session storage), so nothing is lost.
 */
export function SaveError({ kind, onRetry, onWithoutAi }: SaveErrorProps) {
	const { t } = useLingui();
	const messages: Record<PanelErrorKind, string> = {
		offline: t`You're offline. We kept what you entered here.`,
		expired: t`The connection to Rezumi ended.`,
		"rate-limit": t`Wait a moment, then try again.`,
		credits: t`You're out of credits.`,
		outdated: t`Update the extension to continue.`,
		invalid: t`Rezumi couldn't save this. Check the details and try again.`,
		server: t`Rezumi is having trouble right now.`,
	};

	return (
		<Alert status={kind === "credits" || kind === "outdated" ? "warning" : "danger"}>
			<Alert.Indicator>
				<Icon name="warning-circle" />
			</Alert.Indicator>
			<Alert.Content className="gap-2">
				<Alert.Description>{messages[kind]}</Alert.Description>
				<div className="flex flex-wrap gap-2">
					{kind === "expired" ? (
						<Button size="sm" variant="secondary" onPress={() => void askWorker({ type: "connect" })}>
							{t`Connect again`}
						</Button>
					) : kind === "outdated" ? (
						<Button size="sm" variant="secondary" onPress={() => void chrome.runtime.requestUpdateCheck()}>
							{t`Check for updates`}
						</Button>
					) : kind === "credits" ? (
						<>
							<a
								href={rezumiLink("/dashboard/settings/billing")}
								target="_blank"
								rel="noreferrer"
								className="inline-flex h-8 items-center rounded-full border border-separator px-3 text-sm font-medium"
							>
								{t`See plans`}
							</a>
							{onWithoutAi ? (
								<Button size="sm" variant="secondary" onPress={onWithoutAi}>
									{t`Save without AI`}
								</Button>
							) : null}
						</>
					) : (
						<Button size="sm" variant="secondary" onPress={onRetry}>
							{t`Try again`}
						</Button>
					)}
				</div>
			</Alert.Content>
		</Alert>
	);
}
