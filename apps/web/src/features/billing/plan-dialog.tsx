import type { PlanProblem } from "./plan";
import { AlertDialog, Button, buttonVariants } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { create } from "zustand/react";
import { describePlanProblem, getPlanProblem } from "./plan";

// The problem stays after closing, so the dialog keeps its words while it fades out.
type PlanDialogState = { problem: PlanProblem | null; isOpen: boolean };

const usePlanDialogStore = create<PlanDialogState>(() => ({ problem: null, isOpen: false }));

/** Explains a plan limit or a feature the plan doesn't include, with the free way on and a link to plans. */
export function openPlanDialog(problem: PlanProblem) {
	usePlanDialogStore.setState({ problem, isOpen: true });
}

/** Opens the plan dialog when `error` is a plan refusal from the server; returns whether it did. */
export function openPlanDialogForError(error: unknown) {
	const problem = getPlanProblem(error);
	if (problem) openPlanDialog(problem);
	return problem !== null;
}

const close = () => usePlanDialogStore.setState({ isOpen: false });

/** Mounted once at the root; any page opens it through `openPlanDialog`, or a failed mutation does. */
export function PlanDialog() {
	const problem = usePlanDialogStore((state) => state.problem);
	const isOpen = usePlanDialogStore((state) => state.isOpen);
	const copy = problem ? describePlanProblem(problem) : null;

	return (
		<AlertDialog.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && close()} isKeyboardDismissDisabled={false}>
			<AlertDialog.Container size="sm">
				<AlertDialog.Dialog>
					<AlertDialog.Header>
						<AlertDialog.Heading>{copy?.title}</AlertDialog.Heading>
					</AlertDialog.Header>
					<AlertDialog.Body>
						<p>{copy?.description}</p>
					</AlertDialog.Body>
					<AlertDialog.Footer>
						<Button slot="close" variant="tertiary">
							<Trans>Close</Trans>
						</Button>
						{/* Plus covers every limit and feature a plan refuses. */}
						<Link
							to="/dashboard/settings/billing"
							search={{ plan: "plus" }}
							className={buttonVariants()}
							onClick={close}
						>
							<Trans>See plans</Trans>
						</Link>
					</AlertDialog.Footer>
				</AlertDialog.Dialog>
			</AlertDialog.Container>
		</AlertDialog.Backdrop>
	);
}
