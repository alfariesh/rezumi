import type { JSONContent } from "@tiptap/core";
import { RichTextEditor } from "@heroui-pro/react/rich-text-editor";
import { t } from "@lingui/core/macro";
import { generateJSON } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";

const ICON = 18;

export type PortfolioRichTextEditorProps = {
	/** Names the editable area for screen readers. */
	label: string;
	/** HTML, as saved. */
	value: string;
	onChange: (html: string) => void;
	/** Characters of text, counted below the field; typing stops at the limit. */
	maxLength: number;
	placeholder?: string | undefined;
	labelledBy?: string | undefined;
};

/** Saved HTML as the editor's document. The editor's own extensions read the same tags (StarterKit holds them all). */
function toDocument(html: string): JSONContent {
	return generateJSON(html.trim() || "<p></p>", [StarterKit]);
}

/**
 * HeroUI Pro's rich text editor with only what a portfolio page shows (`02-teknis.md` section 15): bold, italic,
 * underline, strikethrough, two heading sizes, lists, quotes and links. It saves HTML; the API cleans it to the same
 * tags. It keeps its own document after the first render, so a change from outside (undo, a reload) needs a new `key`.
 */
export default function PortfolioRichTextEditor({
	label,
	value,
	onChange,
	maxLength,
	placeholder,
	labelledBy,
}: PortfolioRichTextEditorProps) {
	const [initial] = useState(() => toDocument(value));

	return (
		<RichTextEditor
			className="w-full"
			defaultValue={initial}
			maxLength={maxLength}
			placeholder={placeholder ?? t`Start writing…`}
			onValueChange={(_, details) => onChange(details.isEmpty ? "" : details.html)}
			editorOptions={{
				editorProps: {
					attributes: {
						role: "textbox",
						"aria-multiline": "true",
						...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label }),
					},
				},
			}}
		>
			<RichTextEditor.Shell>
				<RichTextEditor.Toolbar aria-label={t`Text formatting`}>
					<RichTextEditor.ToolbarGroup>
						<RichTextEditor.ToggleButton command="bold" tooltip={t`Bold`}>
							<Icon name="text-b" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="italic" tooltip={t`Italic`}>
							<Icon name="text-italic" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="underline" tooltip={t`Underline`}>
							<Icon name="text-underline" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="strike" tooltip={t`Strikethrough`}>
							<Icon name="text-strikethrough" size={ICON} />
						</RichTextEditor.ToggleButton>
					</RichTextEditor.ToolbarGroup>
					<RichTextEditor.ToolbarGroup>
						<RichTextEditor.ToggleButton command="heading-2" tooltip={t`Heading`}>
							<Icon name="text-h-two" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="heading-3" tooltip={t`Subheading`}>
							<Icon name="text-h-three" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="bulletList" tooltip={t`Bulleted list`}>
							<Icon name="list-bullets" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="orderedList" tooltip={t`Numbered list`}>
							<Icon name="list-numbers" size={ICON} />
						</RichTextEditor.ToggleButton>
						<RichTextEditor.ToggleButton command="blockquote" tooltip={t`Quote`}>
							<Icon name="text-indent" size={ICON} />
						</RichTextEditor.ToggleButton>
					</RichTextEditor.ToolbarGroup>
					<RichTextEditor.ToolbarGroup>
						<RichTextEditor.LinkPopover>
							<RichTextEditor.LinkPopover.Trigger tooltip={t`Link`}>
								<Icon name="link-simple-horizontal" size={ICON} />
							</RichTextEditor.LinkPopover.Trigger>
							<RichTextEditor.LinkPopover.Content>
								<RichTextEditor.LinkPopover.Input />
								<RichTextEditor.LinkPopover.Actions>
									<RichTextEditor.LinkPopover.UnsetButton />
									<RichTextEditor.LinkPopover.ApplyButton />
								</RichTextEditor.LinkPopover.Actions>
							</RichTextEditor.LinkPopover.Content>
						</RichTextEditor.LinkPopover>
						<RichTextEditor.ActionButton action="undo" tooltip={t`Undo`}>
							<Icon name="arrow-counter-clockwise" size={ICON} />
						</RichTextEditor.ActionButton>
						<RichTextEditor.ActionButton action="redo" tooltip={t`Redo`}>
							<Icon name="arrow-clockwise" size={ICON} />
						</RichTextEditor.ActionButton>
					</RichTextEditor.ToolbarGroup>
				</RichTextEditor.Toolbar>
				<RichTextEditor.Content />
				<RichTextEditor.Footer>
					<RichTextEditor.CharacterCount />
				</RichTextEditor.Footer>
			</RichTextEditor.Shell>
		</RichTextEditor>
	);
}
