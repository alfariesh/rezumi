// Stage and closed-reason names in the app's words. The stage order and rules live in `@rezumi/career/applications`;
// stage colors come from `StageDot`/`StageLabel` in `@/ui`.
import type { ApplicationClosedReason, ApplicationStatus, InterviewKind } from "@rezumi/schema/applications/data";
import { t } from "@lingui/core/macro";

export const getStageLabel = (status: ApplicationStatus) =>
	({
		saved: t`Saved`,
		applied: t`Applied`,
		screening: t`Screening`,
		interview: t`Interview`,
		offer: t`Offer`,
		closed: t`Closed`,
	})[status];

export const getClosedReasonLabel = (reason: ApplicationClosedReason) =>
	({
		accepted: t`Accepted offer`,
		"not-selected": t`Not selected`,
		withdrew: t`I withdrew`,
		"accepted-other": t`Accepted another offer`,
		"no-response": t`No response`,
	})[reason];

export const getInterviewKindLabel = (kind: InterviewKind) =>
	({
		screening: t`Screening`,
		technical: t`Technical`,
		behavioral: t`Behavioral`,
		onsite: t`Onsite`,
		other: t`Other`,
	})[kind];
