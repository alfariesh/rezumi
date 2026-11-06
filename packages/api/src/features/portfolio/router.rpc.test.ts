import type { RouterClient } from "@orpc/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});
vi.mock("./service", () => ({
	portfolioService: {
		fetchRemoteImage: async () =>
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], "picture.png", { type: "image/png" }),
		uploadPdf: async (_userId: string, input: { file: File; pages: number }) => ({
			key: "uploads/member/documents/portfolio/a.pdf",
			bytes: input.file.size,
			pages: input.pages,
		}),
	},
}));

const { portfolioRouter } = await import("./router");

/** The real wire format: the browser's RPC link talking to the server's RPC handler, files both ways. */
function rpcClient() {
	const handler = new RPCHandler({ portfolio: portfolioRouter });
	const link = new RPCLink({
		url: "http://app.test/api/rpc",
		fetch: async (request) => {
			const { response } = await handler.handle(request as Request, {
				prefix: "/api/rpc",
				context: { user: { id: "member" }, reqHeaders: new Headers() } as never,
			});
			return response ?? new Response("Not Found", { status: 404 });
		},
	});
	return createORPCClient<RouterClient<{ portfolio: typeof portfolioRouter }>>(link);
}

describe("portfolio files over RPC", () => {
	it("sends a fetched picture back as a file", async () => {
		const picture = await rpcClient().portfolio.fetchRemoteImage({ url: "https://example.com/a.png" });
		expect(picture).toBeInstanceOf(Blob);
		expect(picture.type).toBe("image/png");
		expect(new Uint8Array(await picture.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
	});

	it("takes a PDF with its page count", async () => {
		const file = new File(["%PDF-1.7 hello"], "case.pdf", { type: "application/pdf" });
		await expect(rpcClient().portfolio.uploadPdf({ file, pages: 3 })).resolves.toEqual({
			key: "uploads/member/documents/portfolio/a.pdf",
			bytes: file.size,
			pages: 3,
		});
	});
});
