// The Board's state: the columns (each card at its pending stage while a move saves), and moving a card. Every move
// runs at once with an Undo toast; Closed asks for the reason first (as on the web).
import type { ApplicationSummary } from "@/features/applications/types";
import type { PendingMove } from "@rezumi/career/applications";
import type { ApplicationClosedReason, ApplicationStatus } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { boardColumns, keepPending, pendingAfterError } from "@rezumi/career/applications";
import { applicationError } from "@/features/applications/error";
import { useApplicationMutations, useApplications } from "@/features/applications/queries";
import { getStageLabel } from "@/features/applications/stages";
import { showToast } from "@/ui";

export function useBoard() {
	const { t } = useLingui();
	const query = useApplications();
	const { update } = useApplicationMutations();
	const [pending, setPending] = useState<PendingMove | null>(null);
	const [closing, setClosing] = useState<ApplicationSummary | null>(null);
	const applications = query.data ?? [];
	// The list publishes the optimistic move after an await; until then the card shows in its new column from here.
	if (pending && !keepPending(pending, applications)) setPending(null);
	const columns = boardColumns(applications, pending);
	const stageOf = (application: ApplicationSummary) =>
		pending?.id === application.id ? pending.to : application.status;

	const commit = (application: ApplicationSummary, to: ApplicationStatus, closedReason?: ApplicationClosedReason) => {
		const from = stageOf(application);
		const previousReason = application.closedReason;
		setPending({ id: application.id, from: application.status, to });
		update.mutate(
			{ id: application.id, status: to, ...(closedReason ? { closedReason } : {}) },
			{
				onSuccess: () =>
					showToast({
						title: to === "closed" ? t`Application closed` : t`Moved to ${getStageLabel(to)}`,
						undo: {
							label: t`Undo`,
							onUndo: () =>
								update.mutate({
									id: application.id,
									status: from,
									...(from === "closed" && previousReason ? { closedReason: previousReason } : {}),
								}),
						},
					}),
				onError: (error) => {
					setPending((current) => pendingAfterError(current, application.id, to));
					showToast({ title: applicationError(error), variant: "danger" });
				},
			},
		);
	};

	return {
		query,
		columns,
		stageOf,
		/** Moves the card; Closed opens the reason picker instead. */
		moveTo: (application: ApplicationSummary, to: ApplicationStatus) => {
			if (to === stageOf(application)) return;
			if (to === "closed") return setClosing(application);
			commit(application, to);
		},
		closing,
		cancelClose: () => setClosing(null),
		close: (reason: ApplicationClosedReason) => {
			if (closing) commit(closing, "closed", reason);
			setClosing(null);
		},
	};
}

export type Board = ReturnType<typeof useBoard>;
