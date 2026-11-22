import type { Autosave } from "./drafts";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Notice } from "./blocks";
import { Button, Text } from "@/ui";

type SaveErrorProps = { autosave: Autosave };

/**
 * Shown when autosave stopped (a permanent error, or retries ran out): the text is kept and the person decides. After
 * a conflict this comes back on reopen until they retry or take the server version.
 */
export function SaveError({ autosave }: SaveErrorProps) {
	const { t } = useLingui();
	if (!autosave.error) return null;
	const conflict = autosave.error === "CONFLICT";
	const takeServer = autosave.takeServerVersion;
	return (
		<View className="gap-2">
			<Notice
				status="danger"
				message={
					conflict
						? t`This changed somewhere else, so it wasn't saved. Your text is kept here; Retry saves it over the other copy.`
						: t`This wasn't saved. Your text is kept on this device.`
				}
				action={autosave.resolving ? undefined : { label: t`Retry`, onPress: autosave.retry }}
			/>
			{conflict && takeServer ? (
				<Button
					size="sm"
					variant="secondary"
					className="self-start"
					isDisabled={autosave.resolving}
					onPress={() => void takeServer()}
				>
					<Button.Label>{t`Use server version`}</Button.Label>
				</Button>
			) : null}
			{autosave.resolveFailed ? (
				<Text size="xs" tone="danger" accessibilityRole="alert">
					{t`The server version couldn't be loaded. Your text is kept; try again.`}
				</Text>
			) : null}
		</View>
	);
}
