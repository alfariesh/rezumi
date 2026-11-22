// Write's data operations live in @rezumi/resume/write, shared with the web. This file adds the app's store selectors.
import type { LayoutPage, ResumeData } from "@rezumi/schema/resume/data";

export * from "@rezumi/resume/write";
export { moveSectionItem as moveItem } from "@rezumi/resume/write";

/**
 * A store selector over the open resume's data. Zustand re-renders when the selected value changes by `Object.is`,
 * so `select` must return stored objects or primitives (never a fresh object) and `fallback` must be a constant.
 */
export const readData =
	<T>(select: (data: ResumeData) => T, fallback: T) =>
	(state: { data: ResumeData | null }) =>
		state.data ? select(state.data) : fallback;

export const NO_PAGES: readonly LayoutPage[] = [];
export const selectPages = (data: ResumeData): readonly LayoutPage[] => data.metadata.layout.pages;
