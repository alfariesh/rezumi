import type { Account, AuthState } from "./storage";
import { z } from "zod";
import { capturedFieldsSchema, capturedPostingSchema } from "@rezumi/job-sites/capture";
import { JOB_SITES } from "@rezumi/job-sites/sites";
import { APPLICATION_STATUSES } from "@rezumi/schema/applications/data";

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

/** Content script → service worker: the person pressed the on-page button; open the side panel for this tab. */
const openPanelMessageSchema = z.object({ type: z.literal("open-panel") });
/** Content script → service worker: the person closed the floating button on this board. */
const hideFloatingMessageSchema = z.object({ type: z.literal("hide-floating"), site: z.enum(JOB_SITES) });

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
/**
 * Side panel → service worker: an application for this posting key was saved or its status changed, so the marks
 * update at once (the full list is fetched again right after). A null key only asks for that fetch.
 */
const savedMessageSchema = z.object({
	type: z.literal("saved"),
	key: z.string().min(1).max(500).nullable(),
	id: z.string().min(1).max(100),
	status: z.enum(APPLICATION_STATUSES),
});

/**
 * Side panel → service worker: a follow-up was set, changed or done, so the due list behind the badge and the desktop
 * reminders is fetched again now rather than at the next hourly alarm.
 */
const followUpsMessageSchema = z.object({ type: z.literal("follow-ups") });

export const contentMessageSchema = z.discriminatedUnion("type", [
	pageMessageSchema,
	openPanelMessageSchema,
	hideFloatingMessageSchema,
]);
export const panelMessageSchema = z.discriminatedUnion("type", [
	statusMessageSchema,
	connectMessageSchema,
	disconnectMessageSchema,
	tokenMessageSchema,
	expireMessageSchema,
	savedMessageSchema,
	followUpsMessageSchema,
]);

export type PageMessage = z.infer<typeof pageMessageSchema>;
export type OpenPanelMessage = z.infer<typeof openPanelMessageSchema>;
export type HideFloatingMessage = z.infer<typeof hideFloatingMessageSchema>;

/**
 * What the on-page button shows for a tab's posting (01-desain.md §4), worked out by the service worker from the local
 * saved keys and settings. Sent as the answer to `page` and again whenever it changes (`PageStateUpdate`).
 */
export type PageState = {
	/** Show the button at all: a posting is open on a board and the setting is on. */
	button: boolean;
	/** Float it in the corner when the board's usual spot is missing (off once the person closed it on this board). */
	floating: boolean;
	connected: boolean;
	/** The application already saved for this posting, if any. */
	saved: { id: string; status: string } | null;
	locale: "en" | "id";
};

/** Service worker → a tab's content script: the button's state changed (saved, status, setting, sign-in). */
export type PageStateUpdate = { type: "state"; key: string | null; state: PageState };

/** Side panel → the tab's content script: read the open page now (the person opened the panel or asked). */
export type ReadRequest = { type: "read" };

/**
 * The content script's answer to `read` (src/content/read.ts `PageReading`). The page is untrusted, so the panel
 * checks it against the same bounds the server applies before showing or sending any of it.
 */
export const pageReadingSchema = capturedPostingSchema.extend({
	key: z.string().min(1).max(500).nullable(),
	textSource: z.enum(["site", "page"]),
	fields: capturedFieldsSchema,
});
export type ContentMessage = z.infer<typeof contentMessageSchema>;
export type PanelMessage = z.infer<typeof panelMessageSchema>;

type StatusResult = {
	state: AuthState;
	/** Who is connected, from the sign-in (empty strings when the server sent no name or email). */
	account: Account | null;
	version: string;
};

export type MessageResults = {
	page: PageState;
	/** `opened: false` when the browser refused to open the panel from the page (no user gesture reached it). */
	"open-panel": { opened: boolean };
	"hide-floating": { ok: true };
	saved: { ok: true };
	"follow-ups": { ok: true };
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
