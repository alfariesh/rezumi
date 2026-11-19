import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
	parts: [] as { type: string; text?: string; error?: unknown }[],
	prompt: "",
	profile: { text: "# Dana Reyes\n\n## Experience\n\nDesigner at Lumen", updatedAt: null } as {
		text: string;
		updatedAt: Date | null;
	} | null,
	applicationId: "a1" as string | null,
	succeed: vi.fn(async () => {}),
	fail: vi.fn(async (_code: string) => {}),
	stop: vi.fn(async (_code?: string) => {}),
}));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	streamText: (options: { prompt: string }) => {
		mocks.prompt = options.prompt;
		return {
			stream: (async function* () {
				yield* mocks.parts;
			})(),
		};
	},
}));
vi.mock("../billing/metered-ai", () => ({
	startAiRun: async () => ({
		provider: { label: "Rezumi AI" },
		model: {},
		succeed: mocks.succeed,
		fail: mocks.fail,
		stop: mocks.stop,
	}),
}));
vi.mock("./service", () => ({
	coverLetterService: {
		getById: async () => ({ sourceResumeId: null, sourceApplicationId: mocks.applicationId }),
	},
}));
vi.mock("../profile/context", () => ({ readProfileContext: async () => mocks.profile }));
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
		mocks.stop.mockClear();
	});

	it("keeps the credits for a draft that arrived in full", async () => {
		mocks.parts = [{ type: "text-delta", text: "Dear team," }, { type: "finish" }];
		expect(await drain()).toBe("Dear team,");
		expect(mocks.succeed).toHaveBeenCalledOnce();
		expect(mocks.fail).not.toHaveBeenCalled();
	});

	it("settles a draft stopped part-way, which ends with an abort part, as stopped", async () => {
		mocks.parts = [{ type: "text-delta", text: "Dear" }, { type: "abort" }];
		await drain();
		expect(mocks.succeed).not.toHaveBeenCalled();
		expect(mocks.fail).not.toHaveBeenCalled();
		expect(mocks.stop).toHaveBeenCalledOnce();
	});

	it("settles a cancelled request as stopped", async () => {
		const controller = new AbortController();
		mocks.parts = [{ type: "text-delta", text: "Dear" }];
		const run = drain(controller.signal);
		controller.abort();
		await run;
		expect(mocks.succeed).not.toHaveBeenCalled();
		expect(mocks.stop).toHaveBeenCalledOnce();
	});

	it("settles a stream the client closed early as stopped, not as a failure", async () => {
		mocks.parts = [
			{ type: "text-delta", text: "Dear team," },
			{ type: "text-delta", text: " more" },
			{ type: "finish" },
		];
		for await (const _chunk of draftLetterBody({ id: "l1", userId: "u1", variant: "draft" })) break;
		expect(mocks.succeed).not.toHaveBeenCalled();
		expect(mocks.fail).not.toHaveBeenCalled();
		expect(mocks.stop).toHaveBeenCalledOnce();
	});

	it("writes from the Profile when the letter has no resume", async () => {
		mocks.parts = [{ type: "text-delta", text: "Dear team," }, { type: "finish" }];
		await drain();
		expect(mocks.prompt).toContain("## The candidate's Profile");
		expect(mocks.prompt).toContain("Designer at Lumen");
		expect(mocks.prompt).not.toContain("## The resume");
	});

	it("needs a Profile, a resume or an application to write from", async () => {
		mocks.profile = null;
		mocks.applicationId = null;
		try {
			await expect(drain()).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(mocks.succeed).not.toHaveBeenCalled();
		} finally {
			mocks.profile = { text: "# Dana Reyes", updatedAt: null };
			mocks.applicationId = "a1";
		}
	});

	it("gives the credits back when the provider fails", async () => {
		mocks.parts = [{ type: "error", error: new Error("down") }];
		await expect(drain()).rejects.toMatchObject({ code: "BAD_GATEWAY" });
		expect(mocks.fail).toHaveBeenCalledWith("no_result");
	});

	it("settles a draft that failed after text arrived, such as one cut off at its limit, as stopped", async () => {
		mocks.parts = [
			{ type: "text-delta", text: "Dear team, a long letter" },
			{ type: "error", error: new Error("cut off") },
		];
		await expect(drain()).rejects.toMatchObject({ code: "BAD_GATEWAY" });
		expect(mocks.fail).not.toHaveBeenCalled();
		expect(mocks.stop).toHaveBeenCalledWith("no_result");
	});
});
