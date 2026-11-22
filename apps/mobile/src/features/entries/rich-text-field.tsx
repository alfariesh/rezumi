import type { RichTextSession } from "@/features/write/rich-text";
// Rich text (react-native-enriched-html) for descriptions and the summary. The formatting toolbar docks above the
// keyboard while a field has focus; render `RichTextToolbar` once on the screen. Only an edited field is re-serialised,
// so opening a description never rewrites it. The session logic lives in `features/write/rich-text.ts`.
import type { IconName } from "@/ui";
import type { ComponentRef, RefObject } from "react";
import type { EnrichedTextInputInstance, OnChangeStateEvent } from "react-native-enriched-html";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ScrollView, View } from "react-native";
import { EnrichedTextInput } from "react-native-enriched-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWriteSource } from "./source";
import { createRichTextSession } from "@/features/write/rich-text";
import {
	Button,
	IconButton,
	Input,
	Label,
	ListRow,
	ListSection,
	Sheet,
	Text,
	TextField,
	cx,
	size,
	space,
	useKeyboardVisible,
	useResolveClassNames,
	useThemeColor,
} from "@/ui";

/** The focused editor, for the toolbar docked above the keyboard (one per screen). */
type ActiveEditor = {
	ref: RefObject<EnrichedTextInputInstance | null>;
	focused: boolean;
	state: OnChangeStateEvent | null;
	selection: { start: number; end: number; text: string };
	/** Marks the next report as the result of a toolbar command or link, so it's saved even after focus moved. */
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
const useActiveEditor = () => useSyncExternalStore(subscribe, () => active);

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

type RichTextFieldProps = {
	label: string;
	value: string;
	/** Receives resume HTML, only after the person edits this field. */
	onChange: (html: string) => void;
	/** Guidance while editing ("2–3 sentences reads best"). */
	hint?: string | undefined;
	disabled?: boolean | undefined;
	autoFocus?: boolean | undefined;
	testID?: string | undefined;
};

export function RichTextField({
	label,
	value,
	onChange,
	hint,
	disabled = false,
	autoFocus,
	testID,
}: RichTextFieldProps) {
	const { t } = useLingui();
	const { focus } = useWriteSource();
	const [foreground, muted, accent, accentSoft, surfaceSecondary] = useThemeColor([
		"foreground",
		"muted",
		"accent",
		"accent-soft",
		"surface-secondary",
	]);
	// The interface font and body size from the design system, the way a `Text` gets them.
	const { fontFamily, fontSize } = useResolveClassNames("font-normal text-base");
	const ref = useRef<EnrichedTextInputInstance>(null);
	const [session] = useState(() => createRichTextSession(value));
	const [focused, setFocused] = useState(false);
	const [text, setText] = useState("");
	const editor = useRef<ActiveEditor | null>(null);
	// Table markup can't be edited safely by the native editor; it stays as it is.
	const readOnly = useMemo(() => /<table[\s>]/i.test(value), [value]);
	const editable = !disabled && !readOnly;

	const readBaseline = () => loadBaseline(ref, session, onChange);

	// Undo and remote updates change the text from outside; load them while the field isn't focused.
	useEffect(() => {
		const markup = session.external(value);
		if (markup === null) return;
		ref.current?.setValue(markup);
		readBaseline();
	});

	useEffect(() => {
		loadBaseline(ref, session, () => undefined);
		return () => {
			if (active?.ref === ref) setActive(null);
		};
	}, [session]);

	const publish = (change: Partial<ActiveEditor>) => {
		if (!editor.current) return;
		editor.current = { ...editor.current, ...change };
		if (editor.current.focused || active?.ref === ref) setActive(editor.current);
	};

	const inputStyle = {
		minHeight: LINE * 4 + space[3] * 2,
		maxHeight: 360,
		paddingHorizontal: space[3],
		paddingVertical: space[3],
		color: foreground,
		...(typeof fontFamily === "string" ? { fontFamily } : {}),
		...(typeof fontSize === "number" ? { fontSize } : {}),
	};
	const htmlStyle = {
		a: { color: accent, textDecorationLine: "underline" as const },
		code: { color: foreground, backgroundColor: surfaceSecondary },
		ul: { bulletColor: muted },
		ol: { markerColor: muted },
	};

	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			{readOnly ? (
				<Text size="xs" tone="muted">
					{t`Original table formatting is kept. This text is read-only because it can't be edited safely here.`}
				</Text>
			) : null}
			<View
				className={cx(
					"overflow-hidden rounded-field border bg-background",
					focused ? "border-accent" : "border-transparent",
					!editable && "opacity-60",
				)}
			>
				<EnrichedTextInput
					ref={ref}
					testID={testID}
					accessibilityLabel={label}
					// The initial markup only: changing defaultValue reloads the editor and moves the caret.
					defaultValue={session.markup}
					editable={editable}
					autoFocus={autoFocus ?? false}
					placeholderTextColor={muted}
					cursorColor={accent}
					selectionColor={accentSoft}
					linkRegex={null}
					style={inputStyle}
					htmlStyle={htmlStyle}
					onFocus={() => {
						session.focus();
						focus.onFocus();
						setFocused(true);
						readBaseline();
						editor.current = {
							ref,
							focused: true,
							state: editor.current?.state ?? null,
							selection: editor.current?.selection ?? { start: 0, end: 0, text: "" },
							command: session.command,
						};
						setActive(editor.current);
					}}
					onBlur={() => {
						session.blur();
						focus.onBlur();
						setFocused(false);
						publish({ focused: false });
					}}
					onChangeHtml={(event) => {
						const html = session.change(event.nativeEvent.value);
						if (html !== null) onChange(html);
					}}
					onChangeText={(event) => setText(event.nativeEvent.value)}
					onChangeState={(event) => publish({ state: event.nativeEvent })}
					onChangeSelection={(event) => publish({ selection: event.nativeEvent })}
				/>
			</View>
			{focused ? (
				<View className="flex-row justify-between gap-3">
					<Text size="xs" tone="muted" className="flex-1">
						{hint ?? ""}
					</Text>
					<Text size="xs" tone="muted" mono tabular>
						{plural(text.trim().length, { one: "# character", other: "# characters" })}
					</Text>
				</View>
			) : null}
		</View>
	);
}

type ToolbarButton = { key: string; icon: IconName; label: string; isActive: boolean | undefined; run: () => void };

/**
 * The formatting toolbar above the keyboard: bold, italic, lists, link, text style, and Done pinned at the end. It
 * scrolls sideways when it doesn't fit.
 */
export function RichTextToolbar() {
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardVisible();
	const editor = useActiveEditor();
	const [linkOpen, setLinkOpen] = useState(false);
	const [link, setLink] = useState("https://");
	const [styleOpen, setStyleOpen] = useState(false);
	const formattingScroll = useRef<ComponentRef<typeof ScrollView>>(null);
	// The last focused editor stays active after blur, so sheets keep working on it after taking focus.
	const target = () => {
		editor?.command();
		return editor?.ref.current;
	};
	const state = editor?.state;

	const heading = state?.h1.isActive ? 1 : state?.h2.isActive ? 2 : state?.h3.isActive ? 3 : 0;
	const buttons: ToolbarButton[] = [
		{ key: "b", icon: "text-b", label: t`Bold`, isActive: state?.bold.isActive, run: () => target()?.toggleBold() },
		{
			key: "i",
			icon: "text-italic",
			label: t`Italic`,
			isActive: state?.italic.isActive,
			run: () => target()?.toggleItalic(),
		},
		{
			key: "ul",
			icon: "list-bullets",
			label: t`Bulleted list`,
			isActive: state?.unorderedList.isActive,
			run: () => target()?.toggleUnorderedList(),
		},
		{
			key: "ol",
			icon: "list-numbers",
			label: t`Numbered list`,
			isActive: state?.orderedList.isActive,
			run: () => target()?.toggleOrderedList(),
		},
		{
			key: "a",
			icon: "link-simple-horizontal",
			label: t`Link`,
			isActive: state?.link.isActive,
			run: () => {
				setLink("https://");
				setLinkOpen(true);
			},
		},
		{ key: "h", icon: "text-aa", label: t`Text style`, isActive: heading > 0, run: () => setStyleOpen(true) },
	];
	const marks: ToolbarButton[] = [
		{
			key: "u",
			icon: "text-underline",
			label: t`Underline`,
			isActive: state?.underline.isActive,
			run: () => target()?.toggleUnderline(),
		},
		{
			key: "s",
			icon: "text-strikethrough",
			label: t`Strikethrough`,
			isActive: state?.strikeThrough.isActive,
			run: () => target()?.toggleStrikeThrough(),
		},
	];

	const setHeading = (level: number) => {
		const input = target();
		if (!input) return;
		const toggle = (which: number) => {
			if (which === 1) input.toggleH1();
			if (which === 2) input.toggleH2();
			if (which === 3) input.toggleH3();
		};
		// Off with the current heading, then on with the new one ("Paragraph" is just off).
		if (level !== heading) {
			if (heading) toggle(heading);
			if (level) toggle(level);
		}
		setStyleOpen(false);
		input.focus();
	};

	const applyLink = () => {
		setLinkOpen(false);
		const input = target();
		const selection = editor?.selection;
		if (!input || !selection) return;
		const url = link.trim();
		if (!url || url === "https://") input.removeLink(selection.start, selection.end);
		else input.setLink(selection.start, selection.end, selection.text || url, url);
		input.focus();
	};

	const toolbarStyle = {
		minHeight: size.hit + space[1] * 2 + (keyboardVisible ? 0 : insets.bottom),
		paddingBottom: keyboardVisible ? 0 : insets.bottom,
	};

	return (
		<>
			{editor?.focused ? (
				<View
					accessibilityRole="toolbar"
					accessibilityLabel={t`Formatting`}
					className="flex-row items-center border-t border-separator bg-overlay"
					style={toolbarStyle}
				>
					<ScrollView
						ref={formattingScroll}
						horizontal
						keyboardShouldPersistTaps="always"
						persistentScrollbar
						onLayout={() => formattingScroll.current?.flashScrollIndicators()}
					>
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
					<Button variant="ghost" onPress={() => editor?.ref.current?.blur()}>
						{t`Done`}
					</Button>
					<View className="w-2" />
				</View>
			) : null}
			<Sheet
				isOpen={linkOpen}
				onOpenChange={setLinkOpen}
				title={t`Link address`}
				closeLabel={t`Close`}
				footer={<Button onPress={applyLink}>{t`Save link`}</Button>}
			>
				<TextField>
					<Label>{t`Address`}</Label>
					<Input
						variant="secondary"
						accessibilityLabel={t`Address`}
						value={link}
						onChangeText={setLink}
						keyboardType="url"
						autoCapitalize="none"
						autoCorrect={false}
						autoFocus
						onSubmitEditing={applyLink}
					/>
				</TextField>
				<Text size="xs" tone="muted">{t`Leave it empty to remove the link.`}</Text>
			</Sheet>
			<Sheet isOpen={styleOpen} onOpenChange={setStyleOpen} title={t`Text style`} closeLabel={t`Close`}>
				<ListSection>
					{marks.map((mark) => (
						<ListRow
							key={mark.key}
							title={mark.label}
							icon={mark.icon}
							value={mark.isActive ? t`On` : undefined}
							chevron={false}
							onPress={() => {
								mark.run();
								setStyleOpen(false);
								editor?.ref.current?.focus();
							}}
						/>
					))}
				</ListSection>
				<ListSection>
					{[
						{ level: 0, icon: "paragraph" as const, label: t`Paragraph` },
						{ level: 1, icon: "text-h-one" as const, label: t`Heading 1` },
						{ level: 2, icon: "text-h-two" as const, label: t`Heading 2` },
						{ level: 3, icon: "text-h-three" as const, label: t`Heading 3` },
					].map((option) => (
						<ListRow
							key={option.level}
							title={option.label}
							icon={option.icon}
							value={heading === option.level ? t`Current` : undefined}
							chevron={false}
							onPress={() => setHeading(option.level)}
						/>
					))}
				</ListSection>
			</Sheet>
		</>
	);
}
