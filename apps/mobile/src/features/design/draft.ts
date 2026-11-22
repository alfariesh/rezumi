import type { ResumeDraftStore } from "@/draft/types";
import type { Template } from "@rezumi/schema/templates";
import { t } from "@lingui/core/macro";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { templateName } from "@rezumi/resume/design-presets";
import { readOnlyDraft, writeTo } from "./write";
import { useResumeStore } from "@/draft";
import { isLockedTemplate, showPlanAlert, usePlan } from "@/features/billing/plan";
import { showToast } from "@/ui";

/** The builder layout owns the draft; Design only subscribes. */
export function useDesignDraft(id: string) {
	const draft = useResumeStore();
	return draft.document?.id === id ? draft : { ...draft, document: null, data: null };
}

export const designWrite = writeTo((recipe, options) => useResumeStore.getState().update(recipe, options));

/** The template held down in Design, shown on whichever page is visible (the phone half or the tablet page). */
const usePreviewStore = create<{ template: Template | null }>(() => ({ template: null }));

export const usePreviewTemplate = () => usePreviewStore((state) => state.template);
export const setPreviewTemplate = (template: Template | null) => usePreviewStore.setState({ template });

/** Clears the preview when the screen that set it (the template gallery) unmounts, so no page keeps showing it. */
export function useClearPreviewOnLeave() {
	useEffect(() => () => setPreviewTemplate(null), []);
}

/**
 * Runs `change` (one discrete edit, its own undo step) and returns an Undo for that step alone, or null when the draft
 * refused it (locked, resolving a conflict) or nothing changed. The Undo does nothing once another edit, an undo or a
 * newer server copy replaced the result, so a late tap on an old toast never reverts a newer step.
 */
export function stepWithUndo(change: () => void): (() => void) | null {
	const before = useResumeStore.getState().data;
	change();
	const after = useResumeStore.getState().data;
	if (!after || after === before) return null;
	return () => {
		const state = useResumeStore.getState();
		if (state.data === after) state.undo();
	};
}

/** Shows `title` with an Undo for the step `change` makes; no toast when the draft refused the change. */
export function changeWithUndoToast(change: () => void, title: () => string) {
	const undo = stepWithUndo(change);
	if (undo) showToast({ title: title(), undo: { label: t`Undo`, onUndo: undo } });
}

/** Applies a template as its own undo step, with a toast offering Undo. Use `useApplyTemplate` from screens. */
export function applyTemplate(template: Template) {
	setPreviewTemplate(null);
	const { data, update } = useResumeStore.getState();
	if (!data || data.metadata.template === template) return;
	changeWithUndoToast(
		() =>
			update(
				(value) => {
					value.metadata.template = template;
				},
				{ newStep: true },
			),
		() => t`Template changed to ${templateName(template)}`,
	);
}

/**
 * Applies a template the plan opens, else explains the plan instead (no price, no buy link: K6). The gallery's Apply
 * and the "Previewing X · tap to apply" caption both go through it.
 */
export function useApplyTemplate() {
	const plan = usePlan();
	return (template: Template) => {
		const current = useResumeStore.getState().data?.metadata.template;
		if (template !== current && isLockedTemplate(plan, template))
			return showPlanAlert({ kind: "feature", feature: "premiumTemplates" });
		applyTemplate(template);
	};
}

type PageDraft = Pick<ResumeDraftStore, "data" | "update" | "locked" | "undo">;

/** What a page renders: the draft with the held template swapped in, read-only while it shows (no Fit, no Undo). */
export function usePreviewedDraft<T extends PageDraft>(draft: T): T {
	const template = usePreviewTemplate();
	const { data } = draft;
	const previewed = useMemo(
		() => (data && template ? { ...data, metadata: { ...data.metadata, template } } : data),
		[data, template],
	);
	return template ? { ...readOnlyDraft(draft), data: previewed, locked: true } : draft;
}
