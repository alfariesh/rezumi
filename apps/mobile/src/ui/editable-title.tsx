// A title that renames in place (the editor's document name, as on the web's editor bar): tap it and it becomes a
// field; Return or leaving the field keeps the new name, an empty or unchanged one puts the old name back.
import type { ReactNode } from "react";
import { Input } from "heroui-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "./icon";
import { Typography } from "./text";
import { size } from "./tokens";

export type EditableTitleProps = {
	value: string;
	onSubmit: (value: string) => void;
	/** Names the field and the button for screen readers ("Document name"). */
	accessibilityLabel: string;
	/** Read after the name on the button ("Double tap to rename"). */
	accessibilityHint?: string | undefined;
	/** Read-only (a locked document): the name shows without the button. */
	isDisabled?: boolean | undefined;
	maxLength?: number | undefined;
	/** Under the name: the save status. */
	subtitle?: ReactNode;
};

export function EditableTitle({
	value,
	onSubmit,
	accessibilityLabel,
	accessibilityHint,
	isDisabled = false,
	maxLength = 100,
	subtitle,
}: EditableTitleProps) {
	const [draft, setDraft] = useState<string | null>(null);

	const commit = () => {
		if (draft === null) return;
		const next = draft.trim();
		setDraft(null);
		if (next && next !== value) onSubmit(next);
	};

	if (draft !== null)
		return (
			<View className="min-w-0 flex-1">
				<Input
					autoFocus
					value={draft}
					onChangeText={setDraft}
					onSubmitEditing={commit}
					onBlur={commit}
					selectTextOnFocus
					returnKeyType="done"
					maxLength={maxLength}
					accessibilityLabel={accessibilityLabel}
					testID="editable-title-input"
				/>
			</View>
		);

	return (
		<View className="min-w-0 flex-1 justify-center">
			<Pressable
				accessibilityRole={isDisabled ? "text" : "button"}
				accessibilityLabel={`${accessibilityLabel}: ${value}`}
				accessibilityHint={isDisabled ? undefined : accessibilityHint}
				disabled={isDisabled}
				onPress={() => setDraft(value)}
				hitSlop={8}
				className="min-w-0 flex-row items-center gap-1 self-start active:opacity-60"
				testID="editable-title"
			>
				<Typography.Heading type="h6" numberOfLines={1} className="shrink">
					{value}
				</Typography.Heading>
				{isDisabled ? null : <Icon name="pencil-simple" size={size.icon.sm} tone="muted" />}
			</Pressable>
			{subtitle}
		</View>
	);
}
