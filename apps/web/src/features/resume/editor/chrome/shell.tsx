import type { MobileView, PanelView } from "@/features/resume/editor/store";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode, UIEvent } from "react";
import { Sheet, Widget } from "@heroui-pro/react";
import { Button, Toolbar } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Activity, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { useIsLandscape } from "@/features/resume/editor/chrome";
import { selectPanelView, useEditorStore } from "@/features/resume/editor/store";

// The editor shell resumes, letters and the portfolio share: the layout for the screen, the panel card beside or over
// the page (the modes, AI and History down its left), the floating Download over the page and, on phones, the
// floating dock with its sheet. Each editor brings its own bar, panels, page and phone body.

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
	bar: ReactNode;
	mode: string;
	/** The rail down the left of the panel card; phones switch from the dock over the page instead. */
	modes: ReactNode;
	/** The panel's accessible name in this mode. */
	panelLabel: string;
	panel: ReactNode;
	page: ReactNode;
	/** The assistant, shown in the panel while AI is picked. */
	assistant?: ReactNode;
	/** History, shown in the panel while it's picked. */
	history?: ReactNode;
	/** Floating over the page's lower end corner: Download. */
	floating?: ReactNode;
	/** Phones show the page with the mode dock over it; each editor brings its own. */
	mobile: ReactNode;
	/** The Download sheet and hotkeys. */
	children: ReactNode;
};

/**
 * The window: a 56px bar over the panel card and the page. The card holds the mode's panel, or the assistant or
 * History in its place, so the page keeps its room whatever the panel shows.
 */
export function EditorFrame({ editorLayout, bar, mobile, children, page, floating, ...panel }: EditorFrameProps) {
	const { layout, pinned } = editorLayout;
	const body = { ...panel, page, floating };

	return (
		<div className="grid h-svh grid-rows-[var(--editor-bar)_minmax(0,1fr)] overflow-hidden bg-background">
			<a
				href="#main-content"
				className="sr-only rounded-xl bg-overlay px-4 py-2 text-sm shadow-overlay focus:not-sr-only focus:absolute focus:inset-s-2 focus:top-2 focus:z-[100]"
			>
				<Trans>Skip to the page</Trans>
			</a>

			{bar}

			{(layout === "desktop" || pinned) && <DesktopBody {...body} pinned={pinned} />}
			{layout === "tablet" && !pinned && <TabletBody {...body} />}
			{layout === "mobile" && mobile}

			{children}
		</div>
	);
}

type BodyProps = Omit<EditorFrameProps, "editorLayout" | "bar" | "mobile" | "children">;

type PanelCardProps = Omit<BodyProps, "page" | "floating"> & { className?: string };

/**
 * The panel as one white card with its header down the left: the rail beside the mode's widgets (or the assistant, or
 * History), which scroll straight on the card (no scrollbar drawn) inside its rounded corners, so the corners stay as
 * it scrolls. The mode's panel stays mounted, hidden, while the assistant or History shows.
 */
function PanelCard({ mode, modes, panelLabel, panel, assistant, history, className }: PanelCardProps) {
	const view = useEditorStore(selectPanelView);
	const scroll = useModeScroll(view ?? mode);

	return (
		<div
			className={cn(
				"grid min-h-0 grid-cols-[4.5rem_minmax(0,1fr)] overflow-hidden rounded-[calc(var(--radius)*2)] bg-surface shadow-surface",
				className,
			)}
		>
			{modes}
			<section
				{...scroll}
				data-editor-panel
				aria-label={view === "assistant" ? t`AI` : view === "history" ? t`History` : panelLabel}
				// `relative`: absolutely positioned descendants (sr-only text, say) stay inside this scroller instead of
				// stretching the document, which would let scrollIntoView shift the whole editor. No scroll anchoring,
				// which yanked the Design panel back while scrolling it.
				className="relative scrollbar-none min-h-0 min-w-0 overflow-y-auto [overflow-anchor:none]"
			>
				<Activity mode={view === null ? "visible" : "hidden"}>{panel}</Activity>
				{view === "assistant" && <AssistantView>{assistant}</AssistantView>}
				{view === "history" && <HistoryView>{history}</HistoryView>}
			</section>
		</div>
	);
}

/** The assistant fills the panel's height: its conversation scrolls inside it, the composer stays at the bottom. */
function AssistantView({ children }: { children: ReactNode }) {
	return <div className={cn("h-full px-3 pb-3", MODE_ENTER_CLASS)}>{children}</div>;
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

/** The panel card beside the page: `--editor-panel` wide (400px when pinned on a tablet), Download over the page. */
function DesktopBody({ page, floating, pinned, ...panel }: BodyProps & { pinned: boolean }) {
	return (
		<div
			className={cn(
				"grid min-h-0",
				pinned ? "grid-cols-[400px_minmax(0,1fr)]" : "grid-cols-[var(--editor-panel)_minmax(0,1fr)]",
			)}
		>
			<PanelCard {...panel} className="ms-3 mb-3" />
			<Page floating={floating}>{page}</Page>
		</div>
	);
}

/** Tablets: the page, with the panel card as a 420px drawer over it, shown and hidden from the bar. */
function TabletBody({ page, floating, ...panel }: BodyProps) {
	const drawerOpen = useEditorStore((state) => state.drawerOpen);

	return (
		<div className="relative min-h-0">
			<Page floating={floating}>{page}</Page>
			<div
				inert={!drawerOpen}
				className={cn(
					"absolute start-2 top-0 bottom-2 z-20 flex w-[420px] max-w-[calc(100%-3rem)] flex-col rounded-[calc(var(--radius)*2)] shadow-overlay transition-[translate] duration-emphasized ease-drawer",
					!drawerOpen && "-translate-x-[calc(100%+1rem)] rtl:translate-x-[calc(100%+1rem)]",
				)}
			>
				<PanelCard {...panel} className="h-full" />
			</div>
		</div>
	);
}

type PageProps = { floating: ReactNode; children: ReactNode };

/** The page, with Download floating at its lower end corner. */
function Page({ floating, children }: PageProps) {
	return (
		<main id="main-content" className="relative h-full min-h-0 min-w-0">
			{children}
			{floating && (
				<div className="pointer-events-none absolute end-5 bottom-5 z-10 flex transition-[opacity,translate] duration-standard ease-enter starting:translate-y-2 starting:opacity-0">
					<div className="pointer-events-auto rounded-full shadow-overlay">{floating}</div>
				</div>
			)}
		</main>
	);
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
