import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createRouterClient } from "@orpc/server";
import { defaultResumeData } from "@rezumi/schema/resume/default";

const mocks = vi.hoisted(() => ({ getById: vi.fn() }));

vi.mock("../../context", async () => {
	const { os } = await vi.importActual<typeof import("@orpc/server")>("@orpc/server");
	const procedure = os.$context<{ locale: "en-US"; reqHeaders: Headers; user: { id: string } }>();
	return { protectedProcedure: procedure, publicProcedure: procedure };
});
vi.mock("./service", () => ({ resumeService: { getById: mocks.getById } }));

const { matchResume } = await import("./checks");
const { resumeRouter } = await import("./router");

const resumeWith = (summary: string, hiddenTerms: string[] = []) => {
	const data = structuredClone(defaultResumeData);
	data.summary.content = `<p>${summary}</p>`;
	data.metadata.check = { ignored: data.metadata.check?.ignored ?? [], hiddenTerms };
	return { data };
};

describe("resume.matchTerms (browser extension, 02-teknis.md §10)", () => {
	beforeEach(() => {
		mocks.getById.mockReset();
	});

	it("is the REST term match over RPC, kept out of the public API", () => {
		expect(resumeRouter.matchTerms["~orpc"].route.tags).toEqual(["Internal"]);
		// The REST alias keeps its public route.
		expect(matchResume["~orpc"].route).toMatchObject({ method: "POST", path: "/resumes/{id}/job-matches" });
		expect(matchResume["~orpc"].route.tags).toEqual(["Checks"]);
	});

	it("matches the account's resume against the posting and leaves hidden terms out", async () => {
		mocks.getById.mockResolvedValue(resumeWith("Product designer working in Figma and user research.", ["sql"]));
		const api = createRouterClient(resumeRouter, {
			context: { locale: "en-US", reqHeaders: new Headers(), user: { id: "member" } } as never,
		});
		const result = await api.matchTerms({
			id: "resume-1",
			jobDescription: "We need a product designer with Figma, SQL and accessibility experience.",
		});
		expect(mocks.getById).toHaveBeenCalledWith({ id: "resume-1", userId: "member" });
		expect(result.total).toBe(result.found.length + result.missing.length);
		expect(result.found.map((term) => term.term)).toContain("figma");
		expect([...result.found, ...result.missing].map((term) => term.term)).not.toContain("sql");
	});
});
