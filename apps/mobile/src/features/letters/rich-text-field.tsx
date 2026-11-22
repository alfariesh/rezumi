// Rich text (react-native-enriched-html) for the letter body and an older letter's recipient. Only an edited field is
// re-serialised; the session logic lives in `features/write/rich-text.ts`. Render `LetterRichTextToolbar` once on the
// screen for bold, italic, underline and lists above the keyboard. No Improve on letters.
import type { RichTextSession } from "@/features/write/rich-text";
import type { IconName } from "@/ui";
import type { RefObject } from "react";
import type { EnrichedTextInputInstance, OnChangeStateEvent } from "react-native-enriched-html";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ScrollView, View } from "react-native";
import { EnrichedTextInput } from "react-native-enriched-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { letterFieldFocus } from "@/draft";
import { createRichTextSession } from "@/features/write/rich-text";
import { Button, IconButton, Label, cx, space, useKeyboardVisible, useResolveClassNames, useThemeColor } from "@/ui";

/** The focused editor, for the toolbar docked above the keyboard (one per screen). */
type ActiveEditor = {
	ref: RefObject<EnrichedTextInputInstance | null>;
	state: OnChangeStateEvent | null;
	/** A toolbar command: its report is written even if focus moved meanwhile. */
	command: () => void;
};

let active: ActiveEditor | null = null;
const listeners = new Set<() => void>();
const setActive = (next: ActiveEditor | null) => {
	active = next;
	for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** The editor's serialisation of the value it holds; edits are measured against it. */
const loadBaseline = (
	ref: RefObject<EnrichedTextInputInstance | null>,
	session: RichTextSession,
	write: (html: string) => void,
) =>
	void ref.current
		?.getHTML()
		.then((html) => {
			const held = session.baseline(html);
			if (held !== null) write(held);
		})
		.catch(() => undefined);

const LINE = 24;

type LetterRichTextProps = {
	label: string;
	value: string;
	/** Receives letter HTML, only after the person edits this field. */
	onChange: (html: string) => void;
	disabled?: boolean | undefined;
	autoFocus?: boolean | undefined;
	minLines?: number | undefined;
	testID?: string | undefined;
};

export function LetterRichText({
	label,
	value,
	onChange,
	disabled = false,
	autoFocus,
	minLines = 8,
	testID,
}: LetterRichTextProps) {
	const [foreground, muted, accent, accentSoft] = useThemeColor(["foreground", "muted", "accent", "accent-soft"]);
	// The interface font and body size from the design system, the way a `Text` gets them.
	const { fontFamily, fontSize } = useResolveClassNames("font-normal text-base");
	const ref = useRef<EnrichedTextInputInstance>(null);
	const [session] = useState(() => createRichTextSession(value));
	const [focused, setFocused] = useState(false);

	// Undo, a kept draft and remote updates change the text from outside; load them while the field isn't focused.
	useEffect(() => {
		const markup = session.external(value);
		if (markup === null) return;
		ref.current?.setValue(markup);
		loadBaseline(ref, session, onChange);
	});

	useEffect(() => {
		loadBaseline(ref, session, () => undefined);
		return () => {
			if (active?.ref === ref) setActive(null);
		};
	}, [session]);

	const inputStyle = {
		minHeight: LINE * minLines + space[3] * 2,
		paddingHorizontal: space[3],
		paddingVertical: space[3],
		color: foreground,
		...(typeof fontFamily === "string" ? { fontFamily } : {}),
		...(typeof fontSize === "number" ? { fontSize } : {}),
	};
	const htmlStyle = {
		a: { color: accent, textDecorationLine: "underline" as const },
		ul: { bulletColor: muted },
		ol: { markerColor: muted },
	};

	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			<View
				className={cx(
					"overflow-hidden rounded-field border bg-background",
					focused ? "border-accent" : "border-transparent",
					disabled && "opacity-60",
				)}
			>
				<EnrichedTextInput
					ref={ref}
					testID={testID}
					accessibilityLabel={label}
					// The initial markup only: changing defaultValue reloads the editor and moves the caret.
					defaultValue={session.markup}
					editable={!disabled}
					autoFocus={autoFocus ?? false}
					placeholderTextColor={muted}
					cursorColor={accent}
					selectionColor={accentSoft}
					linkRegex={null}
					style={inputStyle}
					htmlStyle={htmlStyle}
					onFocus={() => {
						session.focus();
						letterFieldFocus.onFocus();
						setFocused(true);
						loadBaseline(ref, session, onChange);
						setActive({ ref, state: active?.ref === ref ? active.state : null, command: session.command });
					}}
					onBlur={() => {
						session.blur();
						letterFieldFocus.onBlur();
						setFocused(false);
						if (active?.ref === ref) setActive(null);
					}}
					onChangeHtml={(event) => {
						const html = session.change(event.nativeEvent.value);
						if (html !== null) onChange(html);
					}}
					onChangeState={(event) => {
						if (active?.ref === ref) setActive({ ...active, state: event.nativeEvent });
					}}
				/>
			</View>
		</View>
	);
}

type ToolbarButton = { key: string; icon: IconName; label: string; isActive: boolean | undefined; run: () => void };

/** Bold, italic, underline and lists above the keyboard while a letter field has focus, with Done at the end. */
export function LetterRichTextToolbar() {
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardVisible();
	const editor = useSyncExternalStore(subscribe, () => active);
	if (!editor) return null;
	const input = () => {
		editor.command();
		return editor.ref.current;
	};
	const state = editor.state;

	const buttons: ToolbarButton[] = [
		{ key: "b", icon: "text-b", label: t`Bold`, isActive: state?.bold.isActive, run: () => input()?.toggleBold() },
		{
			key: "i",
			icon: "text-italic",
			label: t`Italic`,
			isActive: state?.italic.isActive,
			run: () => input()?.toggleItalic(),
		},
		{
			key: "u",
			icon: "text-underline",
			label: t`Underline`,
			isActive: state?.underline.isActive,
			run: () => input()?.toggleUnderline(),
		},
		{
			key: "ul",
			icon: "list-bullets",
			label: t`Bulleted list`,
			isActive: state?.unorderedList.isActive,
			run: () => input()?.toggleUnorderedList(),
		},
		{
			key: "ol",
			icon: "list-numbers",
			label: t`Numbered list`,
			isActive: state?.orderedList.isActive,
			run: () => input()?.toggleOrderedList(),
		},
	];
	// Above the keyboard the bar sits flush; without it, it clears the home indicator.
	const toolbarStyle = { paddingBottom: keyboardVisible ? 0 : insets.bottom };

	return (
		<View
			accessibilityRole="toolbar"
			accessibilityLabel={t`Formatting`}
			className="flex-row items-center border-t border-separator bg-overlay"
			style={toolbarStyle}
		>
			<ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}>
				<View className="flex-row items-center px-1">
					{buttons.map((button) => (
						<IconButton
							key={button.key}
							variant="ghost"
							icon={button.icon}
							label={button.label}
							isSelected={button.isActive ?? false}
							onPress={button.run}
						/>
					))}
				</View>
			</ScrollView>
			<Button variant="ghost" onPress={() => editor.ref.current?.blur()}>
				{t`Done`}
			</Button>
			<View className="w-2" />
		</View>
	);
}
