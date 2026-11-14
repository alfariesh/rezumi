import { Alert, Button } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { Icon } from "@rezumi/ui/components/icon";
import { OfflineError } from "./api";

type PanelErrorProps = {
	error: unknown;
	/** Tries the failed request again. */
	onRetry: () => void;
};

/**
 * 01-desain.md §3.7: a short message and one way forward. A connection the server ended never shows here: the service
 * worker marks it expired and the panel goes back to "Connect again".
 */
export function PanelError({ error, onRetry }: PanelErrorProps) {
	const { t } = useLingui();
	const code = error instanceof ORPCError ? String(error.code) : null;

	const outdated = code === "EXTENSION_OUTDATED";
	const message =
		error instanceof OfflineError
			? t`You're offline. Check your connection and try again.`
			: outdated
				? t`Update the extension to continue.`
				: code === "TOO_MANY_REQUESTS" || code === "RATE_LIMIT_EXCEEDED"
					? t`Wait a moment, then try again.`
					: t`Rezumi is having trouble right now.`;

	return (
		<Alert status={outdated ? "warning" : "danger"}>
			<Alert.Indicator>
				<Icon name="warning-circle" />
			</Alert.Indicator>
			<Alert.Content className="gap-2">
				<Alert.Description>{message}</Alert.Description>
				<div>
					{outdated ? (
						<Button size="sm" variant="secondary" onPress={() => void chrome.runtime.requestUpdateCheck()}>
							{t`Check for updates`}
						</Button>
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
