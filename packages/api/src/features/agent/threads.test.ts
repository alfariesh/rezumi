import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	return { protectedProcedure: os.$context<{ user: { id: string } }>() };
});
vi.mock("./service", () => ({ agentService: { threads: {} } }));

const { threadsRouter } = await import("./threads");

describe("starting a conversation", () => {
	const input = threadsRouter.start["~orpc"].inputSchema;
	const accepts = (value: Record<string, unknown>) => input?.["~standard"].validate(value);

	it("takes exactly one document: a resume, a cover letter or the portfolio", async () => {
		for (const document of [{ resumeId: "r1" }, { coverLetterId: "c1" }, { portfolioId: "p1" }])
			expect(await accepts(document), JSON.stringify(document)).not.toHaveProperty("issues");
		for (const documents of [
			{},
			{ resumeId: "r1", portfolioId: "p1" },
			{ coverLetterId: "c1", portfolioId: "p1" },
			{ portfolioId: "p1", applicationId: "a1" },
		])
			expect(await accepts(documents), JSON.stringify(documents)).toHaveProperty("issues");
	});

	it("keeps documents out of application and career conversations", async () => {
		expect(await accepts({ scope: "application", applicationId: "a1" })).not.toHaveProperty("issues");
		expect(await accepts({ scope: "career" })).not.toHaveProperty("issues");
		expect(await accepts({ scope: "career", portfolioId: "p1" })).toHaveProperty("issues");
		expect(await accepts({ scope: "application", applicationId: "a1", portfolioId: "p1" })).toHaveProperty("issues");
	});
});
