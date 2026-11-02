import type { MobileView } from "@/features/resume/editor/store";
import type { IconName } from "@rezumi/ui/components/icon";
import type { CSSProperties, ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { MobileTabIndicator } from "@/components/layout/mobile-tab-indicator";
import {
	AssistantColumn,
	AssistantOverlay,
	AssistantReplace,
	assistantGridTransition,
	assistantPlaceFor,
	columnsWithAssistant,
} from "@/features/assistant/dock";
import { useIsLandscape } from "@/features/resume/editor/chrome";
import { useEditorStore } from "@/features/resume/editor/store";

// The editor shell resumes and letters share: the layout for the screen, the panel beside or over the page, the
// assistant's place and the phone tab bar. Each editor brings its own bar, panels, page and phone body.

/** Desktop, tablet (the panel is a drawer, pinnable beside the page in landscape) or phone. */
export function useEditorLayout() {
	const breakpoint = useBreakpoint();
	const layout = breakpoint === "mobile" ? "mobile" : breakpoint === "tablet" ? "tablet" : "desktop";
	const landscape = useIsLandscape();
	const pinnable = layout === "tablet" && landscape;
	const pinned = useEditorStore((state) => state.drawerPinned) && pinnable;

	return { layout, pinnable, pinned, assistantPlace: assistantPlaceFor(breakpoint) } as const;
}

type EditorFrameProps = {
	editorLayout: ReturnType<typeof useEditorLayout>;
	bar: ReactNode;
	mode: string;
	/** The mode switch, above the panel; phones switch from their tab bar instead. */
	modes: ReactNode;
	/** The panel's accessible name in this mode. */
	panelLabel: string;
	panel: ReactNode;
	page: ReactNode;
	assistant: ReactNode;
	/** Phones show one view at a time; each editor brings its own. */
	mobile: ReactNode;
	/** The Download & history sheet and hotkeys. */
	children: ReactNode;
};

/**
 * The columns the bar and the body share, so the bar's zones line up with what's under them: the panel column, the
 * page (and on wide screens the assistant). Set as `--editor-columns` on the frame and read by both grids.
 */
function useEditorColumns({ layout, pinned, assistantPlace }: ReturnType<typeof useEditorLayout>) {
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	if (layout === "mobile" || (layout === "tablet" && !pinned)) return "auto minmax(0,1fr)";
	if (pinned) return "380px minmax(0,1fr)";
	return assistantPlace === "column" ? columnsWithAssistant(assistantOpen) : "var(--editor-panel) minmax(0,1fr)";
}

/** The editor grid's column transition: the assistant's column opens and closes, ⌘J switches at once. */
export function useEditorColumnsTransition() {
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	const assistantInstant = useEditorStore((state) => state.assistantInstant);
	return assistantGridTransition(assistantOpen, assistantInstant);
}

/**
 * A 56px bar over the panel and the page, on one column grid; the assistant joins as a column, in the panel's place,
 * or over it all.
 */
export function EditorFrame({
	editorLayout,
	bar,
	mode,
	modes,
	panelLabel,
	panel,
	page,
	assistant,
	mobile,
	children,
}: EditorFrameProps) {
	const { layout, pinned, assistantPlace } = editorLayout;
	const columns = useEditorColumns(editorLayout);

	return (
		<div
			className="grid h-svh grid-rows-[var(--editor-bar)_minmax(0,1fr)] overflow-hidden bg-background"
			style={{ "--editor-columns": columns } as CSSProperties}
		>
			<a
				href="#main-content"
				className="sr-only rounded-xl bg-overlay px-4 py-2 text-sm shadow-overlay focus:not-sr-only focus:absolute focus:inset-s-2 focus:top-2 focus:z-[100]"
			>
				<Trans>Skip to the page</Trans>
			</a>

			{bar}

			{(layout === "desktop" || pinned) && (
				<DesktopBody
					mode={mode}
					modes={modes}
					panelLabel={panelLabel}
					panel={panel}
					page={page}
					assistant={assistant}
					column={assistantPlace === "column"}
					replace={assistantPlace === "replace"}
				/>
			)}
			{layout === "tablet" && !pinned && (
				<TabletBody mode={mode} modes={modes} panelLabel={panelLabel} panel={panel} page={page} />
			)}
			{layout === "mobile" && mobile}

			{(assistantPlace === "drawer" || assistantPlace === "screen") && (
				<AssistantOverlay place={assistantPlace}>{assistant}</AssistantOverlay>
			)}

			{children}
		</div>
	);
}

type BodyProps = { mode: string; modes: ReactNode; panelLabel: string; panel: ReactNode; page: ReactNode };

type PanelColumnProps = Omit<BodyProps, "page">;

/**
 * The panel column: the mode switch, then the panel scrolling under it. No surface of its own: the panel's widgets
 * sit on the window, 12px from its edge, in line with the bar's back button above them.
 */
function PanelColumn({ mode, modes, panelLabel, panel }: PanelColumnProps) {
	return (
		<div className="flex min-h-0 min-w-0 flex-col">
			{/* The same scrollbar gutter as the panel below, so the switch and the widgets share both edges. */}
			<div className="shrink-0 [scrollbar-gutter:stable] overflow-hidden px-3 pb-1">{modes}</div>
			<section
				key={mode}
				aria-label={panelLabel}
				// `relative`: absolutely positioned descendants (sr-only text, say) stay inside this scroller instead of
				// stretching the document, which would let scrollIntoView shift the whole editor. Keyed by mode so each
				// mode starts at its top; no scroll anchoring, which yanked the Design panel back while scrolling it.
				className="relative min-h-0 flex-1 scrollbar [scrollbar-gutter:stable] overflow-y-auto [overflow-anchor:none]"
			>
				{panel}
			</section>
		</div>
	);
}

type DesktopBodyProps = BodyProps & {
	assistant: ReactNode;
	/** ≥1280: the assistant has its own column. */
	column: boolean;
	/** 1024–1279: the assistant takes the panel's place while open. */
	replace: boolean;
};

/** The panel beside the page: 400px on desktop, 380px when pinned on a tablet; the assistant joins at ≥1280. */
function DesktopBody({ assistant, column, replace, page, ...panel }: DesktopBodyProps) {
	const assistantOpen = useEditorStore((state) => state.assistantOpen);
	const transition = useEditorColumnsTransition();

	return (
		<div className={cn("relative grid min-h-0 grid-cols-(--editor-columns)", transition)}>
			<AssistantReplace
				replaced={replace && assistantOpen}
				assistant={
					<div className="min-h-0 ps-3 pb-3">
						<div className="h-full overflow-hidden">{assistant}</div>
					</div>
				}
			>
				<PanelColumn {...panel} />
			</AssistantReplace>
			<main id="main-content" className="min-h-0 min-w-0">
				{page}
			</main>
			{column && <AssistantColumn>{assistant}</AssistantColumn>}
		</div>
	);
}

/** Tablets: the page, with the panel and its mode switch as a 380px drawer over it. */
function TabletBody({ page, ...panel }: BodyProps) {
	const drawerOpen = useEditorStore((state) => state.drawerOpen);

	return (
		<div className="relative min-h-0">
			<main id="main-content" className="h-full min-w-0">
				{page}
			</main>
			<div
				inert={!drawerOpen}
				className={cn(
					"absolute start-2 top-0 bottom-2 z-20 flex w-[380px] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-2xl bg-background pt-3 shadow-overlay transition-transform duration-emphasized ease-enter",
					!drawerOpen && "-translate-x-[calc(100%+1rem)] rtl:translate-x-[calc(100%+1rem)]",
				)}
			>
				<PanelColumn {...panel} />
			</div>
		</div>
	);
}

type MobileTabBarProps<V extends MobileView> = {
	tabs: { view: V; icon: IconName; label: string }[];
	view: V;
	/** Every view but Page is also the editor's mode. */
	onModeChange: (mode: Exclude<V, "page">) => void;
};

/** Phones: the views along the bottom, one showing at a time. */
export function MobileTabBar<V extends MobileView>({ tabs, view, onModeChange }: MobileTabBarProps<V>) {
	return (
		<nav
			aria-label={t`Editor views`}
			className="flex border-t border-separator bg-surface pb-[env(safe-area-inset-bottom)]"
		>
			{tabs.map(({ view: tab, icon, label }) => {
				const active = tab === view;

				return (
					<button
						key={tab}
						type="button"
						aria-current={active ? "page" : undefined}
						onClick={() => {
							useEditorStore.setState({ mobileView: tab });
							if (tab !== "page") onModeChange(tab as Exclude<V, "page">);
						}}
						className={cn(
							"relative flex min-h-[52px] flex-1 cursor-(--cursor-interactive) flex-col items-center justify-center gap-0.5 text-xs transition-[color,scale] duration-quick ease-enter outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset active:scale-[0.97]",
							active ? "font-semibold text-foreground" : "text-muted",
						)}
					>
						{active && <MobileTabIndicator />}
						<Icon name={icon} size={24} variant={active ? "duotone" : "stroke"} />
						{label}
					</button>
				);
			})}
		</nav>
	);
}
