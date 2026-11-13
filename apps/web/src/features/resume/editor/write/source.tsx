import type { IconStyle, ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import type { ReactNode } from "react";
import type { StoreApi } from "zustand";
import { useParams } from "@tanstack/react-router";
import { createContext, use, useMemo } from "react";
import { useStore } from "zustand/react";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { resumeStoreApi, useUpdateResumeData } from "@/features/resume/builder/draft";

export type WriteUpdateOptions = {
	/** Consecutive edits to the same field fold into one undo step. */
	coalesceKey?: string;
	/** Always a step of its own (adding, moving, deleting). */
	newStep?: boolean;
	/** Folds into the current step whenever the previous edit had the same key. */
	sameStep?: boolean;
};

export type WriteUpdate = (fn: (draft: WritableDraft<ResumeData>) => void, options?: WriteUpdateOptions) => void;

/**
 * Where the Write panel's forms read and write. The same fields edit the open resume or the account's Profile, which
 * is shown to them as resume data (`resumeDataFromProfile`). `kind` tells the forms which controls make sense: the
 * Profile holds content only, so what belongs to a document (hiding, section titles and layout, the photo's frame,
 * custom sections) isn't offered on it.
 */
export type WriteSource = {
	kind: "resume" | "profile";
	/** The store the data lives in; `read` finds the data in its state. */
	store: StoreApi<unknown>;
	/** The data in a state of `store`, or undefined while there is none (or it belongs to another resume). */
	read: (state: unknown) => ResumeData | undefined;
	update: WriteUpdate;
	undo: () => void;
};

const WriteSourceContext = createContext<WriteSource | null>(null);

type WriteSourceProviderProps = { source: WriteSource; children: ReactNode };

export function WriteSourceProvider({ source, children }: WriteSourceProviderProps) {
	return <WriteSourceContext value={source}>{children}</WriteSourceContext>;
}

export function useWriteSource(): WriteSource {
	const source = use(WriteSourceContext);
	if (!source) throw new Error("Write fields must be rendered inside a WriteSourceProvider.");
	return source;
}

/** The data as it is now, for actions that read it once (a menu opening, a click). */
export function readWriteData(source: WriteSource): ResumeData | undefined {
	return source.read(source.store.getState());
}

/**
 * Selects from the data, re-rendering only when the selected value changes. A selector that can produce `undefined`
 * needs a fallback (`?? null`): undefined means the data isn't there yet.
 */
export function useWriteSelector<T>(selector: (data: ResumeData) => T): T {
	const source = useWriteSource();
	const selected = useStore(source.store, (state) => {
		const data = source.read(state);
		return data === undefined ? undefined : selector(data);
	});
	if (selected === undefined) throw new Error("Write data is required before rendering this component.");
	return selected;
}

export function useWriteUpdate(): WriteUpdate {
	return useWriteSource().update;
}

/** The icon style icon pickers draw with: the resume's own, or the standard one for the Profile. */
export function useWriteIconStyle(): IconStyle {
	return useWriteSelector((data) => iconDesignOf(data.metadata.design).style);
}

type ResumeWriteSourceProps = { children: ReactNode };

/** The builder's source: the resume in the address, through the resume store and its autosave. */
export function ResumeWriteSource({ children }: ResumeWriteSourceProps) {
	const params = useParams({ strict: false }) as { resumeId?: string };
	const resumeId = params.resumeId;
	const update = useUpdateResumeData();

	const source = useMemo<WriteSource>(
		() => ({
			kind: "resume",
			store: resumeStoreApi as StoreApi<unknown>,
			read: (state) => {
				const resume = (state as ReturnType<typeof resumeStoreApi.getState>).resume;
				return resumeId && resume?.id === resumeId ? resume.data : undefined;
			},
			update,
			undo: () => resumeStoreApi.getState().undo(),
		}),
		[resumeId, update],
	);

	return <WriteSourceProvider source={source}>{children}</WriteSourceProvider>;
}
