import type { Sender } from "./router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createMessageRouter } from "./router";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const extensionOrigin = `chrome-extension://${extensionId}/`;

function setup() {
	const handlers = {
		page: vi.fn(async () => ({ button: true, floating: true, connected: false, saved: null, locale: "en" as const })),
		"open-panel": vi.fn(async () => ({ opened: true })),
		"hide-floating": vi.fn(async () => ({ ok: true as const })),
		saved: vi.fn(async () => ({ ok: true as const })),
		"follow-ups": vi.fn(async () => ({ ok: true as const })),
		status: vi.fn(async () => ({ state: "signed-out" as const, account: null, version: "0.1.0" })),
		connect: vi.fn(async () => ({ ok: false as const, code: "cancelled" })),
		disconnect: vi.fn(async () => ({ ok: true as const })),
		token: vi.fn(async () => ({ accessToken: "token" })),
		expire: vi.fn(async () => ({ ok: true as const })),
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
		expect(await route(page, contentSender)).toEqual({
			ok: true,
			data: { button: true, floating: true, connected: false, saved: null, locale: "en" },
		});
		expect(handlers.page).toHaveBeenCalledWith(page, 7);
	});

	it("answers the side panel's status message", async () => {
		const { route } = setup();
		expect(await route({ type: "status" }, panelSender)).toEqual({
			ok: true,
			data: { state: "signed-out", account: null, version: "0.1.0" },
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

	it("treats the panel opened in a tab as the panel", async () => {
		const { route } = setup();
		expect(await route({ type: "status" }, { ...panelSender, tab: tab(), frameId: 0 })).toMatchObject({ ok: true });
	});

	it("hands the panel's token request to its handler, and never a content script's", async () => {
		const { route, handlers } = setup();
		expect(await route({ type: "token", force: true }, panelSender)).toEqual({
			ok: true,
			data: { accessToken: "token" },
		});
		expect(handlers.token).toHaveBeenCalledWith({ type: "token", force: true });
		for (const type of ["token", "connect", "disconnect", "expire"])
			expect(await route({ type }, contentSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(handlers.token).toHaveBeenCalledOnce();
	});

	it("lets the on-page button open the panel for its own tab, and only the panel report a save", async () => {
		const { route, handlers } = setup();
		expect(await route({ type: "open-panel" }, contentSender)).toEqual({ ok: true, data: { opened: true } });
		expect(handlers["open-panel"]).toHaveBeenCalledWith({ type: "open-panel" }, 7);
		const saved = { type: "saved", key: "linkedin:4012345678", id: "app", status: "applied" };
		expect(await route(saved, contentSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(await route(saved, panelSender)).toEqual({ ok: true, data: { ok: true } });
		expect(await route({ ...saved, status: "hired" }, panelSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(await route({ type: "open-panel" }, panelSender)).toEqual({ ok: false, error: "invalid-message" });
		// Only the panel asks for the due follow-ups again (after setting or clearing a reminder).
		expect(await route({ type: "follow-ups" }, panelSender)).toEqual({ ok: true, data: { ok: true } });
		expect(await route({ type: "follow-ups" }, contentSender)).toEqual({ ok: false, error: "invalid-message" });
		expect(await route({ type: "hide-floating", site: "monster" }, contentSender)).toEqual({
			ok: false,
			error: "invalid-message",
		});
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
