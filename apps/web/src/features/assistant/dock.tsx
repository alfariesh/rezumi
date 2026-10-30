import type { AssistantDocument } from "./document";
import type { Breakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import type { Variants } from "motion/react";
import type { ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { AnimatePresence, m } from "motion/react";
import { lazy, Suspense } from "react";
import { useLocale } from "react-aria-components";
import { useLetterAssistantDocument, useResumeAssistantDocument } from "./document";
import { useEditorStore } from "@/features/resume/editor/store";
import { D2, D3, EASE, EXIT } from "@/libs/motion";

/**
 * Where the assistant sits (README §6.5): a third column at ≥1280 (it and the panel share `--editor-side`), in place
 * of the panel at 1024–1279, a drawer over the page on tablets, and the whole screen on phones.
 */
export type AssistantPlace = "column" | "replace" | "drawer" | "screen";

export const assistantPlaceFor = (breakpoint: Breakpoint): AssistantPlace =>
	breakpoint === "wide"
		? "column"
		: breakpoint === "desktop"
			? "replace"
			: breakpoint === "tablet"
				? "drawer"
				: "screen";

/** The editor grid's columns at ≥1280: the panel narrows and the assistant's column opens, animated. */
export const columnsWithAssistant = (open: boolean) =>
	open ? "var(--editor-side) minmax(0,1fr) var(--editor-side)" : "var(--editor-panel) minmax(0,1fr) 0px";

/** The editor grid's transition: the assistant's column opens over 320ms and closes in 70% of that; ⌘J is instant. */
export const assistantGridTransition = (open: boolean, instant: boolean) =>
	instant
		? "transition-none"
		: open
			? "transition-[grid-template-columns] duration-emphasized ease-enter"
			: "transition-[grid-template-columns] duration-[calc(var(--d3)*0.7)] ease-enter";

/** The column's content fades in once the column has started to open and out as it closes; ⌘J skips both. */
const columnContent: Variants = {
	hidden: (instant: boolean) => ({
		opacity: 0,
		transition: instant ? { duration: 0 } : { duration: D2 * EXIT, ease: EASE },
	}),
	shown: (instant: boolean) => ({
		opacity: 1,
		transition: instant ? { duration: 0 } : { duration: D2, delay: 0.08, ease: EASE },
	}),
};

type AssistantColumnProps = { children: ReactNode };

/**
 * ≥1280: the assistant's column, as wide as the panel's while it's open (`--editor-side`): 12px in from both edges, with
 * no card of its own (it floats like the panel's widgets). Its content keeps (nearly) the open column's
 * width from the start, so it travels in with the column's edge instead of re-wrapping every frame, and it stays
 * mounted until it has faded out.
 */
export function AssistantColumn({ children }: AssistantColumnProps) {
	const open = useEditorStore((state) => state.assistantOpen);
	const instant = useEditorStore((state) => state.assistantInstant);

	return (
		<div inert={!open} className="min-h-0 min-w-0 scrollbar [scrollbar-gutter:stable] overflow-hidden px-3 pb-3">
			<AnimatePresence initial={false} custom={instant}>
				{open && (
					<m.div
						key="assistant"
						custom={instant}
						variants={columnContent}
						initial="hidden"
						animate="shown"
						exit="hidden"
						className="h-full w-full min-w-[calc(var(--editor-side)-3rem)] overflow-hidden"
					>
						{children}
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}

/** 1024–1279: the panel and the assistant swap in one cell. The outgoing side fades out in 140ms, the incoming one
 * fades up 4px over 200ms; ⌘J swaps at once. */
const replaceSwap: Variants = {
	hidden: { opacity: 0, transform: "translateY(4px)" },
	shown: (instant: boolean) => ({
		opacity: 1,
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { duration: D2, ease: EASE },
	}),
	gone: (instant: boolean) => ({
		opacity: 0,
		transition: instant ? { duration: 0 } : { duration: D2 * EXIT, ease: EASE },
	}),
};

type AssistantReplaceProps = { replaced: boolean; assistant: ReactNode; children: ReactNode };

/**
 * The editor's first grid cell: the mode panel, or (1024–1279, assistant open) the assistant in its place.
 * `popLayout` lifts the outgoing side out of the grid, absolutely over the same cell, so the page column never moves.
 * The grid around it must be `relative`.
 */
export function AssistantReplace({ replaced, assistant, children }: AssistantReplaceProps) {
	const instant = useEditorStore((state) => state.assistantInstant);

	return (
		<AnimatePresence mode="popLayout" initial={false} custom={instant}>
			<m.div
				key={replaced ? "assistant" : "panel"}
				custom={instant}
				variants={replaceSwap}
				initial="hidden"
				animate="shown"
				exit="gone"
				className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)]"
			>
				{replaced ? assistant : children}
			</m.div>
		</AnimatePresence>
	);
}

type AssistantOverlayProps = { place: "drawer" | "screen"; children: ReactNode };
type OverlayCustom = { instant: boolean; hidden: string; shown: string };

/** Enters from off-screen over 320ms and leaves the same way in 70% of that; ⌘J (`instant`) skips both. */
const overlayMotion: Variants = {
	hidden: ({ instant, hidden }: OverlayCustom) => ({
		transform: hidden,
		transition: instant ? { duration: 0 } : { duration: D3 * EXIT, ease: EASE },
	}),
	shown: ({ instant, shown }: OverlayCustom) => ({
		transform: shown,
		transition: instant ? { duration: 0 } : { duration: D3, ease: EASE },
	}),
};

/** Tablets: a 400px drawer that slides in from the end edge, under the bar. Phones: the whole screen, rising. */
export function AssistantOverlay({ place, children }: AssistantOverlayProps) {
	const open = useEditorStore((state) => state.assistantOpen);
	const instant = useEditorStore((state) => state.assistantInstant);
	const rtl = useLocale().direction === "rtl";
	const custom: OverlayCustom =
		place === "drawer"
			? {
					instant,
					hidden: rtl ? "translateX(calc(-100% - 1rem))" : "translateX(calc(100% + 1rem))",
					shown: "translateX(0%)",
				}
			: { instant, hidden: "translateY(100%)", shown: "translateY(0%)" };

	return (
		<AnimatePresence initial={false} custom={custom}>
			{open && (
				<m.div
					key={place}
					custom={custom}
					variants={overlayMotion}
					initial="hidden"
					animate="shown"
					exit="hidden"
					className={
						place === "drawer"
							? "fixed end-2 top-(--editor-bar) bottom-2 z-40 flex w-[400px] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl bg-overlay p-3 shadow-overlay"
							: "fixed inset-0 z-40 flex flex-col bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
					}
				>
					{children}
				</m.div>
			)}
		</AnimatePresence>
	);
}

// The panel (AI SDK, Markdown) loads when the assistant first opens; hovering ✦ starts it early.
export const loadAssistantPanel = () => import("./assistant-panel");
const AssistantPanel = lazy(() => loadAssistantPanel().then((module) => ({ default: module.AssistantPanel })));

function Panel({ document }: { document: AssistantDocument }) {
	return (
		<Suspense
			fallback={
				// Hidden for the first 150ms, so a quick load never flashes a spinner.
				<div className="grid h-full flex-1 place-items-center transition-opacity delay-150 duration-standard ease-enter starting:opacity-0">
					<Spinner size="md" color="current" className="text-muted" aria-hidden />
				</div>
			}
		>
			<AssistantPanel document={document} onClose={closeAssistant} />
		</Suspense>
	);
}

/** Closing the panel hands focus back to the ✦ button in the bar, as closing any panel should. */
function closeAssistant() {
	useEditorStore.getState().setAssistantOpen(false);
	requestAnimationFrame(() => globalThis.document.querySelector<HTMLElement>("[data-assistant-toggle]")?.focus());
}

export function ResumeAssistant() {
	const document = useResumeAssistantDocument();
	return <Panel document={document} />;
}

export function LetterAssistant() {
	const document = useLetterAssistantDocument();
	if (!document) return null;
	return <Panel document={document} />;
}
