import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { embedFromUrl, embedSharingHint, isNoRoomError, stillEmbeds } from "./embeds";

const mocks = vi.hoisted(() => ({ unfurl: vi.fn() }));
vi.mock("@/libs/orpc/client", () => ({
	client: { portfolio: { unfurl: (...args: unknown[]) => mocks.unfurl(...args) } },
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

const loom = "https://www.loom.com/share/0123456789abcdef0123456789abcdef";

beforeEach(() => {
	mocks.unfurl = vi.fn();
});

describe("Embed blocks from a pasted link", () => {
	it("take the title and picture the service gave", async () => {
		mocks.unfurl.mockResolvedValue({
			kind: "embed",
			url: loom,
			provider: "loom",
			ref: "0123456789abcdef0123456789abcdef",
			title: "Demo walkthrough",
			thumbnailUrl: "https://cdn.loom.com/thumb.jpg",
		});
		const find = await embedFromUrl(loom);
		expect(find?.block).toMatchObject({ type: "embed", provider: "loom", title: "Demo walkthrough" });
		expect(find?.thumbnailUrl).toBe("https://cdn.loom.com/thumb.jpg");
	});

	it("are still made from the link when the service couldn't be read", async () => {
		mocks.unfurl.mockRejectedValue(new ORPCError("PORTFOLIO_LINK_UNREADABLE", { message: "no" }));
		const find = await embedFromUrl(loom);
		expect(find?.block).toMatchObject({ type: "embed", provider: "loom", ref: "0123456789abcdef0123456789abcdef" });
		expect(find?.block.title).toBeUndefined();
		expect(find?.thumbnailUrl).toBeNull();
	});

	it("follow a short link the server resolved, and refuse what nothing embeds", async () => {
		mocks.unfurl.mockResolvedValueOnce({
			kind: "embed",
			url: "https://soundcloud.com/artist/track",
			provider: "soundcloud",
			ref: "artist/track",
		});
		expect((await embedFromUrl("https://on.soundcloud.com/abc"))?.block.ref).toBe("artist/track");
		mocks.unfurl.mockResolvedValueOnce({ kind: "link", url: "https://example.com", title: "Example" });
		expect(await embedFromUrl("https://example.com")).toBeNull();
	});

	it("pass a cancel on", async () => {
		const controller = new AbortController();
		mocks.unfurl.mockImplementation(() => {
			controller.abort();
			return Promise.reject(new DOMException("Aborted", "AbortError"));
		});
		await expect(embedFromUrl(loom, controller.signal)).rejects.toThrow();
	});
});

describe("Embed helpers", () => {
	it("tell whether a block still shows the same content", () => {
		const embed = { provider: "loom", ref: "a" } as const;
		expect(stillEmbeds({ type: "embed", provider: "loom", ref: "a" }, embed)).toBe(true);
		expect(stillEmbeds({ type: "embed", provider: "loom", ref: "b" }, embed)).toBe(false);
		expect(stillEmbeds({ type: "link" }, embed)).toBe(false);
		expect(stillEmbeds(undefined, embed)).toBe(false);
	});

	it("say what Google Slides and Figma need before they show", () => {
		expect(embedSharingHint("google-slides")).toMatch(/Anyone with the link/);
		expect(embedSharingHint("figma")).toMatch(/viewable/);
		expect(embedSharingHint("spotify")).toBeNull();
	});

	it("know a refusal for lack of room", () => {
		expect(isNoRoomError(new ORPCError("PORTFOLIO_STORAGE_FULL", { message: "" }))).toBe(true);
		expect(isNoRoomError(new ORPCError("PLAN_LIMIT_REACHED", { message: "" }))).toBe(true);
		expect(isNoRoomError(new ORPCError("PORTFOLIO_LINK_UNREADABLE", { message: "" }))).toBe(false);
	});
});
