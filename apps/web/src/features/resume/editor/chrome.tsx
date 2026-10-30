import type { ButtonProps } from "@heroui/react";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { Button, buttonVariants, Separator, Toolbar, Tooltip } from "@heroui/react";
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

// The editor chrome resumes and letters share: the back link and drawer controls in the bar, the canvas width
// and the zoom bar.

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

/** The canvas ref, the fit scale for the page format, and the scale the page is drawn at (zoom, or fit). */
export function usePageScale(format: keyof typeof PAGE_WIDTH) {
	const zoom = useEditorStore((state) => state.zoom);
	const isPhone = useBreakpoint() === "mobile";
	const [canvasRef, canvasWidth] = useCanvasWidth();
	const gutter = isPhone ? CANVAS_GUTTER.narrow : CANVAS_GUTTER.wide;
	const fitScale = canvasWidth > 0 ? Math.min(ZOOM_MAX, (canvasWidth - gutter) / PAGE_WIDTH[format]) : 1;
	const pageScale = zoom === "fit" ? Math.max(0.25, fitScale) : zoom;

	return { canvasRef, fitScale, pageScale };
}

type CanvasStatusPillProps = { icon: IconName; children: ReactNode };

/** The dark pill above the first page while a version or template is previewed instead of the live document. */
export function CanvasStatusPill({ icon, children }: CanvasStatusPillProps) {
	return (
		<span
			role="status"
			className="flex h-8 items-center gap-2 rounded-full bg-foreground ps-2.5 pe-3.5 text-[13px] font-medium text-background shadow-overlay"
		>
			<Icon name={icon} size={18} />
			{children}
		</span>
	);
}

type DocumentMenuTriggerProps = Omit<ButtonProps, "children"> & { name: string; isLocked: boolean };

/** The document name in the editor bar, as the button that opens the document menu. */
export function DocumentMenuTrigger({ name, isLocked, className, ...props }: DocumentMenuTriggerProps) {
	return (
		<Button
			variant="ghost"
			{...props}
			aria-label={t`Document menu: ${name}`}
			className={cn(
				"-ms-1.5 h-8 max-w-fit min-w-0 shrink justify-start gap-1.5 rounded-lg px-1.5 text-start font-normal",
				typeof className === "string" && className,
			)}
		>
			<span className="truncate text-sm font-semibold text-foreground">{name}</span>
			{isLocked && <Icon name="lock" size={16} className="shrink-0 text-muted" />}
			<Icon name="caret-down" size={16} className="shrink-0 text-muted" />
		</Button>
	);
}

/** Leaving the editor is navigation, so it's a link styled as an icon button. */
export function BackLink() {
	const label = t`Back to documents`;

	return (
		<Tooltip>
			<Tooltip.Trigger>
				<Link
					to="/dashboard"
					aria-label={label}
					className={buttonVariants({ variant: "ghost", size: "md", isIconOnly: true })}
				>
					<Icon name="arrow-left" />
				</Link>
			</Tooltip.Trigger>
			<Tooltip.Content placement="bottom">{label}</Tooltip.Content>
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

type ZoomBarProps = {
	fitScale: number;
	pageCount: number;
};

/** − · Fit · + and the page count, floating 18px above the bottom of the canvas. Zoom runs from 60% to 150%. */
export function ZoomBar({ fitScale, pageCount }: ZoomBarProps) {
	const zoom = useEditorStore((state) => state.zoom);
	const setZoom = useEditorStore((state) => state.setZoom);
	const current = zoom === "fit" ? fitScale : zoom;

	useHotkey("Mod+0", () => setZoom("fit"));

	return (
		<Toolbar isAttached aria-label={t`Zoom`} className="absolute bottom-[18px] left-1/2 -translate-x-1/2 gap-0.5">
			<IconButton
				icon="minus"
				label={t`Zoom out`}
				size="sm"
				tooltipPlacement="top"
				className="rounded-full"
				isDisabled={current <= ZOOM_MIN}
				onPress={() => setZoom(current - ZOOM_STEP)}
			/>
			<Button
				variant="ghost"
				size="sm"
				aria-label={t`Fit page to width`}
				className="min-w-[52px] rounded-full px-2 text-xs font-medium tabular-nums"
				onPress={() => setZoom("fit")}
			>
				{zoom === "fit" ? <Trans>Fit</Trans> : `${Math.round(current * 100)}%`}
			</Button>
			<IconButton
				icon="plus"
				label={t`Zoom in`}
				size="sm"
				tooltipPlacement="top"
				className="rounded-full"
				isDisabled={current >= ZOOM_MAX}
				onPress={() => setZoom(current + ZOOM_STEP)}
			/>
			<Separator orientation="vertical" className="mx-1" />
			<span className="ps-1 pe-3 text-xs whitespace-nowrap text-muted tabular-nums">
				<Plural value={pageCount} one="# page" other="# pages" />
			</span>
		</Toolbar>
	);
}
