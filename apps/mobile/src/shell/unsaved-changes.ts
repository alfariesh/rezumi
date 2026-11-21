// One guard for every editor (02-teknis 10): leaving a screen with unsaved edits asks first, whether by the back
// button, the Android back gesture, the iOS edge swipe or a router call. The system dialog works on both platforms.
import { t } from "@lingui/core/macro";
import { useNavigation, usePreventRemove } from "expo-router";
import { Alert } from "react-native";

type UnsavedChangesOptions = {
	/** True while there is something to lose. */
	dirty: boolean;
	/** Overrides the default question, for example "Discard this schedule?". */
	title?: string | undefined;
	message?: string | undefined;
};

export function useUnsavedChangesGuard({ dirty, title, message }: UnsavedChangesOptions) {
	const navigation = useNavigation();
	usePreventRemove(dirty, ({ data }) => {
		Alert.alert(
			title ?? t`Discard your changes?`,
			message ?? t`You have edits that aren't saved yet. Leaving now loses them.`,
			[
				{ text: t`Keep editing`, style: "cancel" },
				{ text: t`Discard`, style: "destructive", onPress: () => navigation.dispatch(data.action) },
			],
			{ cancelable: true },
		);
	});
}
