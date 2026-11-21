import type { UpdateOptions } from "@/draft";
import type { ResumeData } from "@rezumi/schema/resume/data";
// What the entry forms edit (plans/mobile Phase 06): the Profile now, a resume's draft in Phase 07. The forms read and
// write resume-shaped data through this source and never import a store, as on the web (`write/source.tsx`).
import type { DateFormat } from "@rezumi/schema/resume/dates";
import type { WritableDraft } from "immer";
import type { ReactNode } from "react";
import { createContext, use } from "react";

/** The page's language and date format: how dates are read and shown. */
export type PageSettings = { locale: string; dateFormat?: DateFormat | undefined };

export type WriteSource = {
	kind: "resume" | "profile";
	/** Reads from the data; return stable values (sub-objects or primitives). Re-renders when the value changes. */
	useData: <T>(select: (data: ResumeData) => T, fallback: T) => T;
	/** The data right now, outside rendering. */
	getData: () => ResumeData | null;
	update: (recipe: (draft: WritableDraft<ResumeData>) => void, options?: UpdateOptions) => void;
	undo: () => void;
	/** Read-only (a locked resume). */
	useLocked: () => boolean;
	usePage: () => PageSettings;
	/** Field focus, so a draft doesn't take remote changes into a field being typed in. */
	focus: { onFocus: () => void; onBlur: () => void };
};

const SourceContext = createContext<WriteSource | null>(null);

type WriteSourceProviderProps = { source: WriteSource; children: ReactNode };

export function WriteSourceProvider({ source, children }: WriteSourceProviderProps) {
	return <SourceContext value={source}>{children}</SourceContext>;
}

export function useWriteSource(): WriteSource {
	const source = use(SourceContext);
	if (!source) throw new Error("Entry forms need a WriteSourceProvider");
	return source;
}

/** Reads from the source's data. */
export function useWriteData<T>(select: (data: ResumeData) => T, fallback: T): T {
	return useWriteSource().useData(select, fallback);
}
