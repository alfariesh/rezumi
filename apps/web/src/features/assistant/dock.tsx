import type { AssistantDocument } from "./document";
import { Spinner } from "@heroui/react";
import { lazy, Suspense } from "react";
import { useLetterAssistantDocument, useResumeAssistantDocument } from "./document";
import { useEditorStore } from "@/features/resume/editor/store";

// The assistant shows in the editor's panel (AI in its rail), in place of the mode, on every screen: the panel card
// beside the page, the tablet drawer, or the phone's sheet.

// The panel (AI SDK, Markdown) loads when the assistant first opens; hovering AI in the rail starts it early.
export const loadAssistantPanel = () => import("./assistant-panel");
const AssistantPanel = lazy(() => loadAssistantPanel().then((module) => ({ default: module.AssistantPanel })));

type AssistantDockProps = { document: AssistantDocument };

/** The panel for one document, loading on first open. The portfolio editor mounts it with its own document. */
export function AssistantDock({ document }: AssistantDockProps) {
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

/** Closing the assistant puts the mode back in the panel and focus on the rail's selected item. */
function closeAssistant() {
	useEditorStore.getState().setAssistantOpen(false);
	requestAnimationFrame(() =>
		globalThis.document.querySelector<HTMLElement>("[data-mode-switch] [aria-selected='true']")?.focus(),
	);
}

export function ResumeAssistant() {
	const document = useResumeAssistantDocument();
	return <AssistantDock document={document} />;
}

export function LetterAssistant() {
	const document = useLetterAssistantDocument();
	if (!document) return null;
	return <AssistantDock document={document} />;
}
