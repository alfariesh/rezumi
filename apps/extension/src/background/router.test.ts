import type { Sender } from "./router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createMessageRouter } from "./router";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionOrigin = `chrome-extension://${extensionId}/`;

function setup() {
	const handlers = {
		page: vi.fn(async () => ({ ok: true as const })),
		status: vi.fn(async () => ({ connected: false, version: "0.1.0" })),
	};
	return { handlers, route: createMessageRouter({ extensionId, extensionOrigin, handlers }) };
}

const tab = (id = 7) => ({ id }) as chrome.tabs.Tab;
const contentSender: Sender = {
	id: extensionId,
	tab: tab(),
	frameId: 0,
	url: "https://www.linkedin.com/jobs/view/4012345678/",
};
const panelSender: Sender = { id: extensionId, url: `${extensionOrigin}sidepanel.html` };
const page = {
	type: "page",
	url: "https://www.linkedin.com/jobs/view/4012345678/",
	site: "linkedin",
	key: "linkedin:4012345678",
};

describe("createMessageRouter", () => {
	it("hands a content script's page message to its handler with the tab id", async () => {
		const { route, handlers } = setup();
		expect(await route(page, contentSender)).toEqual({ ok: true, data: { ok: true } });
		expect(handlers.page).toHaveBeenCalledWith(page, 7);
	});

	it("answers the side panel's status message", async () => {
		const { route } = setup();
		expect(await route({ type: "status" }, panelSender)).toEqual({
			ok: true,
			data: { connected: false, version: "0.1.0" },
		});
	});

	it.each<[string, Sender]>([
		["another extension", { ...contentSender, id: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" }],
		["a sender without an id", { tab: tab(), frameId: 0 }],
		["a frame inside the page", { ...contentSender, frameId: 3 }],
		["a page that is neither a tab nor the extension", { id: extensionId, url: "https://evil.example/" }],
	])("refuses %s", async (_, sender) => {
		const { route, handlers } = setup();
		expect(await route(page, sender)).toEqual({ ok: false, error: "invalid-sender" });
		expect(handlers.page).not.toHaveBeenCalled();
	});

	it("keeps each part to its own messages", async () => {
		const { route, handlers } = setup();
		expect(await route({ type: "status" }, contentSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(await route(page, panelSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(handlers.status).not.toHaveBeenCalled();
		expect(handlers.page).not.toHaveBeenCalled();
	});

	it.each([
		["an unknown type", { type: "steal-token" }],
		["a non-web address", { ...page, url: "javascript:alert(1)" }],
		["an unknown site", { ...page, site: "monster" }],
		["a missing key", { ...page, key: undefined }],
		["not an object", "page"],
	])("refuses %s", async (_, message) => {
		const { route } = setup();
		expect(await route(message, contentSender)).toEqual({ ok: false, error: "invalid-message" });
	});

	it("reports a failing handler without throwing", async () => {
		const { route, handlers } = setup();
		handlers.page.mockRejectedValueOnce(new Error("storage full"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await route(page, contentSender)).toEqual({ ok: false, error: "failed" });
	});
});
