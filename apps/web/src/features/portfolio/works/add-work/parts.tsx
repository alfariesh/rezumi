import { Alert, Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";

/** One way of adding a work, once chosen: back to the choices, or close the dialog. */
export type StepProps = { onBack: () => void; onClose: () => void };

type BackButtonProps = { onPress: () => void };

export function BackButton({ onPress }: BackButtonProps) {
	return (
		<Button type="button" variant="ghost" onPress={onPress}>
			<Icon name="arrow-left" size={16} />
			<Trans>Back</Trans>
		</Button>
	);
}

type StepAlertProps = { status: "danger" | "warning"; message: string };

export function StepAlert({ status, message }: StepAlertProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator>
				<Icon name={status === "danger" ? "warning-circle" : "warning"} />
			</Alert.Indicator>
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
