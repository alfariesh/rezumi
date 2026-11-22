// The Profile was saved somewhere else while this device had unsent edits: a required choice, like a draft's
// conflict. Keeping mine sends these edits over the newer version; using the saved one drops them.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { resolveProfileConflict, useProfileEditor } from "./store";
import { Button, ConfirmDialog, Sheet, Text } from "@/ui";

export function ProfileConflictSheet() {
	const { t } = useLingui();
	const conflict = useProfileEditor((state) => state.conflict);
	const [confirm, setConfirm] = useState(false);
	const [busy, setBusy] = useState(false);

	const resolve = async (choice: "keep-mine" | "use-theirs") => {
		setConfirm(false);
		setBusy(true);
		try {
			await resolveProfileConflict(choice);
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Sheet
				isOpen={conflict !== null}
				onOpenChange={() => undefined}
				canDismiss={false}
				onDismissAttempt={() => undefined}
				title={t`Your Profile changed elsewhere`}
				testID="profile-conflict"
				footer={
					<View className="gap-2">
						<Button isDisabled={busy} onPress={() => void resolve("keep-mine")}>
							{t`Keep my changes`}
						</Button>
						<Button variant="secondary" isDisabled={busy} onPress={() => setConfirm(true)}>
							{t`Use the saved version`}
						</Button>
					</View>
				}
			>
				<Text>
					{t`Your Profile was saved on another device or on the web while you were editing here. Your changes are still on this device. Choose which version to keep.`}
				</Text>
			</Sheet>
			<ConfirmDialog
				isOpen={confirm}
				onOpenChange={setConfirm}
				title={t`Use the saved version?`}
				message={t`The changes you made on this device since then will be lost.`}
				confirmLabel={t`Use saved version`}
				cancelLabel={t`Keep my changes`}
				onConfirm={() => void resolve("use-theirs")}
				destructive
			/>
		</>
	);
}
