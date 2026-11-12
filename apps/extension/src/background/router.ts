import type { ContentMessage, MessageResponse, MessageResults, PanelMessage } from "../shared/messages";
import { contentMessageSchema, panelMessageSchema } from "../shared/messages";

/** The parts of `chrome.runtime.MessageSender` the router trusts. */
export type Sender = Pick<chrome.runtime.MessageSender, "id" | "tab" | "frameId" | "url">;

type Handlers = {
	[K in ContentMessage["type"]]: (
		message: Extract<ContentMessage, { type: K }>,
		tabId: number,
	) => Promise<MessageResults[K]>;
} & {
	[K in PanelMessage["type"]]: (message: Extract<PanelMessage, { type: K }>) => Promise<MessageResults[K]>;
};

type RouterOptions = {
	/** `chrome.runtime.id`. */
	extensionId: string;
	/** `chrome.runtime.getURL("")`: the extension's own pages start with it (chrome-extension://<id>/). */
	extensionOrigin: string;
	handlers: Handlers;
};

/**
 * Routes one runtime message. Only this extension may send: a content script from a tab's top frame sends content
 * messages, an extension page (the side panel) sends panel messages, and every message must match its schema. There is
 * no `externally_connectable`, so web pages cannot reach this at all; the checks guard against a confused part.
 */
export function createMessageRouter({ extensionId, extensionOrigin, handlers }: RouterOptions) {
	return async (message: unknown, sender: Sender): Promise<MessageResponse<unknown>> => {
		if (sender.id !== extensionId) return { ok: false, error: "invalid-sender" };
		const fromTab = sender.tab?.id !== undefined;
		const fromExtensionPage = !sender.tab && typeof sender.url === "string" && sender.url.startsWith(extensionOrigin);

		try {
			if (fromTab) {
				if (sender.frameId !== 0) return { ok: false, error: "invalid-sender" };
				const parsed = contentMessageSchema.safeParse(message);
				if (!parsed.success) return { ok: false, error: "invalid-message" };
				return { ok: true, data: await handlers[parsed.data.type](parsed.data, sender.tab?.id ?? -1) };
			}
			if (fromExtensionPage) {
				const parsed = panelMessageSchema.safeParse(message);
				if (!parsed.success) return { ok: false, error: "invalid-message" };
				return { ok: true, data: await handlers[parsed.data.type](parsed.data) };
			}
		} catch (error) {
			console.error("Rezumi extension message failed", error);
			return { ok: false, error: "failed" };
		}
		return { ok: false, error: "invalid-sender" };
	};
}
