import { z } from "zod";
import { JOB_SITES } from "@rezumi/job-sites/sites";

/**
 * Messages between the extension's parts (02-teknis.md §8). The service worker validates every one with these schemas;
 * the content script only imports the types, so Zod never ships in it.
 */

/** Content script → service worker: the page the tab shows now, and the posting it has open (null key for none). */
const pageMessageSchema = z.object({
	type: z.literal("page"),
	url: z.url({ protocol: /^https?$/ }).max(4_000),
	site: z.enum(JOB_SITES).nullable(),
	key: z.string().min(1).max(500).nullable(),
});

/** Side panel → service worker: whether the extension is connected to a Rezumi account. */
const statusMessageSchema = z.object({ type: z.literal("status") });

export const contentMessageSchema = z.discriminatedUnion("type", [pageMessageSchema]);
export const panelMessageSchema = z.discriminatedUnion("type", [statusMessageSchema]);

export type PageMessage = z.infer<typeof pageMessageSchema>;
export type ContentMessage = z.infer<typeof contentMessageSchema>;
export type PanelMessage = z.infer<typeof panelMessageSchema>;

type StatusResult = {
	/** Phase 02 connects accounts; until then the panel always shows "Connect to Rezumi". */
	connected: boolean;
	version: string;
};

export type MessageResults = {
	page: { ok: true };
	status: StatusResult;
};

type MessageError = "invalid-sender" | "invalid-message" | "failed";

/** What the service worker answers: the handler's result, or why the message was refused. */
export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: MessageError };
