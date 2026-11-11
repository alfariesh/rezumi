import type { ButtonProps } from "@heroui/react";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, buttonVariants, Separator, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { useEditorStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./store";

// The editor chrome resumes and letters share: the back link, the document's name and drawer controls in the bar,
// the canvas width, and the undo and zoom controls in the bar's middle.

const LANDSCAPE_QUERY = "(orientation: landscape)";

function subscribeToOrientation(onChange: () => void) {
	const list = window.matchMedia(LANDSCAPE_QUERY);
	list.addEventListener("change", onChange);
	return () => list.removeEventListener("change", onChange);
}

/** Tablets in landscape can pin the panel beside the page. */
export const useIsLandscape = () =>
	useSyncExternalStore(
		subscribeToOrientation,
		() => window.matchMedia(LANDSCAPE_QUERY).matches,
		() => false,
	);

// Page widths in PDF points; 1pt renders as 1 CSS px at 100%.
const PAGE_WIDTH = { a4: 595.28, letter: 612, "free-form": 595.28 } as const;
// Horizontal room the canvas keeps around the page: 40px each side, 16px on phones.
const CANVAS_GUTTER = { wide: 80, narrow: 32 } as const;

function useCanvasWidth() {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return [ref, width] as const;
}

/**
 * The canvas ref and the scale the page is drawn at (zoom, or fit). The scale that fits the page format goes to the
 * store, for the bar's zoom.
 */
export function usePageScale(format: keyof typeof PAGE_WIDTH) {
	const zoom = useEditorStore((state) => state.zoom);
	const isPhone = useBreakpoint() === "mobile";
	const [canvasRef, canvasWidth] = useCanvasWidth();
	const gutter = isPhone ? CANVAS_GUTTER.narrow : CANVAS_GUTTER.wide;
	const fitScale = canvasWidth > 0 ? Math.min(ZOOM_MAX, (canvasWidth - gutter) / PAGE_WIDTH[format]) : 1;
	const pageScale = zoom === "fit" ? Math.max(0.25, fitScale) : zoom;

	// The bar's zoom steps from what fits now.
	useEffect(() => {
		useEditorStore.setState({ fitScale });
	}, [fitScale]);

	return { canvasRef, pageScale };
}

type CanvasStatusPillProps = { icon: IconName; children: ReactNode };

/** The dark pill above the first page while a version or template is previewed instead of the live document. */
export function CanvasStatusPill({ icon, children }: CanvasStatusPillProps) {
	return (
		<span
			role="status"
			className="flex h-8 items-center gap-2 rounded-full bg-foreground ps-2.5 pe-3.5 text-sm font-medium text-background shadow-overlay"
		>
			<Icon name={icon} size={18} />
			{children}
		</span>
	);
}

type DocumentMenuTriggerProps = Omit<ButtonProps, "children"> & { name: string };

/** The ▾ after the document's name in the editor bar: opens the document menu. */
export function DocumentMenuTrigger({ name, className, ...props }: DocumentMenuTriggerProps) {
	return (
		<Button
			variant="ghost"
			size="sm"
			isIconOnly
			{...props}
			aria-label={t`Document menu: ${name}`}
			className={cn("shrink-0 text-muted", typeof className === "string" && className)}
		>
			<Icon name="caret-down" size={16} />
		</Button>
	);
}

type DocumentTitleProps = {
	name: string;
	/** A locked document's name reads as text and shows the lock. */
	isLocked: boolean;
	onRename: (name: string) => void;
	maxLength?: number;
};

/**
 * The document's name in the editor bar, edited in place: it reads as the title until hovered, Enter or leaving the
 * field saves it (trimmed; an empty name is put back), Esc puts the old one back. It's as wide as its text, up to the
 * room the bar leaves, and truncates past that.
 */
export function DocumentTitle({ name, isLocked, onRename, maxLength = 100 }: DocumentTitleProps) {
	const [draft, setDraft] = useState<string | null>(null);
	const cancelled = useRef(false);
	const value = draft ?? name;

	const commit = () => {
		const next = draft?.trim().slice(0, maxLength);
		setDraft(null);
		if (cancelled.current) {
			cancelled.current = false;
			return;
		}
		if (next && next !== name) onRename(next);
	};

	return (
		<span className="flex min-w-0 items-center gap-1">
			<span className="inline-grid min-w-0 grid-cols-[minmax(0,auto)]">
				{/* Sizes the field to its text: an input doesn't grow with what's typed. */}
				<span
					aria-hidden="true"
					className="invisible col-start-1 row-start-1 truncate px-1.5 text-sm font-semibold whitespace-pre"
				>
					{value || " "}
				</span>
				<input
					aria-label={t`Document name`}
					value={value}
					readOnly={isLocked}
					maxLength={maxLength}
					spellCheck={false}
					autoComplete="off"
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
						if (event.key === "Escape") {
							cancelled.current = true;
							event.stopPropagation();
							event.currentTarget.blur();
						}
					}}
					className={cn(
						"col-start-1 row-start-1 h-8 w-full min-w-0 truncate rounded-lg bg-transparent px-1.5 text-sm font-semibold text-foreground transition-[background-color,box-shadow] duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus",
						isLocked ? "cursor-default" : "hover:bg-default focus:bg-default",
					)}
				/>
			</span>
			{isLocked && (
				<span className="flex shrink-0 text-muted" title={t`Locked`}>
					<Icon name="lock" size={16} />
					<span className="sr-only">{t`Locked`}</span>
				</span>
			)}
		</span>
	);
}

/** Leaving the editor is navigation, so it's a link styled as an icon button. */
export function BackLink() {
	const label = t`Back to documents`;

	return (
		<Tooltip>
			<Tooltip.Trigger>
				<Link
					to="/dashboard/documents"
					aria-label={label}
					className={buttonVariants({ variant: "ghost", size: "md", isIconOnly: true })}
				>
					<Icon name="arrow-left" />
				</Link>
			</Tooltip.Trigger>
			<Tooltip.Content placement="right">{label}</Tooltip.Content>
		</Tooltip>
	);
}

/** Tablet: show or hide the panel drawer and, in landscape, pin it beside the page. */
export function DrawerControls({ pinnable }: { pinnable: boolean }) {
	const open = useEditorStore((state) => state.drawerOpen);
	const pinned = useEditorStore((state) => state.drawerPinned) && pinnable;

	return (
		<>
			{!pinned && (
				<IconButton
					icon={open ? "sidebar-simple" : "sidebar-simple"}
					label={open ? t`Hide panel` : t`Show panel`}
					aria-expanded={open}
					className="text-muted"
					onPress={() => useEditorStore.setState({ drawerOpen: !open })}
				/>
			)}
			{pinnable && (open || pinned) && (
				<IconButton
					icon="square-split-horizontal"
					label={t`Keep the panel beside the page`}
					aria-pressed={pinned}
					className={cn("text-muted", pinned && "bg-accent-soft text-accent-soft-foreground")}
					onPress={() => {
						// Unpinning leaves the drawer open over the page.
						useEditorStore.setState({ drawerPinned: !pinned, drawerOpen: true });
					}}
				/>
			)}
		</>
	);
}

type UndoRedoProps = {
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
};

/** Undo and redo in the bar (⌘Z and ⌘⇧Z do the same outside fields, which keep their own). */
export function UndoRedo({ canUndo, canRedo, onUndo, onRedo }: UndoRedoProps) {
	return (
		<>
			<IconButton
				icon="arrow-counter-clockwise"
				label={t`Undo`}
				shortcut="⌘Z"
				className="text-muted"
				isDisabled={!canUndo}
				onPress={onUndo}
			/>
			<IconButton
				icon="arrow-clockwise"
				label={t`Redo`}
				shortcut="⌘⇧Z"
				className="text-muted"
				isDisabled={!canRedo}
				onPress={onRedo}
			/>
		</>
	);
}

/** The thin rule between groups of controls in the bar's middle. */
export function BarDivider() {
	return <Separator orientation="vertical" className="mx-1 h-5 self-center" />;
}

/**
 * − · Fit · + in the bar's middle, over the canvas, and (unless `compact`) the page count. Zoom runs from 60% to 150%;
 * ⌘0 fits the page again.
 */
export function ZoomControls({ compact = false }: { compact?: boolean }) {
	const zoom = useEditorStore((state) => state.zoom);
	const fitScale = useEditorStore((state) => state.fitScale);
	const pageCount = useEditorStore((state) => Math.max(1, state.rendered.pageCount));
	const setZoom = useEditorStore((state) => state.setZoom);
	const current = zoom === "fit" ? fitScale : zoom;

	useHotkey("Mod+0", () => setZoom("fit"));

	return (
		<>
			<IconButton
				icon="minus"
				label={t`Zoom out`}
				className="text-muted"
				isDisabled={current <= ZOOM_MIN}
				onPress={() => setZoom(current - ZOOM_STEP)}
			/>
			<Button
				variant="ghost"
				aria-label={t`Fit page to width`}
				className="min-w-14 px-2 text-sm font-medium tabular-nums"
				onPress={() => setZoom("fit")}
			>
				{zoom === "fit" ? <Trans>Fit</Trans> : `${Math.round(current * 100)}%`}
			</Button>
			<IconButton
				icon="plus"
				label={t`Zoom in`}
				className="text-muted"
				isDisabled={current >= ZOOM_MAX}
				onPress={() => setZoom(current + ZOOM_STEP)}
			/>
			{!compact && (
				<>
					<BarDivider />
					<span className="px-1.5 text-sm whitespace-nowrap text-muted tabular-nums">
						<Plural value={pageCount} one="# page" other="# pages" />
					</span>
				</>
			)}
		</>
	);
}
