import type { Account, AuthState } from "./storage";
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

/** Side panel → service worker: whether the extension is connected to a Rezumi account, and which. */
const statusMessageSchema = z.object({ type: z.literal("status") });
/** Side panel → service worker: sign in (opens Rezumi's sign-in window). */
const connectMessageSchema = z.object({ type: z.literal("connect") });
/** Side panel → service worker: sign out, revoking the refresh token. */
const disconnectMessageSchema = z.object({ type: z.literal("disconnect") });
/** Side panel → service worker: an access token for an API call; `force` after the server answered 401 to it. */
const tokenMessageSchema = z.object({ type: z.literal("token"), force: z.boolean().optional() });
/** Side panel → service worker: the server refused the connection even with a fresh token. */
const expireMessageSchema = z.object({ type: z.literal("expire") });

export const contentMessageSchema = z.discriminatedUnion("type", [pageMessageSchema]);
export const panelMessageSchema = z.discriminatedUnion("type", [
	statusMessageSchema,
	connectMessageSchema,
	disconnectMessageSchema,
	tokenMessageSchema,
	expireMessageSchema,
]);

export type PageMessage = z.infer<typeof pageMessageSchema>;
export type ContentMessage = z.infer<typeof contentMessageSchema>;
export type PanelMessage = z.infer<typeof panelMessageSchema>;

type StatusResult = {
	state: AuthState;
	/** Who is connected, from the sign-in (empty strings when the server sent no name or email). */
	account: Account | null;
	version: string;
};

export type MessageResults = {
	page: { ok: true };
	status: StatusResult;
	/** `code` says why connecting failed: `cancelled` (window closed), `network`, or an OAuth error code. */
	connect: { ok: true; account: Account } | { ok: false; code: string };
	disconnect: { ok: true };
	/** Null when not connected (or no longer); `offline` when a needed refresh could not reach the server. */
	token: { accessToken: string | null; offline?: boolean };
	expire: { ok: true };
};

type MessageError = "invalid-sender" | "invalid-message" | "failed";

/** What the service worker answers: the handler's result, or why the message was refused. */
export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: MessageError };
