import type { ReactNode } from "react";
import { Button, ButtonGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { BackLink, DrawerControls } from "@/features/resume/editor/chrome";
import { useEditorStore } from "@/features/resume/editor/store";

type EditorBarFrameProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
	/** The document's editable name, its menu and its save state, after the back button. */
	menu: ReactNode;
	/** Controls for the canvas under it, centered: undo and redo, zoom, the page count. Phones leave them out. */
	center: ReactNode;
	/** Leaving the editor: "Back to documents" unless the editor has its own place to go back to. */
	back?: ReactNode;
	/** At the end: the phone's Download, the portfolio's published page. */
	children?: ReactNode;
};

/**
 * The 56px editor bar, three zones on one row: back, the document's name, its menu and save state at the start; the
 * canvas controls (undo, zoom, pages) in the middle; little at the end (the phone's Download, the portfolio's page).
 * The outer zones share what the middle leaves, so it stays centered; a long name truncates and never runs under it.
 * Phones drop the middle. The modes, AI and History live down the left of the panel; Download floats over the page.
 */
export function EditorBarFrame({ layout, pinnable, menu, center, back, children }: EditorBarFrameProps) {
	const phone = layout === "mobile";

	return (
		<header
			className={cn(
				"grid h-(--editor-bar) min-w-0 items-center gap-3 px-3",
				phone ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
			)}
		>
			<div className="flex min-w-0 items-center gap-1">
				{back ?? <BackLink />}
				{layout === "tablet" && <DrawerControls pinnable={pinnable} />}
				<div className="flex min-w-0 items-center gap-1 ps-1">{menu}</div>
			</div>

			{!phone && <div className="flex min-w-0 items-center justify-center gap-0.5">{center}</div>}

			<div className="flex items-center justify-end gap-1">{children}</div>
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
