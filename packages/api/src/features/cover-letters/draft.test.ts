import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
	parts: [] as { type: string; text?: string; error?: unknown }[],
	succeed: vi.fn(async () => {}),
	fail: vi.fn(async (_code: string) => {}),
}));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	streamText: () => ({
		stream: (async function* () {
			yield* mocks.parts;
		})(),
	}),
}));
vi.mock("../billing/metered-ai", () => ({
	startAiRun: async () => ({
		provider: { label: "Rezumi AI" },
		model: {},
		succeed: mocks.succeed,
		fail: mocks.fail,
	}),
}));
vi.mock("./service", () => ({
	coverLetterService: { getById: async () => ({ sourceResumeId: null, sourceApplicationId: "a1" }) },
}));
vi.mock("../applications/service", () => ({
	applicationService: {
		getById: async () => ({ role: "Designer", company: "Example", jobDescription: "Posting", requirements: [] }),
	},
}));
vi.mock("../resume/service", () => ({ resumeService: { getById: async () => null } }));

const { draftLetterBody } = await import("./draft");

async function drain(signal?: AbortSignal) {
	const text: string[] = [];
	for await (const chunk of draftLetterBody({ id: "l1", userId: "u1", variant: "draft", signal })) text.push(chunk);
	return text.join("");
}

describe("letter drafts on Rezumi AI", () => {
	beforeEach(() => {
		mocks.succeed.mockClear();
		mocks.fail.mockClear();
	});

	it("keeps the credits for a draft that arrived in full", async () => {
		mocks.parts = [{ type: "text-delta", text: "Dear team," }, { type: "finish" }];
		expect(await drain()).toBe("Dear team,");
		expect(mocks.succeed).toHaveBeenCalledOnce();
		expect(mocks.fail).not.toHaveBeenCalled();
	});

	it("gives the credits back for a draft stopped part-way, which ends with an abort part", async () => {
		mocks.parts = [{ type: "text-delta", text: "Dear" }, { type: "abort" }];
		await drain();
		expect(mocks.succeed).not.toHaveBeenCalled();
		expect(mocks.fail).toHaveBeenCalledWith("aborted");
	});

	it("gives the credits back when the request was cancelled", async () => {
		const controller = new AbortController();
		mocks.parts = [{ type: "text-delta", text: "Dear" }];
		const run = drain(controller.signal);
		controller.abort();
		await run;
		expect(mocks.succeed).not.toHaveBeenCalled();
		expect(mocks.fail).toHaveBeenCalledWith("aborted");
	});

	it("gives the credits back when the provider fails", async () => {
		mocks.parts = [{ type: "error", error: new Error("down") }];
		await expect(drain()).rejects.toMatchObject({ code: "BAD_GATEWAY" });
		expect(mocks.fail).toHaveBeenCalledWith("no_result");
	});
});
