import { Alert, Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { useEffect } from "react";
import { Icon } from "@rezumi/ui/components/icon";

/**
 * One way of adding a work, once chosen: back to the choices, or close the dialog. `onBusy` says whether it's in the
 * middle of something closing the dialog would cut short (an upload, an import): the dialog then doesn't close on
 * Escape or a click outside.
 */
export type StepProps = { onBack: () => void; onClose: () => void; onBusy: (busy: boolean) => void };

/** Tells the dialog while the step is busy, and that it isn't once the step goes away. */
export function useReportBusy(busy: boolean, onBusy: (busy: boolean) => void) {
	useEffect(() => {
		onBusy(busy);
		return () => onBusy(false);
	}, [busy, onBusy]);
}

type BackButtonProps = { onPress: () => void; isDisabled?: boolean };

export function BackButton({ onPress, isDisabled = false }: BackButtonProps) {
	return (
		<Button type="button" variant="ghost" isDisabled={isDisabled} onPress={onPress}>
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
