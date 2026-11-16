import type { IconName } from "@rezumi/ui/components/icon";
import type { Editor, JSONContent } from "@tiptap/core";
import { filterRichTextEditorSuggestionItems, RichTextEditor } from "@heroui-pro/react/rich-text-editor";
import { t } from "@lingui/core/macro";
import { generateJSON } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";

const ICON = 18;

/** An entry of the "/" menu: it removes the typed "/…" and does something outside the text (adds a block). */
export type SlashItem = {
	title: string;
	description: string;
	icon: IconName;
	keywords: string[];
	onSelect: () => void;
};

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
	/** Typing "/" opens these. */
	slashItems?: readonly SlashItem[] | undefined;
	/**
	 * `field` (the default): a framed field with its toolbar on top. `document`: part of the page being written, with
	 * no frame; formatting comes up over selected text, and "/" also turns the line into a heading, a list or a quote.
	 */
	appearance?: "field" | "document";
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
	slashItems,
	appearance = "field",
}: PortfolioRichTextEditorProps) {
	const [initial] = useState(() => toDocument(value));
	const document = appearance === "document";
	const menuItems = document ? [...formatItems(), ...(slashItems ?? [])] : (slashItems ?? []);

	return (
		<RichTextEditor
			className="w-full"
			data-appearance={appearance}
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
				{!document && (
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
				)}
				<RichTextEditor.Content />
				{document && <SelectionToolbar />}
				{menuItems.length > 0 && (
					<RichTextEditor.SuggestionMenu
						char="/"
						items={({ query }) =>
							filterRichTextEditorSuggestionItems(
								menuItems.map((item) => ({
									title: item.title,
									description: item.description,
									keywords: item.keywords,
									icon: <Icon name={item.icon} size={16} />,
									command: ({ editor, range }) => {
										editor.chain().focus().deleteRange(range).run();
										if ("format" in item) item.format(editor);
										else item.onSelect();
									},
								})),
								query,
							)
						}
					/>
				)}
				<RichTextEditor.Footer>
					{document ? <NearLimitCount maxLength={maxLength} /> : <RichTextEditor.CharacterCount />}
				</RichTextEditor.Footer>
			</RichTextEditor.Shell>
		</RichTextEditor>
	);
}

type FormatItem = Omit<SlashItem, "onSelect"> & { format: (editor: Editor) => void };

/** "/" in a document also formats the line it's typed on: the toolbar a field has on top isn't there. */
function formatItems(): FormatItem[] {
	return [
		{
			title: t`Heading`,
			description: t`A big title for a part of the story`,
			icon: "text-h-two",
			keywords: ["heading", "judul", "h2", "title"],
			format: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
		},
		{
			title: t`Subheading`,
			description: t`A smaller title`,
			icon: "text-h-three",
			keywords: ["subheading", "subjudul", "h3"],
			format: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
		},
		{
			title: t`Bulleted list`,
			description: t`Points in any order`,
			icon: "list-bullets",
			keywords: ["bullet", "list", "daftar", "poin"],
			format: (editor) => editor.chain().focus().toggleBulletList().run(),
		},
		{
			title: t`Numbered list`,
			description: t`Steps in order`,
			icon: "list-numbers",
			keywords: ["number", "list", "ordered", "langkah", "nomor"],
			format: (editor) => editor.chain().focus().toggleOrderedList().run(),
		},
		{
			title: t`Quote`,
			description: t`What a client or user said`,
			icon: "text-indent",
			keywords: ["quote", "kutipan", "blockquote"],
			format: (editor) => editor.chain().focus().toggleBlockquote().run(),
		},
	];
}

/** A document's formatting, over the selected text. */
function SelectionToolbar() {
	return (
		<RichTextEditor.BubbleMenu toolbarProps={{ "aria-label": t`Text formatting` }}>
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
			<RichTextEditor.ToggleButton command="heading-2" tooltip={t`Heading`}>
				<Icon name="text-h-two" size={ICON} />
			</RichTextEditor.ToggleButton>
			<RichTextEditor.ToggleButton command="bulletList" tooltip={t`Bulleted list`}>
				<Icon name="list-bullets" size={ICON} />
			</RichTextEditor.ToggleButton>
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
		</RichTextEditor.BubbleMenu>
	);
}

/** A document counts its characters only once it nears its limit: a number under every paragraph would distract. */
function NearLimitCount({ maxLength }: { maxLength: number }) {
	return (
		<RichTextEditor.CharacterCount>
			{(stats: { characters: number }) =>
				stats.characters >= maxLength * 0.8 ? (
					<span className="tabular-nums">
						{stats.characters}/{maxLength}
					</span>
				) : null
			}
		</RichTextEditor.CharacterCount>
	);
}
