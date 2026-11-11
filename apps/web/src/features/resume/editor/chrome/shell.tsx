import type { MobileView, PanelView } from "@/features/resume/editor/store";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode, UIEvent } from "react";
import { Sheet, Widget } from "@heroui-pro/react";
import { Button, Toolbar } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Activity, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { loadAssistantPanel } from "@/features/assistant/dock";
import { BackLink, DrawerControls, useIsLandscape } from "@/features/resume/editor/chrome";
import { selectPanelView, useEditorStore } from "@/features/resume/editor/store";

// The editor shell resumes, letters and the portfolio share: the layout for the screen, the rail down the window's
// left edge (the modes, AI and History), the panel card beside or over the page, the floating Download over the page
// and, on phones, the floating dock with its sheet. Each editor brings its own bar, panels, page and phone body.

/** Desktop, tablet (the panel is a drawer, pinnable beside the page in landscape) or phone. */
export function useEditorLayout() {
	const breakpoint = useBreakpoint();
	const layout = breakpoint === "mobile" ? "mobile" : breakpoint === "tablet" ? "tablet" : "desktop";
	const landscape = useIsLandscape();
	const pinnable = layout === "tablet" && landscape;
	const pinned = useEditorStore((state) => state.drawerPinned) && pinnable;

	return { layout, pinnable, pinned } as const;
}

type EditorLayout = ReturnType<typeof useEditorLayout>;

type EditorFrameProps = {
	editorLayout: EditorLayout;
	/** Phones only: the bar over the page (back, the name, Download). */
	bar: ReactNode;
	/** Leaving the editor, at the top of the rail: "Back to documents" unless the editor has its own place. */
	back?: ReactNode;
	/** The rail down the window's left edge; phones switch from the dock instead. */
	modes: ReactNode;
	/** The panel section's header: the document's name, its menu and save state. */
	title: ReactNode;
	/** The canvas section's header, centered: undo, redo, zoom, the page count. */
	controls: ReactNode;
	/** The canvas section's header, at its end: the portfolio's published page. */
	actions?: ReactNode;
	mode: string;
	/** The panel's accessible name in this mode. */
	panelLabel: string;
	panel: ReactNode;
	page: ReactNode;
	/** The assistant, in its own section at the right (a drawer below 1280px); editors without one leave it out. */
	assistant?: ReactNode;
	/** History, shown in the panel while it's picked. */
	history?: ReactNode;
	/** Floating over the canvas's lower end corner: Download. */
	floating?: ReactNode;
	/** Phones show the page with the mode dock over it; each editor brings its own. */
	mobile: ReactNode;
	/** The Download sheet and hotkeys. */
	children: ReactNode;
};

/**
 * The window, on the white surface. One header row runs across the top, its parts over the sections they belong to
 * (as in ChatGPT): back over the rail, the document's name over the panel, undo and zoom over the canvas, the
 * assistant's own header over its column. Under it: the rail down the left edge (the modes, then History and AI at its
 * foot), one bordered wrapper holding the panel (white) and the canvas (gray, the page on it), and while open the
 * assistant's column. Below 1024px the panel is a drawer over the canvas, and below 1280px the assistant comes over
 * the canvas from the right. Phones show the bar over their own body.
 */
export function EditorFrame({ editorLayout, bar, back, modes, mobile, children, ...sections }: EditorFrameProps) {
	const { layout, pinned } = editorLayout;
	const wide = useBreakpoint() === "wide";
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	const assistantInstant = useEditorStore((state) => state.assistantInstant);

	if (layout === "mobile")
		return (
			<div className="grid h-svh grid-rows-[var(--editor-bar)_minmax(0,1fr)] overflow-hidden bg-background">
				<SkipLink />
				{bar}
				{mobile}
				{children}
			</div>
		);

	const docked = layout === "desktop" || pinned;
	// ≥1280 the assistant takes a column of its own; narrower, it comes over the canvas.
	const column = wide && sections.assistant !== undefined;
	const columns = `4.5rem ${docked ? (pinned ? "380px" : "var(--editor-panel)") : "0px"} minmax(0,1fr) ${column && assistantOpen ? "var(--editor-assistant)" : "0px"}`;

	return (
		<div
			className={cn(
				"grid h-svh grid-rows-[var(--editor-bar)_minmax(0,1fr)] overflow-hidden bg-surface pe-2 pb-2",
				assistantInstant
					? "transition-none"
					: "transition-[grid-template-columns] duration-emphasized ease-enter motion-reduce:transition-none",
			)}
			style={{ gridTemplateColumns: columns }}
		>
			<SkipLink />

			{/* The header row. */}
			<div className="col-start-1 row-start-1 flex items-center justify-center">{back ?? <BackLink />}</div>
			<header className="col-start-2 row-start-1 flex min-w-0 items-center gap-1 overflow-hidden px-3">
				{docked && sections.title}
			</header>
			<CanvasHeader {...sections} layout={layout} pinnable={editorLayout.pinnable} pinned={pinned} />

			<div className="col-start-1 row-start-2 scrollbar-none min-h-0 overflow-y-auto">{modes}</div>

			<div className="relative col-span-2 col-start-2 row-start-2 grid min-h-0 min-w-0 grid-cols-subgrid overflow-hidden rounded-[calc(var(--radius)*2.5)] border border-separator">
				{docked ? <PanelSection {...sections} className="border-e border-separator" /> : <span aria-hidden="true" />}
				<CanvasSection {...sections} />

				{!docked && <PanelDrawer {...sections} />}
				{!column && sections.assistant !== undefined && (
					<AssistantDrawer open={assistantOpen}>{sections.assistant}</AssistantDrawer>
				)}
			</div>

			{column && <AssistantSection open={assistantOpen}>{sections.assistant}</AssistantSection>}

			{children}
		</div>
	);
}

function SkipLink() {
	return (
		<a
			href="#main-content"
			className="sr-only rounded-xl bg-overlay px-4 py-2 text-sm shadow-overlay focus:not-sr-only focus:absolute focus:inset-s-2 focus:top-2 focus:z-[100]"
		>
			<Trans>Skip to the page</Trans>
		</a>
	);
}

type SectionProps = Omit<EditorFrameProps, "editorLayout" | "bar" | "back" | "modes" | "mobile" | "children">;

type PanelSectionProps = SectionProps & { className?: string };

/**
 * The panel section (white): the mode's widgets, or History in their place, scrolling with no scrollbar drawn. The
 * mode's panel stays mounted, hidden, while History shows. Its name sits in the header row above it.
 */
function PanelSection({ mode, panelLabel, panel, history, className }: PanelSectionProps) {
	const historyOpen = useEditorStore((state) => state.historyOpen) && history !== undefined;
	const scroll = useModeScroll(historyOpen ? "history" : mode);

	return (
		<section
			{...scroll}
			data-editor-panel
			aria-label={historyOpen ? t`History` : panelLabel}
			// `relative`: absolutely positioned descendants (sr-only text, say) stay inside this scroller instead of
			// stretching the document, which would let scrollIntoView shift the whole editor. No scroll anchoring,
			// which yanked the Design panel back while scrolling it.
			className={cn(
				"relative scrollbar-none min-h-0 min-w-0 overflow-y-auto bg-surface [overflow-anchor:none]",
				className,
			)}
		>
			<Activity mode={historyOpen ? "hidden" : "visible"}>{panel}</Activity>
			{historyOpen && <HistoryView>{history}</HistoryView>}
		</section>
	);
}

type CanvasHeaderProps = SectionProps & {
	layout: EditorLayout["layout"];
	pinnable: boolean;
	pinned: boolean;
};

/**
 * The header row over the canvas: undo, zoom and the page count centered, the assistant's toggle at its end. Tablets
 * start it with the panel drawer's controls and the document's name, since the panel isn't beside the page there.
 */
function CanvasHeader({ title, controls, actions, assistant, layout, pinnable, pinned }: CanvasHeaderProps) {
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	const tablet = layout === "tablet";

	return (
		<header className="col-start-3 row-start-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3">
			<div className="flex min-w-0 items-center gap-1">
				{tablet && <DrawerControls pinnable={pinnable} />}
				{tablet && !pinned && title}
			</div>
			<div className="flex items-center justify-center gap-0.5">{controls}</div>
			<div className="flex items-center justify-end gap-1">
				{actions}
				{assistant !== undefined && (
					<IconButton
						icon="sparkle"
						label={t`AI`}
						shortcut="⌘J"
						aria-pressed={assistantOpen}
						className={cn("text-muted", assistantOpen && "bg-default text-foreground")}
						onPointerEnter={() => void loadAssistantPanel()}
						onPress={() => useEditorStore.getState().setAssistantOpen(!assistantOpen)}
					/>
				)}
			</div>
		</header>
	);
}

/** The canvas section (gray): the page, with Download floating at its lower end corner. */
function CanvasSection({ page, floating }: SectionProps) {
	return (
		<main id="main-content" className="relative min-h-0 min-w-0 bg-background">
			{page}
			{floating && (
				<div className="pointer-events-none absolute end-5 bottom-5 z-10 flex transition-[opacity,translate] duration-standard ease-enter starting:translate-y-2 starting:opacity-0">
					<div className="pointer-events-auto rounded-full shadow-overlay">{floating}</div>
				</div>
			)}
		</main>
	);
}

/** Tablets: the panel section as a 380px drawer over the canvas, from the wrapper's start edge. */
function PanelDrawer(props: SectionProps) {
	const drawerOpen = useEditorStore((state) => state.drawerOpen);

	return (
		<div
			inert={!drawerOpen}
			className={cn(
				"absolute inset-y-0 start-0 z-20 flex w-[380px] max-w-[calc(100%-3rem)] flex-col border-e border-separator shadow-overlay transition-[translate,opacity] duration-emphasized ease-drawer",
				!drawerOpen && "pointer-events-none -translate-x-4 opacity-0 rtl:translate-x-4",
			)}
		>
			<PanelSection {...props} className="h-full" />
		</div>
	);
}

type AssistantPlaceProps = { open: boolean; children: ReactNode };

/**
 * ≥1280: the assistant's column on the window, from the top (its own header in the header row) to the bottom, as wide
 * as `--editor-assistant` while open; its content fades in.
 */
function AssistantSection({ open, children }: AssistantPlaceProps) {
	return (
		<div inert={!open} className="col-start-4 row-span-2 row-start-1 min-h-0 min-w-0 overflow-hidden">
			{open && (
				<div className={cn("h-full w-full min-w-[var(--editor-assistant)] ps-3 pe-1", MODE_ENTER_CLASS)}>
					{children}
				</div>
			)}
		</div>
	);
}

/** Below 1280: the assistant as a drawer over the canvas from the wrapper's end edge. */
function AssistantDrawer({ open, children }: AssistantPlaceProps) {
	return (
		<div
			inert={!open}
			className={cn(
				"absolute inset-y-0 end-0 z-30 flex w-[400px] max-w-[calc(100%-3rem)] flex-col border-s border-separator bg-surface px-3 pb-3 shadow-overlay transition-[translate,opacity] duration-emphasized ease-drawer",
				!open && "pointer-events-none translate-x-4 opacity-0 rtl:-translate-x-4",
			)}
		>
			{open && children}
		</div>
	);
}

/** History in the panel: the versions in a widget, the picked one shown read-only on the page. */
function HistoryView({ children }: { children: ReactNode }) {
	return (
		<div className={cn("p-3", MODE_ENTER_CLASS)}>
			<Widget role="region" aria-labelledby="editor-history-title">
				<WidgetHeading id="editor-history-title" icon="clock-counter-clockwise" title={t`History`} />
				<Widget.Content className="@container min-w-0">{children}</Widget.Content>
			</Widget>
		</div>
	);
}

/**
 * One scroller for every mode: a mode opens at its top the first time and where it was left after that. Positions
 * are kept as the panel scrolls, since hiding the old mode's panel can clamp the scroller before a switch is seen.
 */
function useModeScroll(mode: string) {
	const ref = useRef<HTMLElement>(null);
	const positions = useRef(new Map<string, number>());

	useLayoutEffect(() => {
		if (ref.current) ref.current.scrollTop = positions.current.get(mode) ?? 0;
	}, [mode]);

	return {
		ref,
		onScroll: (event: UIEvent<HTMLElement>) => positions.current.set(mode, event.currentTarget.scrollTop),
	};
}

/**
 * A mode's panel arriving: a 4px rise and fade over D2. It runs each time the panel shows, also when a kept panel
 * comes back from `display: none` (`@starting-style` applies then too).
 */
export const MODE_ENTER_CLASS =
	"transition-[opacity,translate] duration-standard ease-enter starting:translate-y-1 starting:opacity-0";

type KeptModesProps<M extends string> = { mode: M; children: (mode: M) => ReactNode };

/**
 * Each mode's panel mounts the first time it opens and then stays, hidden, so switching back is instant and keeps
 * what was open in it. A hidden panel drops its subscriptions and catches up when it shows again.
 */
export function KeptModes<M extends string>({ mode, children }: KeptModesProps<M>) {
	const [opened, setOpened] = useState<readonly M[]>([mode]);
	if (!opened.includes(mode)) setOpened([...opened, mode]);

	return opened.map((kept) => (
		<Activity key={kept} mode={kept === mode ? "visible" : "hidden"}>
			<div className={MODE_ENTER_CLASS}>{children(kept)}</div>
		</Activity>
	));
}

export type DockItem<M extends string> = {
	mode: M;
	icon: IconName;
	label: string;
	/** A count or dot beside the icon. */
	extra?: ReactNode;
};

type View = Exclude<PanelView, null>;

type MobileEditorProps<M extends string> = {
	items: DockItem<M>[];
	/** AI and History after the modes; each opens in the sheet like a mode. */
	views?: readonly View[];
	assistant?: ReactNode;
	history?: ReactNode;
	/** The mode whose sheet is open, or null while the page shows on its own. */
	open: M | null;
	onOpenChange: (mode: M | null) => void;
	/** The page, always under the dock and the sheet. */
	page: ReactNode;
	/** Floating over the page above the dock while no sheet is open: the selection bar, say. */
	overlay?: ReactNode;
	/** The open mode's panel. */
	children: ReactNode;
	/** Modes whose sheet rests at half height, so changes show on the page above it (Design). */
	halfModes?: readonly M[];
};

const viewItem = (view: View): DockItem<View> =>
	view === "assistant"
		? { mode: "assistant", icon: "sparkle", label: t`AI` }
		: { mode: "history", icon: "clock-counter-clockwise", label: t`History` };

/**
 * Phones: the page, with the modes (then AI and History) as a floating button group along the bottom. Each opens its
 * panel in a sheet that can be swiped away; Design's rests at half height so the page stays in view above it. The
 * sheet's header switches between them without closing it.
 */
export function MobileEditor<M extends string>({
	items: modeItems,
	views = [],
	assistant,
	history,
	open: openMode,
	onOpenChange,
	page,
	overlay,
	children,
	halfModes = [],
}: MobileEditorProps<M>) {
	const view = useEditorStore(selectPanelView);
	const items: DockItem<M | View>[] = [...modeItems, ...views.map(viewItem)];
	const open: M | View | null = view && views.includes(view) ? view : openMode;
	// History rests at half height too: a picked version shows on the page above it.
	const half = open === "history" || (openMode !== null && open === openMode && halfModes.includes(openMode));
	const label = items.find((item) => item.mode === open)?.label ?? "";
	const select = (next: M | View | null) => {
		if (next === "assistant" || next === "history") {
			useEditorStore.getState().setPanelView(next as View);
			return;
		}
		useEditorStore.getState().setPanelView(null);
		onOpenChange(next as M | null);
	};
	// Where the sheet rests: half height (a fraction of the window) for Design, full for the rest. A mode that opens or
	// switches starts at its own resting point; a swipe can move it to the other.
	const [snap, setSnap] = useState<{ mode: M | View | null; point: number | string | null }>({ mode: open, point: 1 });
	if (snap.mode !== open) setSnap({ mode: open, point: half ? HALF_SHEET : 1 });

	return (
		<div className="relative min-h-0">
			<main id="main-content" className="h-full">
				{page}
			</main>
			{open === null && overlay}
			<MobileDock items={items} hidden={open !== null} onOpen={select} />

			<Sheet
				isOpen={open !== null}
				onOpenChange={(next) => !next && select(null)}
				snapPoints={SNAP_POINTS}
				// The backdrop stays clear at half height, so the page reads as part of the view.
				fadeFromIndex={1}
				activeSnapPoint={snap.point}
				onActiveSnapPointChange={(point) => setSnap({ mode: open, point })}
			>
				<Sheet.Backdrop>
					<Sheet.Content className="h-[calc(100svh-2.5rem)] w-full">
						<Sheet.Dialog aria-label={label} className="gap-0 p-0">
							<Sheet.Handle />
							<div className="flex shrink-0 items-center gap-2 px-3 pb-2">
								<SheetModeSwitch items={items} open={open} onOpen={select} />
								{/* In the header row, under anything the panel lays over the sheet (a phone entry's own screen). */}
								<Sheet.CloseTrigger aria-label={t`Close`} className="static z-0 ms-auto" />
							</div>
							<Sheet.Body
								data-editor-panel
								className="relative min-h-0 flex-1 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] [overflow-anchor:none]"
							>
								{open === "assistant" ? (
									<div className="h-full px-3 pb-3">{assistant}</div>
								) : open === "history" ? (
									<HistoryView>{history}</HistoryView>
								) : (
									children
								)}
								{/* At half height the sheet's lower part is off screen: this keeps the end of the panel scrollable into view. */}
								{snap.point === HALF_SHEET && <div aria-hidden="true" className="h-[45svh]" />}
							</Sheet.Body>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</div>
	);
}

// Fractions of the window's height the sheet shows: Design rests at the first, everything else at full height.
const HALF_SHEET = 0.55;
const SNAP_POINTS = [HALF_SHEET, 1];

type DockProps<M extends string> = {
	items: DockItem<M>[];
	hidden: boolean;
	onOpen: (mode: M) => void;
};

/** The floating button group: one button per mode, an icon over its name. It sinks away while a sheet is open. */
function MobileDock<M extends string>({ items, hidden, onOpen }: DockProps<M>) {
	return (
		<div
			inert={hidden}
			className={cn(
				"pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-center transition-[opacity,translate] duration-standard ease-enter starting:translate-y-4 starting:opacity-0",
				hidden && "translate-y-4 opacity-0",
			)}
		>
			<Toolbar
				aria-label={t`Editor views`}
				className="pointer-events-auto gap-0.5 rounded-full border border-separator bg-overlay p-1 shadow-overlay"
			>
				{items.map((item) => (
					<Button
						key={item.mode}
						variant="ghost"
						className="relative h-12 w-12 min-w-0 flex-col gap-0.5 rounded-full px-0 text-[11px] leading-none font-medium text-muted active:scale-95"
						onPress={() => onOpen(item.mode)}
					>
						<Icon name={item.icon} size={20} />
						{item.label}
						{item.extra ? <span className="absolute end-2 top-1 flex">{item.extra}</span> : null}
					</Button>
				))}
			</Toolbar>
		</div>
	);
}

type SheetModeSwitchProps<M extends string> = {
	items: DockItem<M>[];
	open: M | null;
	onOpen: (mode: M) => void;
};

/** The sheet's header: the modes as compact pills, the open one with its name. */
function SheetModeSwitch<M extends string>({ items, open, onOpen }: SheetModeSwitchProps<M>) {
	return (
		<Toolbar aria-label={t`Editor views`} className="min-w-0 gap-1">
			{items.map((item) => {
				const active = item.mode === open;
				return (
					<Button
						key={item.mode}
						size="sm"
						variant={active ? "secondary" : "ghost"}
						aria-pressed={active}
						aria-label={item.label}
						className={cn("gap-1.5 rounded-full", !active && "text-muted")}
						onPress={() => onOpen(item.mode)}
					>
						<Icon name={item.icon} size={18} variant={active ? "duotone" : "stroke"} />
						{active && <span className="truncate">{item.label}</span>}
					</Button>
				);
			})}
		</Toolbar>
	);
}

/** The editor's phone view in the store as the open sheet: "page" (or nothing yet) means none is open. */
export function useMobileSheet<M extends string>(modes: readonly M[]) {
	const view = useEditorStore((state) => state.mobileView);
	return (view !== null && (modes as readonly MobileView[]).includes(view) ? view : null) as M | null;
}
