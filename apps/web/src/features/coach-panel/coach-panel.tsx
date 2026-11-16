import { Spinner } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { cn } from "@rezumi/utils/style";
import { useCoachPanelStore } from "./store";

// The coach (AI SDK, Markdown) loads when the panel first opens; hovering the navbar's Coach starts it early.
export const loadCoachPanel = () => import("@/features/career/coach");
const Coach = lazy(() => loadCoachPanel().then((module) => ({ default: module.Coach })));

type CoachPanelSlotProps = {
	/** Whether the panel shows; a hidden one stays mounted but out of reach of focus and screen readers. */
	visible: boolean;
	className?: string;
};

/**
 * The coach panel's content: mounted on first open and kept after closing, so a reply keeps streaming and the draft
 * stays while the panel is shut or the person moves between pages. Expand opens Coach full screen on the same
 * conversation.
 */
export function CoachPanelSlot({ visible, className }: CoachPanelSlotProps) {
	const navigate = useNavigate();
	const open = useCoachPanelStore((state) => state.open);
	const conversationId = useCoachPanelStore((state) => state.conversationId);
	const offerIds = useCoachPanelStore((state) => state.offerIds);
	const showConversation = useCoachPanelStore((state) => state.showConversation);
	const setOpen = useCoachPanelStore((state) => state.setOpen);
	const [opened, setOpened] = useState(open);
	if (open && !opened) setOpened(true);
	if (!opened) return null;

	return (
		<div inert={!visible} className={cn("flex h-full min-h-0 flex-col", className)}>
			<Suspense
				fallback={
					// Hidden for the first 150ms, so a quick load never flashes a spinner.
					<div className="grid h-full flex-1 place-items-center transition-opacity delay-150 duration-standard ease-enter starting:opacity-0">
						<Spinner size="md" color="current" className="text-muted" aria-hidden />
					</div>
				}
			>
				<Coach
					layout="panel"
					conversationId={conversationId}
					offerIds={offerIds}
					onConversationChange={(id, change) => showConversation(id, change?.offerIds)}
					onClose={() => {
						setOpen(false);
						focusCoachButton();
					}}
					onExpand={(id, offers) => {
						// The full page shows it now; Collapse there brings the panel back.
						setOpen(false);
						void navigate({
							to: "/dashboard/coach/{-$conversationId}",
							params: { conversationId: id },
							search: offers.length > 0 ? { offers } : {},
						});
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
