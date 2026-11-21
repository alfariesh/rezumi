import type { RouterOutput } from "@/api/client";
// The app's draft documents. The engine (debounced save, undo/redo, the device copy and offline queue, the conflict
// check) is `@rezumi/resume/draft`; adapters.ts holds the API contracts and native.ts the device environment.
import type { DraftStore } from "@rezumi/resume/draft";

export type { ConflictChoice, DraftStore, SaveStatus, UpdateOptions } from "@rezumi/resume/draft";

export type ResumeDocument = RouterOutput["resume"]["getById"];
export type LetterDocument = RouterOutput["coverLetters"]["getById"];

export type ResumeDraftStore = DraftStore<ResumeDocument, ResumeDocument["data"]>;
/** A letter's editable fields (recipient, content, style…) sit on the document itself, so its data is the document. */
export type LetterDraftStore = DraftStore<LetterDocument, LetterDocument>;

/** Navigation metadata only; authored content remains owned by its draft store. */
export type PendingDocument = { type: "resume" | "letter"; id: string; name: string };
