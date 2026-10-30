import type { ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { MessageScrollerItem } from "@rezumi/ui/components/message-scroller";
import { D2, EASE, EXIT } from "@/libs/motion";

type WaitingRowProps = {
	show: boolean;
	/** The line is already on screen from a pending first message: don't rise in a second time. */
	skipEnter?: boolean;
	children: ReactNode;
};

/**
 * A "working" line in the transcript. It rises in and fades out (collapsing as it goes), so the answer that replaces
 * it takes over without a blink.
 */
export function WaitingRow({ show, skipEnter = false, children }: WaitingRowProps) {
	return (
		<AnimatePresence initial={false}>
			{show && (
				<MessageScrollerItem key="waiting">
					<m.div
						initial={skipEnter ? false : { opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0, height: "auto", transition: { duration: D2, ease: EASE } }}
						exit={{ opacity: 0, height: 0, transition: { duration: D2 * EXIT, ease: EASE } }}
						className="overflow-hidden"
					>
						{children}
					</m.div>
				</MessageScrollerItem>
			)}
		</AnimatePresence>
	);
}
