// The workspace's words that more than one part uses: the parts' names, and the moving label of a 10–30 second AI
// wait (Jobs' "Your fit" uses it too).
import type { GenerateTask, SavedItemKind, WorkspaceTab } from "@rezumi/schema/career";
import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";

export const partLabel = (tab: WorkspaceTab) =>
	({
		fit: t({ message: "Fit", context: "Application workspace tab: how well a job fits your experience" }),
		apply: t`Apply`,
		prepare: t`Prepare`,
		practise: t({ message: "Practice", context: "Application workspace tab: rehearse interview answers" }),
		debrief: t`Debrief`,
		messages: t`Messages`,
		saved: t({ message: "Saved", context: "Application workspace tab: earlier results kept for this job" }),
	})[tab];

export const savedKindLabel = (kind: SavedItemKind) =>
	({
		fit: t({ message: "Fit", context: "Application workspace tab: how well a job fits your experience" }),
		briefing: t`Briefing`,
		practice: t`Practice`,
		debrief: t`Debrief`,
		answers: t`Answers`,
		reply: t`Reply`,
		offer: t`Offer`,
	})[kind];

/** What each piece of work goes through, in order, before the general phrases take over. */
export const workingSteps = (task: GenerateTask["task"] | "tighten") =>
	({
		fit: [t`Reading the posting`, t`Matching your facts`, t`Weighing each requirement`, t`Checking your preferences`],
		briefing: [t`Reading the posting`, t`Picking your stories`, t`Timing the plan`, t`Drafting questions`],
		practice: [t`Reading your answer`, t`Finding what works`, t`Sharpening the opening`],
		debrief: [t`Reading your notes`, t`Checking against your Profile`, t`Planning your week`],
		reply: [t`Reading the message`, t`Spotting what changed`, t`Drafting a reply`],
		answer: [t`Reading the question`, t`Drafting`],
		tighten: [t`Tightening`, t`Trimming words`],
	})[task];

/**
 * A 10–30 second wait reads as progress: the label moves through the work's steps every 2.2 seconds, then loops
 * through general phrases. Returns `idle` until `busy`.
 */
export function useWorking(busy: boolean, steps: string[], idle: string) {
	const [state, setState] = useState({ busy, tick: 0 });
	if (state.busy !== busy) setState({ busy, tick: 0 });
	useEffect(() => {
		if (!busy) return;
		const id = setInterval(() => setState((current) => ({ ...current, tick: current.tick + 1 })), 2200);
		return () => clearInterval(id);
	}, [busy]);
	const tick = state.tick;
	if (!busy) return idle;
	const general = [t`Thinking`, t`Cooking`, t`Connecting the dots`, t`Double-checking`, t`Polishing`];
	const phrase = tick < steps.length ? steps[tick] : general[(tick - steps.length) % general.length];
	return `${phrase ?? ""}…`;
}
