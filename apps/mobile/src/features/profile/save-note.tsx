// Where saving is, and which resumes followed this visit's changes. Quiet unless something needs a look.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { retryProfileSave, useProfileEditor } from "./store";
import { Button, Icon, ListRow, ListSection, Sheet, Text } from "@/ui";

export function SaveNote() {
	const { t } = useLingui();
	const status = useProfileEditor((state) => state.status);
	const followed = useProfileEditor((state) => state.followed);
	const [showFollowed, setShowFollowed] = useState(false);

	if (status === "error")
		return (
			<View accessibilityRole="alert" className="flex-row items-center gap-2" testID="profile-save-note">
				<Icon name="cloud-warning" size={18} tone="danger" />
				<Text tone="danger" className="flex-1">
					{t`Not saved yet. Your changes are kept on this device.`}
				</Text>
				<Button size="sm" variant="ghost" onPress={() => void retryProfileSave()}>
					{t`Retry`}
				</Button>
			</View>
		);

	return (
		<View
			accessibilityLiveRegion="polite"
			className="min-h-6 flex-row flex-wrap items-center gap-x-2"
			testID="profile-save-note"
		>
			<Icon name={status === "saving" ? "circle-notch" : "cloud-check"} size={18} tone="muted" />
			<Text size="xs" tone="muted" className="shrink">
				{status === "saving"
					? t`Saving…`
					: status === "saved"
						? t`Saved`
						: t`Saves as you type. Resumes that still use a part follow your changes.`}
			</Text>
			{followed.length > 0 && status !== "idle" ? (
				<Button size="sm" variant="ghost" onPress={() => setShowFollowed(true)}>
					{followed.length === 1 ? t`Updated in 1 resume` : t`Updated in ${followed.length} resumes`}
				</Button>
			) : null}
			<Sheet
				isOpen={showFollowed}
				onOpenChange={setShowFollowed}
				title={t`Resumes that followed`}
				closeLabel={t`Close`}
			>
				<Text size="xs" tone="muted">
					{t`These resumes still used the parts you changed, so they changed too. Parts a resume changed itself stay as they are.`}
				</Text>
				<ListSection>
					{followed.map((resume) => (
						<ListRow key={resume.id} title={resume.name} icon="file-text" chevron={false} />
					))}
				</ListSection>
			</Sheet>
		</View>
	);
}
