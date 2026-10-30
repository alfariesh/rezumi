import type { ImproveLine } from "./improve";
import type { IconName } from "@rezumi/ui/components/icon";
import type { Editor } from "@tiptap/react";
import type { ReactNode } from "react";
import type { Key, Selection } from "react-aria-components";
import { Dropdown, Label, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { useKeyboardInset } from "@rezumi/ui/hooks/use-keyboard-inset";
import { cn } from "@rezumi/utils/style";
import { ImprovePanel, lineAtCaret } from "./improve";
import { richTextExtensions } from "@/components/input/rich-text-extensions";
import { hasUnsupportedTableMarkup, toPreviewHtml } from "@/components/input/rich-text-markup";
import { openAssistantFrom } from "@/features/assistant/open";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { usePrompt } from "@/hooks/use-confirm";

type ToolbarAction = {
	icon: IconName;
	label: string;
	isActive?: (editor: Editor) => boolean;
	run: (editor: Editor) => void;
};

/**
 * Bold, Italic, Underline, Link, then lists; alignment and the rarer formatting (strikethrough, code, highlight,
 * headings, colour, indent, a rule and Clear formatting) sit in two menus so the toolbar fits a narrow column.
 */
function useToolbarActions(): ToolbarAction[] {
	const prompt = usePrompt();

	return [
		{
			icon: "text-b",
			label: t`Bold`,
			isActive: (editor) => editor.isActive("bold"),
			run: (editor) => editor.chain().focus().toggleBold().run(),
		},
		{
			icon: "text-italic",
			label: t`Italic`,
			isActive: (editor) => editor.isActive("italic"),
			run: (editor) => editor.chain().focus().toggleItalic().run(),
		},
		{
			icon: "text-underline",
			label: t`Underline`,
			isActive: (editor) => editor.isActive("underline"),
			run: (editor) => editor.chain().focus().toggleUnderline().run(),
		},
		{
			icon: "link-simple-horizontal",
			label: t`Link`,
			isActive: (editor) => editor.isActive("link"),
			run: async (editor) => {
				const current = (editor.getAttributes("link").href as string | undefined) ?? "";
				const href = await prompt(t`Link address`, {
					defaultValue: current || "https://",
					description: t`Leave it empty to remove the link.`,
				});
				if (href === null) return editor.commands.focus();
				const chain = editor.chain().focus().extendMarkRange("link");
				if (!href.trim() || href.trim() === "https://") chain.unsetLink().run();
				else chain.setLink({ href: href.trim() }).run();
			},
		},
		{
			icon: "list-bullets",
			label: t`Bulleted list`,
			isActive: (editor) => editor.isActive("bulletList"),
			run: (editor) => editor.chain().focus().toggleBulletList().run(),
		},
		{
			icon: "list-numbers",
			label: t`Numbered list`,
			isActive: (editor) => editor.isActive("orderedList"),
			run: (editor) => editor.chain().focus().toggleOrderedList().run(),
		},
	];
}

// The first list button starts a new group in the toolbar.
const LIST_GROUP_START = 4;

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
type Alignment = (typeof ALIGNMENTS)[number];
const ALIGNMENT_ICONS: Record<Alignment, IconName> = {
	left: "text-align-left",
	center: "text-align-center",
	right: "text-align-right",
	justify: "text-align-justify",
};

// Dark enough to read on white paper; "" is the template's own text colour.
const TEXT_COLORS = ["", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#6b7280"] as const;

type FormattingState = {
	align: Alignment;
	strike: boolean;
	code: boolean;
	highlight: boolean;
	/** 0 for a paragraph, else the heading level. */
	block: number;
	color: string;
};

const readFormatting = (editor: Editor): FormattingState => ({
	align: ALIGNMENTS.find((align) => align !== "left" && editor.isActive({ textAlign: align })) ?? "left",
	strike: editor.isActive("strike"),
	code: editor.isActive("code"),
	highlight: editor.isActive("highlight"),
	block: [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0,
	color: (editor.getAttributes("textStyle").color as string | undefined) ?? "",
});

const DEFAULT_FORMATTING: FormattingState = {
	align: "left",
	strike: false,
	code: false,
	highlight: false,
	block: 0,
	color: "",
};

/**
 * Keeps the toolbar up while one of its menus is open and returns the caret to the text when it closes; a click
 * outside the open menu leaves the field, like a click outside the toolbar.
 */
function useToolbarMenus(editor: Editor | null, onLeave: () => void) {
	const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
	const leaving = useRef(false);

	const open = Object.values(openMenus).some(Boolean);

	// A press outside the open menu and the toolbar's own buttons leaves the field, like a click outside the toolbar.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			leaving.current =
				!(event.target instanceof Element) ||
				event.target.closest("[data-toolbar-menu], [data-toolbar-trigger]") === null;
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	}, [open]);

	const rootProps = (menu: string) => ({
		onOpenChange: (next: boolean) => {
			setOpenMenus((current) => ({ ...current, [menu]: next }));
			if (next) {
				leaving.current = false;
				return;
			}
			if (leaving.current) return onLeave();
			// React Aria returns focus to the trigger; the caret belongs in the text.
			requestAnimationFrame(() => editor?.view.focus());
		},
	});
	const contentProps = { "data-toolbar-menu": "" };
	return { open, rootProps, contentProps };
}

/** Where a click on the read-only preview landed, or "end" when focus arrived another way. */
export type FocusRequest = { x: number; y: number } | "end" | undefined;

export type RichTextEditorProps = {
	/** Accessible name of the text box. */
	label: string;
	value: string;
	onChange: (html: string) => void;
	/** Guidance under the text while editing, e.g. "2–3 sentences reads best". */
	hint?: ReactNode;
	disabled?: boolean;
	className?: string;
	/** The text area's id, so other controls can focus it. */
	id?: string;
	/** Replaces the text area's default height (88px to 360px). */
	heightClassName?: string;
};

/**
 * Loaded on demand by ./rich-text-editor.tsx, which keeps Tiptap out of the builder's first render.
 *
 * Rich text for descriptions: the toolbar and footer show while the text has focus, the toolbar never
 * takes focus from it, and Markdown shortcuts work ("- " starts a list, "**bold**").
 */
export function RichTextEditor({
	label,
	value,
	onChange,
	hint,
	disabled = false,
	className,
	id,
	heightClassName = "max-h-[360px] min-h-[88px]",
	focusRequest,
}: RichTextEditorProps & { focusRequest?: FocusRequest }) {
	const [focused, setFocused] = useState(false);
	const toolbar = useRef<HTMLDivElement>(null);
	const [improving, setImproving] = useState<ImproveLine | null>(null);
	const actions = useToolbarActions();
	const ai = useHasUsableAiProvider();
	const mobile = useBreakpoint() === "mobile";
	const keyboardInset = useKeyboardInset();
	const readOnlyTable = useMemo(() => hasUnsupportedTableMarkup(value), [value]);
	const editorValue = useMemo(() => (readOnlyTable ? toPreviewHtml(value) : value), [readOnlyTable, value]);

	const editor = useEditor({
		extensions: richTextExtensions,
		content: editorValue,
		editable: !disabled && !readOnlyTable,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			transformPastedHTML: (html) => (hasUnsupportedTableMarkup(html) ? toPreviewHtml(html) : html),
			attributes: {
				...(id ? { id } : {}),
				"aria-label": label,
				"aria-multiline": "true",
				role: "textbox",
				spellcheck: "true",
				class: cn(
					"typeset typeset-field overflow-y-auto px-3 py-2 text-sm outline-none",
					heightClassName,
					"[&_[data-resume-whitespace=preserve]]:whitespace-pre-wrap",
				),
			},
		},
		onUpdate: ({ editor }) => onChange(editor.getHTML()),
	});

	const state = useEditorState({
		editor,
		selector: ({ editor }) =>
			editor
				? {
						characters: editor.getText().length,
						active: actions.map((action) => action.isActive?.(editor) ?? false),
						canImprove: lineAtCaret(editor) !== null,
						formatting: readFormatting(editor),
					}
				: { characters: 0, active: [] as boolean[], canImprove: false, formatting: DEFAULT_FORMATTING },
	});
	const menus = useToolbarMenus(editor, () => setFocused(false));

	// Undo, the page and the assistant change the text from outside; keep the editor in step.
	useEffect(() => {
		if (!editor || editor.getHTML() === editorValue) return;
		editor.commands.setContent(editorValue, { emitUpdate: false });
	}, [editor, editorValue]);

	useEffect(() => {
		editor?.setEditable(!disabled && !readOnlyTable, false);
	}, [editor, disabled, readOnlyTable]);

	// The preview took a click or focus while the editor loaded: put the caret there, after the editor's first paint.
	useEffect(() => {
		if (!editor || !focusRequest) return;
		const frame = requestAnimationFrame(() => {
			const at = focusRequest === "end" ? null : editor.view.posAtCoords({ left: focusRequest.x, top: focusRequest.y });
			editor.commands.focus(at?.pos ?? "end");
		});
		return () => cancelAnimationFrame(frame);
	}, [editor, focusRequest]);

	const editing = focused || improving !== null || menus.open;

	const startImprove = () => {
		if (!editor || ai.isUnavailable) return;
		// Without a provider, the assistant's inline setup connects one.
		if (!ai.hasUsableProvider) return void openAssistantFrom({ assistant: "new" });
		setImproving(lineAtCaret(editor));
	};

	const buttonSize = mobile ? "size-11" : "size-8";
	const toolbarButtons = (
		<>
			{actions.map((action, index) => (
				<button
					key={action.icon}
					type="button"
					aria-label={action.label}
					aria-pressed={action.isActive ? (state?.active[index] ?? false) : undefined}
					title={action.label}
					// Keep the caret in the text while formatting.
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => editor && void action.run(editor)}
					className={cn(
						toolbarButtonClassName,
						buttonSize,
						state?.active[index] && "bg-accent-soft text-accent-text",
						index === LIST_GROUP_START && "ms-1.5",
					)}
				>
					<Icon name={action.icon} />
				</button>
			))}
			{editor && (
				<FormattingMenus
					editor={editor}
					formatting={state?.formatting ?? DEFAULT_FORMATTING}
					buttonClassName={cn(toolbarButtonClassName, buttonSize)}
					side={mobile ? "top" : "bottom"}
					menus={menus}
				/>
			)}
			<button
				type="button"
				aria-expanded={improving !== null}
				disabled={ai.isUnavailable || (!state?.canImprove && improving === null)}
				title={state?.canImprove ? undefined : t`Put the caret in a line to improve it`}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => (improving ? setImproving(null) : startImprove())}
				className={cn(
					"ms-auto flex shrink-0 items-center gap-1.5 rounded-md bg-accent-soft px-2.5 text-xs font-semibold text-accent-text transition-[filter] duration-quick hover:brightness-95 disabled:opacity-50",
					mobile ? "h-11" : "h-8",
				)}
			>
				<Icon name="sparkle" size={16} />
				{/* Icon only where the toolbar is narrow, so the formatting buttons keep one row. */}
				<span className="@max-[24rem]:sr-only">
					<Trans>Improve</Trans>
				</span>
			</button>
		</>
	);

	return (
		<div
			onFocus={() => setFocused(true)}
			onBlur={(event) => {
				const next = event.relatedTarget;
				// Opening a toolbar menu moves focus into it; the menu reports leaving the field itself.
				const inMenu = next instanceof Element && next.closest("[data-toolbar-menu]") !== null;
				if (!event.currentTarget.contains(next) && !toolbar.current?.contains(next) && !inMenu) setFocused(false);
			}}
			className={cn(
				"rounded-lg border border-line-2 bg-raised transition-[border-color,box-shadow] duration-quick",
				editing && "border-accent shadow-[0_0_0_3px_var(--accent-soft)]",
				disabled && "bg-sunken",
				className,
			)}
		>
			{/* On phones the toolbar docks above the keyboard, with Done to put the keyboard away. */}
			{editing &&
				!readOnlyTable &&
				mobile &&
				createPortal(
					<div
						ref={toolbar}
						role="toolbar"
						aria-label={t`Formatting`}
						style={{ bottom: keyboardInset }}
						className="fixed inset-x-0 z-50 flex h-11 items-center gap-0.5 border-t border-line bg-raised px-1.5 shadow-e2"
					>
						<div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">{toolbarButtons}</div>
						<button
							type="button"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								setImproving(null);
								setFocused(false);
								editor?.commands.blur();
							}}
							className="flex h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold text-accent-text"
						>
							<Trans>Done</Trans>
						</button>
					</div>,
					document.body,
				)}

			{readOnlyTable && (
				<p role="status" className="border-b border-line px-3 py-2 text-xs text-ink-2">
					<Trans>
						Original table formatting is preserved. This content is read-only because it cannot be edited safely.
					</Trans>
				</p>
			)}

			<EditorContent editor={editor} />
			{editing && <AiProviderLoadState state={ai} />}

			{/* Under the text, so focusing the field never moves the line you clicked. */}
			{editing && !readOnlyTable && !mobile && (
				<div
					ref={toolbar}
					role="toolbar"
					aria-label={t`Formatting`}
					className="@container flex flex-wrap gap-0.5 border-t border-line px-1.5 py-1"
				>
					{toolbarButtons}
				</div>
			)}

			{editor && improving && (
				<ImprovePanel
					key={improving.from}
					editor={editor}
					line={improving}
					where={label}
					onClose={() => setImproving(null)}
				/>
			)}

			{editing && (
				<div className="flex items-center justify-between gap-3 border-t border-line px-3 py-1.5 text-xs text-ink-3">
					<span>{hint ?? <Trans>Markdown shortcuts on</Trans>}</span>
					<span className="font-mono">
						<Plural value={state?.characters ?? 0} one="# character" other="# characters" />
					</span>
				</div>
			)}
		</div>
	);
}

const toolbarButtonClassName =
	"flex shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-quick hover:bg-hover aria-expanded:bg-hover";

type FormattingMenusProps = {
	editor: Editor;
	formatting: FormattingState;
	buttonClassName: string;
	side: "top" | "bottom";
	menus: ReturnType<typeof useToolbarMenus>;
};

/** Alignment, then everything else the toolbar has no room for. */
function FormattingMenus({ editor, formatting, buttonClassName, side, menus }: FormattingMenusProps) {
	const chain = () => editor.chain().focus();
	const alignLabels: Record<Alignment, string> = {
		left: t`Align left`,
		center: t`Align center`,
		right: t`Align right`,
		justify: t`Justify`,
	};
	const colorLabels: Record<(typeof TEXT_COLORS)[number], string> = {
		"": t`Default`,
		"#dc2626": t`Red`,
		"#ea580c": t`Orange`,
		"#16a34a": t`Green`,
		"#2563eb": t`Blue`,
		"#7c3aed": t`Purple`,
		"#6b7280": t`Gray`,
	};
	const blocks = [
		{ level: 0, icon: "paragraph", label: t`Paragraph` },
		{ level: 1, icon: "text-h-one", label: t`Heading 1` },
		{ level: 2, icon: "text-h-two", label: t`Heading 2` },
		{ level: 3, icon: "text-h-three", label: t`Heading 3` },
	] as const;
	const setBlock = (level: number) =>
		level === 0
			? chain().setParagraph().run()
			: chain()
					.setHeading({ level: level as 1 | 2 | 3 })
					.run();

	const changed = (keys: Selection) => (keys === "all" ? new Set<Key>() : new Set<Key>(keys));
	const toggles = [
		{ id: "strike", active: formatting.strike, run: () => chain().toggleStrike().run() },
		{ id: "code", active: formatting.code, run: () => chain().toggleCode().run() },
		{ id: "highlight", active: formatting.highlight, run: () => chain().toggleHighlight().run() },
	];

	return (
		<>
			<Dropdown {...menus.rootProps("align")}>
				<IconButton
					icon={ALIGNMENT_ICONS[formatting.align]}
					label={t`Text alignment`}
					size="sm"
					tooltipPlacement={side}
					data-toolbar-trigger=""
					className={cn(buttonClassName, "ms-1.5", formatting.align !== "left" && "bg-accent-soft text-accent-text")}
				/>
				<Dropdown.Popover placement={`${side} start`} className="w-44" {...menus.contentProps}>
					<Dropdown.Menu
						selectionMode="single"
						disallowEmptySelection
						selectedKeys={new Set([formatting.align])}
						onSelectionChange={(keys) => {
							const [align] = changed(keys);
							if (typeof align !== "string") return;
							if (align === "left") chain().unsetTextAlign().run();
							else
								chain()
									.setTextAlign(align as Alignment)
									.run();
						}}
					>
						{ALIGNMENTS.map((align) => (
							<Dropdown.Item key={align} id={align} textValue={alignLabels[align]}>
								<Icon name={ALIGNMENT_ICONS[align]} className="text-muted" />
								<Label>{alignLabels[align]}</Label>
								<Dropdown.ItemIndicator type="dot" />
							</Dropdown.Item>
						))}
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>

			<Dropdown {...menus.rootProps("more")}>
				<IconButton
					icon="dots-three"
					label={t`More formatting`}
					size="sm"
					tooltipPlacement={side}
					data-toolbar-trigger=""
					className={buttonClassName}
				/>
				<Dropdown.Popover placement={`${side} start`} className="w-56" {...menus.contentProps}>
					<Dropdown.Menu>
						<Dropdown.Section
							selectionMode="multiple"
							selectedKeys={new Set(toggles.filter((toggle) => toggle.active).map((toggle) => toggle.id))}
							onSelectionChange={(keys) => {
								const next = changed(keys);
								for (const toggle of toggles) if (next.has(toggle.id) !== toggle.active) toggle.run();
							}}
						>
							<Dropdown.Item id="strike" textValue={t`Strikethrough`}>
								<Icon name="text-strikethrough" className="text-muted" />
								<Label>
									<Trans>Strikethrough</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="code" textValue={t`Code`}>
								<Icon name="code" className="text-muted" />
								<Label>
									<Trans>Code</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
							<Dropdown.Item id="highlight" textValue={t`Highlight`}>
								<Icon name="highlighter" className="text-muted" />
								<Label>
									<Trans>Highlight</Trans>
								</Label>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
						</Dropdown.Section>

						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="color" textValue={t`Text color`}>
								<Icon name="palette" className="text-muted" />
								<Label>
									<Trans>Text color</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover {...menus.contentProps}>
								<Dropdown.Menu
									selectionMode="single"
									disallowEmptySelection
									selectedKeys={new Set([formatting.color || "default"])}
									onSelectionChange={(keys) => {
										const [key] = changed(keys);
										if (typeof key !== "string") return;
										const color = key === "default" ? "" : key;
										if (color) chain().setColor(color).run();
										else chain().unsetColor().run();
									}}
								>
									{TEXT_COLORS.map((color) => (
										<Dropdown.Item key={color || "default"} id={color || "default"} textValue={colorLabels[color]}>
											<span
												aria-hidden="true"
												className="size-3.5 rounded-sm border border-line-2"
												style={{ background: color || "var(--ink)" }}
											/>
											<Label>{colorLabels[color]}</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>

						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="style" textValue={t`Text style`}>
								<Icon name="text-aa" className="text-muted" />
								<Label>
									<Trans>Text style</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover {...menus.contentProps}>
								<Dropdown.Menu
									selectionMode="single"
									disallowEmptySelection
									selectedKeys={new Set([String(formatting.block)])}
									onSelectionChange={(keys) => {
										const [key] = changed(keys);
										if (typeof key === "string") setBlock(Number(key));
									}}
								>
									{blocks.map((block) => (
										<Dropdown.Item key={block.level} id={String(block.level)} textValue={block.label}>
											<Icon name={block.icon} className="text-muted" />
											<Label>{block.label}</Label>
											<Dropdown.ItemIndicator type="dot" />
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>

						<Separator />
						<Dropdown.Item id="indent" textValue={t`Indent`} onAction={() => chain().increaseIndent().run()}>
							<Icon name="text-indent" className="text-muted" />
							<Label>
								<Trans>Indent</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Item id="outdent" textValue={t`Outdent`} onAction={() => chain().decreaseIndent().run()}>
							<Icon name="text-outdent" className="text-muted" />
							<Label>
								<Trans>Outdent</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Item id="rule" textValue={t`Horizontal line`} onAction={() => chain().setHorizontalRule().run()}>
							<Icon name="minus" className="text-muted" />
							<Label>
								<Trans>Horizontal line</Trans>
							</Label>
						</Dropdown.Item>

						<Separator />
						<Dropdown.Item
							id="clear"
							textValue={t`Clear formatting`}
							onAction={() => chain().clearNodes().unsetAllMarks().unsetTextAlign().run()}
						>
							<Icon name="text-t-slash" className="text-muted" />
							<Label>
								<Trans>Clear formatting</Trans>
							</Label>
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
		</>
	);
}
