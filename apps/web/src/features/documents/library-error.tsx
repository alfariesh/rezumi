import { Alert, Button, Spinner } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";

type LibraryErrorProps = {
	retrying: boolean;
	onRetry: () => void;
};

export function LibraryError({ retrying, onRetry }: LibraryErrorProps) {
	return (
		<Alert status="danger" role="alert">
			<Alert.Indicator>
				<Icon name="warning-circle" />
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Title>
					<Trans>Couldn't load documents</Trans>
				</Alert.Title>
				<Alert.Description>
					<p>
						<Trans>Check your connection and try again.</Trans>
					</p>
					<Button variant="secondary" className="mt-2" isPending={retrying} onPress={onRetry}>
						{retrying && <Spinner size="sm" color="current" aria-hidden />}
						{retrying ? <Trans>Retrying…</Trans> : <Trans>Try again</Trans>}
					</Button>
				</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
