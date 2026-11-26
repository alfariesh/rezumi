import type { TextInputProps } from "react-native";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { TextInput } from "react-native";
import { size, space } from "./tokens";

/** A compact multiline field for a composer, which grows with the message then scrolls. */
export function ChatInput(props: TextInputProps) {
	const muted = useThemeColor("muted");
	const [contentHeight, setContentHeight] = useState(0);
	const height = props.value ? Math.min(Math.max(contentHeight, size.hit), space[16] + space[12]) : size.hit;
	return (
		<TextInput
			{...props}
			multiline
			onContentSizeChange={(event) => setContentHeight(event.nativeEvent.contentSize.height)}
			textAlignVertical="center"
			placeholderTextColor={muted}
			className="flex-1 px-1 py-2 text-base font-normal text-foreground"
			style={{ height }}
		/>
	);
}
