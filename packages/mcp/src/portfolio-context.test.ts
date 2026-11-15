// oxlint-disable typescript/no-non-null-assertion -- These tests look up callbacks they just registered.
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/server";
import { PORTFOLIO_EDIT_GUIDE } from "@rezumi/portfolio/edits";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";

type Callback = (...args: unknown[]) => Promise<unknown> | unknown;

function fakeServer() {
	const prompts = new Map<string, Callback>();
	const resources = new Map<string, Callback>();
	return {
		prompts,
		resources,
		server: {
			registerPrompt: (name: string, _meta: unknown, callback: Callback) => prompts.set(name, callback),
			registerResource: (name: string, _uri: unknown, _meta: unknown, callback: Callback) =>
				resources.set(name, callback),
		},
	};
}

const client = { portfolio: { aiView: vi.fn() } };
const view = {
	view: { works: [] },
	updatedAt: new Date("2026-11-14T08:00:00.000Z"),
	published: false,
	url: "https://example.com/dana",
	uploads: [],
	plan: null,
};

type Messages = {
	messages: Array<{ content: { type: string; resource?: { uri: string; text: string }; text?: string } }>;
};

describe("portfolio prompts and resources", () => {
	beforeEach(() => client.portfolio.aiView.mockReset());

	it("serves the portfolio and its edit language as resources", async () => {
		const { server, resources } = fakeServer();
		registerResources(server as never, client as never);
		client.portfolio.aiView.mockResolvedValueOnce(view);
		const current = (await resources.get("portfolio")!(new URL("portfolio://current"))) as {
			contents: Array<{ text: string }>;
		};
		expect(JSON.parse(current.contents[0]!.text)).toEqual({
			updatedAt: "2026-11-14T08:00:00.000Z",
			published: false,
			url: "https://example.com/dana",
			view: { works: [] },
		});
		const guide = (await resources.get("portfolio-edits")!(new URL("portfolio://_meta/edits"))) as {
			contents: Array<{ text: string; mimeType: string }>;
		};
		expect(guide.contents[0]).toMatchObject({ text: PORTFOLIO_EDIT_GUIDE, mimeType: "text/markdown" });

		client.portfolio.aiView.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { status: 404 }));
		await expect(resources.get("portfolio")!(new URL("portfolio://current"))).rejects.toThrow("create_portfolio");
	});

	it("builds a portfolio from nothing, and improves one that exists", async () => {
		const { server, prompts } = fakeServer();
		registerPrompts(server as never, client as never);

		client.portfolio.aiView.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { status: 404 }));
		const build = (await prompts.get("build_portfolio")!({})) as Messages;
		const uris = build.messages.flatMap((message) => message.content.resource?.uri ?? []);
		expect(uris).toEqual(["portfolio://_meta/edits"]);
		expect(build.messages.at(-1)?.content.text).toContain("create_portfolio");

		client.portfolio.aiView.mockResolvedValueOnce(view);
		const improve = (await prompts.get("improve_portfolio")!({})) as Messages;
		expect(improve.messages.flatMap((message) => message.content.resource?.uri ?? [])).toEqual([
			"portfolio://current",
			"portfolio://_meta/edits",
		]);
		expect(improve.messages.at(-1)?.content.text).toContain("edit_portfolio");

		// Improving needs a portfolio: without one the prompt fails with the way to make one.
		client.portfolio.aiView.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { status: 404 }));
		await expect(prompts.get("improve_portfolio")!({})).rejects.toThrow("create_portfolio");
	});
});
