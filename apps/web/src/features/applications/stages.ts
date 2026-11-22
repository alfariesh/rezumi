import type { ApplicationClosedReason, ApplicationStatus } from "@rezumi/schema/applications/data";
import { t } from "@lingui/core/macro";
import { STAGES } from "@rezumi/schema/applications/data";

export { CLOSED_REASONS, getNextStage, LIST_ORDER, PIPELINE } from "@rezumi/career/applications";

export const getStageLabel = (status: ApplicationStatus) =>
	({
		saved: t`Saved`,
		applied: t`Applied`,
		screening: t`Screening`,
		interview: t`Interview`,
		offer: t`Offer`,
		closed: t`Closed`,
	})[status];

export const getStageColor = (status: ApplicationStatus) =>
	STAGES.find((stage) => stage.value === status)?.color ?? "var(--muted)";

export const getClosedReasonLabel = (reason: ApplicationClosedReason) =>
	({
		accepted: t`Accepted offer`,
		"not-selected": t`Not selected`,
		withdrew: t`I withdrew`,
		"accepted-other": t`Accepted another offer`,
		"no-response": t`No response`,
	})[reason];
