import { Spinner } from "@heroui/react";
import { lazy, Suspense, useState } from "react";
import { useCoachPanelStore } from "./store";

// The coach (AI SDK, Markdown) loads when the panel first opens; hovering the navbar's Coach starts it early.
export const loadCoachPanel = () => import("@/features/career/coach");
const CoachPanel = lazy(() => loadCoachPanel().then((module) => ({ default: module.CoachPanel })));

type CoachPanelSlotProps = {
	/** Whether the panel shows; a hidden one stays mounted but out of reach of focus and screen readers. */
	visible: boolean;
};

/**
 * The coach panel's content: mounted on first open and kept after closing, so a reply keeps streaming and the draft
 * stays while the panel is shut or the person moves between pages.
 */
export function CoachPanelSlot({ visible }: CoachPanelSlotProps) {
	const open = useCoachPanelStore((state) => state.open);
	const conversationId = useCoachPanelStore((state) => state.conversationId);
	const offerIds = useCoachPanelStore((state) => state.offerIds);
	const showConversation = useCoachPanelStore((state) => state.showConversation);
	const setOpen = useCoachPanelStore((state) => state.setOpen);
	const [opened, setOpened] = useState(open);
	if (open && !opened) setOpened(true);
	if (!opened) return null;

	return (
		<div inert={!visible} className="flex h-full min-h-0 flex-col">
			<Suspense
				fallback={
					// Hidden for the first 150ms, so a quick load never flashes a spinner.
					<div className="grid h-full flex-1 place-items-center transition-opacity delay-150 duration-standard ease-enter starting:opacity-0">
						<Spinner size="md" color="current" className="text-muted" aria-hidden />
					</div>
				}
			>
				<CoachPanel
					conversationId={conversationId}
					offerIds={offerIds}
					onConversationChange={showConversation}
					onClose={() => {
						setOpen(false);
						focusCoachButton();
					}}
				/>
			</Suspense>
		</div>
	);
}

/** Closing the panel puts focus back on the navbar's Coach (the one shown at this width). */
function focusCoachButton() {
	requestAnimationFrame(() => {
		const buttons = document.querySelectorAll<HTMLElement>("[data-coach-button]");
		[...buttons].find((button) => button.offsetParent !== null)?.focus();
	});
}
