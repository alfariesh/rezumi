import type { CheckIssue } from "./messages";
import type { AtsReport } from "@rezumi/resume/ats";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react";
import { useDeferredValue, useMemo } from "react";
import { runCheck } from "@rezumi/resume/check";
import { describeIssues } from "./messages";
import { useResumeStore } from "@/draft";

export type CheckResult = { data: ResumeData; report: AtsReport; issues: CheckIssue[] };

/** The resume in the builder, when it's this one: Check reads the layout's draft and never owns it. */
export function useCheckDraft(id: string) {
	const data = useResumeStore((state) => (state.document?.id === id ? state.data : null));
	const status = useResumeStore((state) => state.status);
	const locked = useResumeStore((state) => state.locked);
	const applicationId = useResumeStore((state) =>
		state.document?.id === id ? (state.document.applicationId ?? null) : null,
	);
	return { data, status, locked, applicationId };
}

/** The live checks on the resume as it is now (deferred, so typing stays smooth), with worded, numbered issues. */
export function useCheck(data: ResumeData | null): CheckResult | null {
	const deferred = useDeferredValue(data);
	// Subscribes to the locale, so the cards are worded again when it changes.
	const { i18n } = useLingui();
	const locale = i18n.locale;
	const checked = useMemo(() => (deferred ? runCheck(deferred) : null), [deferred]);
	// `describeIssues` words the cards from the global catalog, so the locale is what makes them stale.
	return useMemo(
		() =>
			deferred && checked
				? { data: deferred, report: checked.report, issues: describeIssues(checked.issues, deferred) }
				: null,
		// oxlint-disable-next-line react/exhaustive-deps -- the locale isn't read here but changes the wording.
		[deferred, checked, locale],
	);
}
