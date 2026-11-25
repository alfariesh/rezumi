import type { HeadingHint } from "./heading-hints";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Editor, JSONContent } from "@tiptap/core";
import { filterRichTextEditorSuggestionItems, RichTextEditor } from "@heroui-pro/react/rich-text-editor";
import { t } from "@lingui/core/macro";
import { generateJSON } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { headingHints } from "./heading-hints";
import { pasteIntent } from "./paste";
import { SORTABLE_TYPE_PREFIX } from "@/components/input/sortable";

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
	/**
	 * Files pasted or dropped into the text. True when they were taken (as a block, say); otherwise the editor does
	 * what it would.
	 */
	onFiles?: ((files: File[]) => boolean) | undefined;
	/** A lone web address pasted on an empty line. True when it was taken (as a Video or Embed block, say). */
	onUrl?: ((url: string) => boolean) | undefined;
	/**
	 * A question to show in the empty paragraph under a heading (a story outline's), by the heading's text. Read when
	 * the editor is made.
	 */
	headingHint?: HeadingHint | undefined;
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
	onFiles,
	onUrl,
	headingHint,
}: PortfolioRichTextEditorProps) {
	const [initial] = useState(() => toDocument(value));
	// The editor reads its handlers once, when it's made: these refs give it the latest ones.
	const handlers = useRef({ onFiles, onUrl });
	useLayoutEffect(() => {
		handlers.current = { onFiles, onUrl };
	});
	// Made once, with the hints it starts with: the editor is rebuilt when its extensions change.
	const [extensions] = useState(() => (headingHint ? [headingHints(headingHint)] : []));
	const asDocument = appearance === "document";
	const menuItems = asDocument ? [...formatItems(), ...(slashItems ?? [])] : (slashItems ?? []);

	return (
		<RichTextEditor
			className="w-full"
			data-appearance={appearance}
			defaultValue={initial}
			maxLength={maxLength}
			placeholder={placeholder ?? t`Start writing…`}
			extensions={extensions}
			onValueChange={(_, details) => onChange(details.isEmpty ? "" : details.html)}
			editorOptions={{
				editorProps: {
					attributes: {
						role: "textbox",
						"aria-multiline": "true",
						...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label }),
					},
					handlePaste: (view, event) => {
						const { selection, doc } = view.state;
						const paste = pasteIntent({
							files: [...(event.clipboardData?.files ?? [])],
							text: event.clipboardData?.getData("text/plain") ?? "",
							emptyLine: selection.empty && selection.$from.parent.content.size === 0,
						});
						if (paste.kind === "files") return handlers.current.onFiles?.(paste.files) ?? false;
						if (paste.kind !== "url" || !handlers.current.onUrl?.(paste.url)) return false;
						// The empty line it was pasted on goes, unless it's all the text there is.
						if (doc.childCount > 1 && selection.$from.depth === 1)
							view.dispatch(view.state.tr.delete(selection.$from.before(), selection.$from.after()));
						return true;
					},
					handleDrop: (_view, event, _slice, moved) => {
						const transfer = event.dataTransfer;
						// A block or card being reordered passes over the text: the list takes the drop. Its drag also
						// carries its name as plain text, which must not be typed in here.
						if ([...(transfer?.types ?? [])].some((type) => type.startsWith(SORTABLE_TYPE_PREFIX))) return true;
						const files = [...(transfer?.files ?? [])];
						if (moved || !files.length) return false;
						// Files never fall through: the browser would leave the editor to open them.
						event.preventDefault();
						const taken = handlers.current.onFiles?.(files) ?? false;
						if (!taken)
							toast.add({
								type: "warning",
								description: handlers.current.onFiles
									? t`Only pictures and PDFs can be dropped here.`
									: t`Files can't be dropped into this text.`,
							});
						return true;
					},
				},
			}}
		>
			<RichTextEditor.Shell>
				{!asDocument && (
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
				{asDocument && <SelectionToolbar />}
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
					{asDocument ? <NearLimitCount maxLength={maxLength} /> : <RichTextEditor.CharacterCount />}
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
