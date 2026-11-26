import { Alert } from "react-native";

type OperationConsentOptions = {
	title: string;
	message: string;
	allowLabel: string;
	cancelLabel: string;
};

/** The native alert presents over an editor or sheet and receives system accessibility focus. */
export function confirmOperation({ title, message, allowLabel, cancelLabel }: OperationConsentOptions) {
	return new Promise<boolean>((resolve) => {
		Alert.alert(
			title,
			message,
			[
				{ text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
				{ text: allowLabel, onPress: () => resolve(true) },
			],
			{ cancelable: true, onDismiss: () => resolve(false) },
		);
	});
}
