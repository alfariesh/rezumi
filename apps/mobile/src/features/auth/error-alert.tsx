import { Alert } from "@/ui";

type ErrorAlertProps = { message: string | null; title?: string | undefined };

/** The failure of the last attempt, above the form; nothing when there is none. */
export function ErrorAlert({ message, title }: ErrorAlertProps) {
	if (!message) return null;
	return (
		<Alert status="danger" testID="auth-error">
			<Alert.Indicator />
			<Alert.Content>
				{title ? <Alert.Title>{title}</Alert.Title> : null}
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
