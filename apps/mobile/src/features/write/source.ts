// The entry forms pointed at the open resume (plans/mobile 02-teknis §18): the same components that edit the Profile
// read and write the resume's draft. The builder layout owns the draft; Write only reads it and sends edits.
import type { PageSettings, WriteSource } from "@/features/entries/source";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { resumeFieldFocus, useResumeStore } from "@/draft";

const select =
	<T>(read: (data: ResumeData) => T, fallback: T) =>
	(state: { data: ResumeData | null }) =>
		state.data ? read(state.data) : fallback;

function usePage(): PageSettings {
	const locale = useResumeStore(select((data) => data.metadata.page.locale, "en-US"));
	// A selector reading `undefined` would mean "no value"; the format falls back to null and back again.
	const dateFormat = useResumeStore(select((data) => data.metadata.page.dateFormat ?? null, null));
	return { locale, dateFormat: dateFormat ?? undefined };
}

export const resumeWriteSource: WriteSource = {
	kind: "resume",
	useData: (read, fallback) => useResumeStore(select(read, fallback)),
	getData: () => useResumeStore.getState().data,
	update: (recipe, options) => useResumeStore.getState().update(recipe, options),
	undo: () => useResumeStore.getState().undo(),
	useLocked: () => useResumeStore((state) => state.locked),
	usePage,
	// The draft holds back copies from the server while a field has focus, so typing is never overwritten.
	focus: resumeFieldFocus,
};
