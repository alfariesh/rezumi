import { Alert, Button, Skeleton } from "@heroui/react";
import { Trans } from "@lingui/react/macro";

type CareerLoadErrorProps = { onRetry: () => void };

export function CareerLoadError({ onRetry }: CareerLoadErrorProps) {
	return (
		<Alert status="danger" role="alert" className="items-center">
			<Alert.Indicator className="shrink-0" />
			<Alert.Content>
				<Alert.Description>
					<Trans>Couldn't load this. Your saved data hasn't changed.</Trans>
				</Alert.Description>
			</Alert.Content>
			<Button variant="secondary" size="sm" onPress={onRetry}>
				<Trans>Try again</Trans>
			</Button>
		</Alert>
	);
}

export function CareerLoading() {
	return <Skeleton className="h-40 rounded-2xl" />;
}
