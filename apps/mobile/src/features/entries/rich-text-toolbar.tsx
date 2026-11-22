// The formatting toolbar above the keyboard while a rich-text field has focus, with Done pinned at the end; it
// scrolls sideways when it doesn't fit. Resume text: bold, italic, lists, link, text style (underline, strikethrough,
// headings) and Improve. A letter: bold, italic, underline and lists.
import type { ActiveEditor } from "./rich-text-active";
import type { IconName } from "@/ui";
import type { ComponentRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveEditor } from "./rich-text-active";
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
	size,
	space,
	useKeyboardVisible,
} from "@/ui";

type ToolbarButton = { key: string; icon: IconName; label: string; isActive: boolean | undefined; run: () => void };

function useButtons(editor: ActiveEditor | null, open: { link: () => void; style: () => void }) {
	const { t } = useLingui();
	// The last focused editor stays active after blur, so sheets keep working on it after taking focus.
	const target = () => {
		editor?.command();
		return editor?.ref.current;
	};
	const state = editor?.state;
	const heading = state?.h1.isActive ? 1 : state?.h2.isActive ? 2 : state?.h3.isActive ? 3 : 0;
	const mark = (key: string, icon: IconName, label: string, isActive: boolean | undefined, run: () => void) => ({
		key,
		icon,
		label,
		isActive,
		run,
	});
	const bold = mark("b", "text-b", t`Bold`, state?.bold.isActive, () => target()?.toggleBold());
	const italic = mark("i", "text-italic", t`Italic`, state?.italic.isActive, () => target()?.toggleItalic());
	const underline = mark("u", "text-underline", t`Underline`, state?.underline.isActive, () =>
		target()?.toggleUnderline(),
	);
	const strike = mark("s", "text-strikethrough", t`Strikethrough`, state?.strikeThrough.isActive, () =>
		target()?.toggleStrikeThrough(),
	);
	const bullets = mark("ul", "list-bullets", t`Bulleted list`, state?.unorderedList.isActive, () =>
		target()?.toggleUnorderedList(),
	);
	const numbers = mark("ol", "list-numbers", t`Numbered list`, state?.orderedList.isActive, () =>
		target()?.toggleOrderedList(),
	);
	const link = mark("a", "link-simple-horizontal", t`Link`, state?.link.isActive, open.link);
	const style = mark("h", "text-aa", t`Text style`, heading > 0, open.style);
	const buttons: ToolbarButton[] =
		editor?.tools === "letter"
			? [bold, italic, underline, bullets, numbers]
			: [bold, italic, bullets, numbers, link, style];
	return { buttons, marks: [underline, strike], heading, target };
}

export function RichTextToolbar() {
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardVisible();
	const editor = useActiveEditor();
	const [linkOpen, setLinkOpen] = useState(false);
	const [link, setLink] = useState("https://");
	const [styleOpen, setStyleOpen] = useState(false);
	const formattingScroll = useRef<ComponentRef<typeof ScrollView>>(null);
	const { buttons, marks, heading, target } = useButtons(editor, {
		link: () => {
			setLink("https://");
			setLinkOpen(true);
		},
		style: () => setStyleOpen(true),
	});

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

	// Above the keyboard the bar sits flush; without it (a hardware keyboard), it clears the home indicator.
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
					{editor.tools === "resume" ? (
						<View className="border-s border-separator">
							<IconButton
								variant="ghost"
								icon="sparkle"
								label={t`Improve selected line`}
								isDisabled={!editor.canImprove}
								onPress={editor.improve}
								testID="toolbar-improve"
							/>
						</View>
					) : null}
					<Button variant="ghost" onPress={() => editor.ref.current?.blur()}>
						{t`Done`}
					</Button>
					<View className="w-2" />
				</View>
			) : null}
			{editor?.tools === "resume" ? (
				<>
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
										editor.ref.current?.focus();
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
			) : null}
		</>
	);
}
