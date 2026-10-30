import { Button, Spinner } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Alert, AlertDescription, AlertTitle } from "@rezumi/ui/components/alert";
import { Icon } from "@rezumi/ui/components/icon";

type LibraryErrorProps = {
	retrying: boolean;
	onRetry: () => void;
};

export function LibraryError({ retrying, onRetry }: LibraryErrorProps) {
	return (
		<Alert variant="error">
			<Icon name="warning-circle" />
			<AlertTitle>
				<Trans>Couldn't load documents</Trans>
			</AlertTitle>
			<AlertDescription>
				<p>
					<Trans>Check your connection and try again.</Trans>
				</p>
				<Button variant="secondary" className="mt-2" isPending={retrying} onPress={onRetry}>
					{retrying && <Spinner size="sm" color="current" aria-hidden />}
					{retrying ? <Trans>Retrying…</Trans> : <Trans>Try again</Trans>}
				</Button>
			</AlertDescription>
		</Alert>
	);
}
