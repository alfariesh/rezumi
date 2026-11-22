// Rich text (react-native-enriched-html) for resume descriptions, the summary, the letter body and an older letter's
// recipient: one field with two tool sets. The formatting toolbar docks above the keyboard while a field has focus;
// render `RichTextToolbar` once on the screen. Only an edited field is re-serialised, so opening a description never
// rewrites it. The session logic lives in `features/entries/rich-text.ts`.
import type { RichTextTools, ActiveEditor } from "./rich-text-active";
import type { RichTextSession } from "@/features/entries/rich-text";
import type { ReactNode, RefObject } from "react";
import type { EnrichedTextInputInstance } from "react-native-enriched-html";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { EnrichedTextInput } from "react-native-enriched-html";
import { ImprovePanel } from "./improve";
import { getActiveEditor, setActiveEditor } from "./rich-text-active";
import { useOptionalWriteSource } from "./source";
import { LabelLine } from "./text-fields";
import { createRichTextSession, fromEnrichedHtml, lineAtCaret, replaceLine } from "@/features/entries/rich-text";
import { Text, cx, space, useResolveClassNames, useThemeColor } from "@/ui";

export { RichTextToolbar } from "./rich-text-toolbar";
export type { RichTextTools } from "./rich-text-active";

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
const noop = () => undefined;

type FieldFocus = { onFocus: () => void; onBlur: () => void };

export type RichTextFieldProps = {
	label: string;
	value: string;
	/** Receives HTML, only after the person edits this field. */
	onChange: (html: string) => void;
	/** "resume" (default): link, text style, Improve and a character count. "letter": bold, italic, underline, lists. */
	tools?: RichTextTools | undefined;
	/** Guidance while editing ("2–3 sentences reads best"). */
	hint?: string | undefined;
	/** Lines of height at rest: 4 for resume text, 8 for a letter. */
	minLines?: number | undefined;
	/** Tells the draft a field is being typed in; defaults to the write source's. Letters pass their own. */
	focus?: FieldFocus | undefined;
	/** A small control at the end of the label's line (the Profile marker). */
	labelAction?: ReactNode;
	disabled?: boolean | undefined;
	autoFocus?: boolean | undefined;
	testID?: string | undefined;
};

export function RichTextField({
	label,
	value,
	onChange,
	tools = "resume",
	hint,
	minLines,
	focus: focusProp,
	labelAction,
	disabled = false,
	autoFocus,
	testID,
}: RichTextFieldProps) {
	const { t } = useLingui();
	const source = useOptionalWriteSource();
	const focus = focusProp ?? source?.focus ?? { onFocus: noop, onBlur: noop };
	const resume = tools === "resume";
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
	const [improving, setImproving] = useState<{ index: number; text: string } | null>(null);
	const plain = useRef("");
	const editor = useRef<ActiveEditor | null>(null);
	// Table markup can't be edited safely by the native editor; it stays as it is.
	const readOnly = useMemo(() => /<table[\s>]/i.test(value), [value]);
	const editable = !disabled && !readOnly;

	const readBaseline = () => loadBaseline(ref, session, onChange);

	// Undo, a kept draft and remote updates change the text from outside; load them while the field isn't focused.
	useEffect(() => {
		const markup = session.external(value);
		if (markup === null) return;
		ref.current?.setValue(markup);
		readBaseline();
	});

	useEffect(() => {
		loadBaseline(ref, session, noop);
		return () => {
			if (getActiveEditor()?.ref === ref) setActiveEditor(null);
		};
	}, [session]);

	const startImprove = () => {
		const line = lineAtCaret(plain.current, editor.current?.selection.start ?? 0);
		if (line) setImproving(line);
	};
	const canImprove = (caret: number) => resume && lineAtCaret(plain.current, caret) !== null;

	const publish = (change: Partial<ActiveEditor>) => {
		if (!editor.current) return;
		editor.current = { ...editor.current, ...change };
		if (editor.current.focused || getActiveEditor()?.ref === ref) setActiveEditor(editor.current);
	};

	const inputStyle = {
		minHeight: LINE * (minLines ?? (resume ? 4 : 8)) + space[3] * 2,
		...(resume ? { maxHeight: 360 } : {}),
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
			<LabelLine label={label} action={labelAction} />
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
						const selection = editor.current?.selection ?? { start: 0, end: 0, text: "" };
						editor.current = {
							ref,
							tools,
							focused: true,
							state: editor.current?.state ?? null,
							selection,
							command: session.command,
							// The first focus can improve an existing line without another tap on the caret.
							canImprove: canImprove(selection.start),
							improve: startImprove,
						};
						setActiveEditor(editor.current);
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
					onChangeText={(event) => {
						plain.current = event.nativeEvent.value;
						setText(event.nativeEvent.value);
					}}
					onChangeState={(event) => publish({ state: event.nativeEvent })}
					onChangeSelection={(event) =>
						publish({ selection: event.nativeEvent, canImprove: canImprove(event.nativeEvent.start) })
					}
				/>
			</View>
			{resume && (focused || improving) ? (
				<View className="flex-row justify-between gap-3">
					<Text size="xs" tone="muted" className="flex-1">
						{hint ?? ""}
					</Text>
					<Text size="xs" tone="muted" mono tabular>
						{plural(text.trim().length, { one: "# character", other: "# characters" })}
					</Text>
				</View>
			) : null}
			{improving ? (
				<ImprovePanel
					key={improving.index}
					line={improving}
					where={label}
					context={text}
					onClose={() => setImproving(null)}
					onReplace={async (replacement) => {
						const html = fromEnrichedHtml((await ref.current?.getHTML()) ?? "");
						const next = replaceLine(html, improving.index, improving.text, replacement);
						if (next === null) return false;
						onChange(next);
						ref.current?.setValue(session.wrote(next));
						setImproving(null);
						return true;
					}}
				/>
			) : null}
		</View>
	);
}
