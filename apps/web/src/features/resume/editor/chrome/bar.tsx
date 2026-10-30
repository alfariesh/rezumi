import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, ButtonGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { useEditorColumnsTransition } from "./shell";
import { AssistantButton } from "@/features/assistant/assistant-button";
import { BackLink, DrawerControls } from "@/features/resume/editor/chrome";
import { useEditorStore } from "@/features/resume/editor/store";

type EditorBarFrameProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
	/** What kind of document this is, beside the back button: "Resume", "Cover letter". */
	kind: { icon: IconName; label: string };
	/** The document's name and save state. */
	menu: ReactNode;
	/** Share and Download, after History and the assistant. */
	children: ReactNode;
};

/**
 * The 56px editor bar, on the editor's own column grid (`--editor-columns`), so it lines up with the body: back and
 * the document's kind over the panel column; the name and save state centered over the page; History, the assistant,
 * Share and Download at its end. Phones start the name right after the back button.
 */
export function EditorBarFrame({ layout, pinnable, kind, menu, children }: EditorBarFrameProps) {
	const setSheetTab = useEditorStore((state) => state.setSheetTab);
	const transition = useEditorColumnsTransition();
	const phone = layout === "mobile";

	const name = (
		// The name and its save state share a row; the state shows as an icon, its words for screen readers.
		<div className={cn("flex min-w-0 items-center gap-1.5", !phone && "justify-center")}>{menu}</div>
	);

	return (
		<header className={cn("grid h-(--editor-bar) grid-cols-(--editor-columns) items-center", transition)}>
			<div className="flex min-w-0 items-center gap-1 ps-3 pe-2">
				<BackLink />
				{layout === "tablet" && <DrawerControls pinnable={pinnable} />}
				{!phone && (
					<span className="flex min-w-0 items-center gap-1.5 ps-1 text-sm font-medium text-muted">
						<Icon name={kind.icon} size={16} className="shrink-0" />
						<span className="truncate">{kind.label}</span>
					</span>
				)}
			</div>

			{/* The actions never shrink; the name takes what's left (truncating) and stays centered while the outer
			    tracks can be equal. A long name gives up the left track first, never overlapping the actions. */}
			<div
				className={cn(
					"grid min-w-0 items-center gap-2 pe-3",
					phone
						? "grid-cols-[minmax(0,1fr)_auto]"
						: "grid-cols-[minmax(0,1fr)_minmax(0,max-content)_minmax(max-content,1fr)] ps-3",
				)}
			>
				{!phone && <span aria-hidden="true" />}
				{name}
				<div className="flex items-center justify-end gap-1">
					{/* History lives in the Download & history sheet; the clock opens it there. */}
					{layout === "desktop" && (
						<IconButton
							icon="clock-counter-clockwise"
							label={t`History`}
							className="text-muted"
							onPress={() => setSheetTab("history")}
						/>
					)}
					{/* Every layout opens the assistant from the ✦: a column, a drawer, or full screen on phones. */}
					<span className={layout === "desktop" ? "me-1.5" : undefined}>
						<AssistantButton />
					</span>
					{children}
				</div>
			</div>
		</header>
	);
}

type DownloadButtonsProps = {
	busy: boolean;
	onDownload: () => void;
	/** Phones: one icon button. */
	compact: boolean;
	/** Tablets drop the label so the bar fits beside the mode switch; the button keeps its name. */
	iconOnly: boolean;
	disabled?: boolean;
	/** Starts loading the export code before the ▾ is pressed. */
	onPreload?: () => void;
};

/** Download PDF is the only filled button; the ▾ segment opens the Download tab with every format. */
export function DownloadButtons({
	busy,
	onDownload,
	compact,
	iconOnly,
	disabled = false,
	onPreload,
}: DownloadButtonsProps) {
	const setSheetTab = useEditorStore((state) => state.setSheetTab);

	if (compact) {
		return (
			<IconButton
				icon="download-simple"
				label={t`Download PDF`}
				shortcut="⌘P"
				isDisabled={disabled || busy}
				onPress={onDownload}
			/>
		);
	}

	return (
		<ButtonGroup aria-label={t`Download`}>
			<Button
				isPending={busy}
				isDisabled={disabled}
				isIconOnly={iconOnly}
				{...(iconOnly ? { "aria-label": t`Download PDF` } : {})}
				className="gap-1.5"
				onPress={onDownload}
			>
				{busy ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name="download-simple" />}
				{iconOnly ? null : busy ? <Trans>Preparing…</Trans> : <Trans>Download PDF</Trans>}
			</Button>
			<Button
				isIconOnly
				isDisabled={disabled || busy}
				aria-label={t`More download formats`}
				className="w-8"
				onHoverStart={() => onPreload?.()}
				onFocus={() => onPreload?.()}
				onPress={() => setSheetTab("download")}
			>
				<ButtonGroup.Separator />
				<Icon name="caret-down" />
			</Button>
		</ButtonGroup>
	);
}
