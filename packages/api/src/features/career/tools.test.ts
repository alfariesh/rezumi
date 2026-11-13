import { expect, it, vi } from "vite-plus/test";

vi.mock("@rezumi/db/client", () => ({ db: {} }));
vi.mock("./service", () => ({ careerService: {}, modelFact: vi.fn() }));
const { buildCareerInstructions } = await import("./tools");

it("names the application's role and company only when the user shares the application", () => {
	const context = {
		application: { role: "Staff Engineer", company: "Acme Robotics" },
		profile: { memoryMode: "off" },
		facts: [],
		stories: [],
	} as unknown as Parameters<typeof buildCareerInstructions>[0]["context"];
	const instructions = (shareApplication: boolean) =>
		buildCareerInstructions({ context, shareApplication, shareMemory: false, tab: undefined });

	expect(instructions(false)).not.toMatch(/Staff Engineer|Acme Robotics/);
	expect(instructions(true)).toContain("Staff Engineer at Acme Robotics");
});

it("keeps placeholder-like text in a value as plain text", () => {
	const context = {
		application: { role: "Engineer {{CONTEXT}}", company: "Acme $& Co" },
		profile: { memoryMode: "off" },
		facts: [],
		stories: [],
	} as unknown as Parameters<typeof buildCareerInstructions>[0]["context"];
	const instructions = buildCareerInstructions({ context, shareApplication: true, shareMemory: false, tab: undefined });

	expect(instructions).toContain("Engineer {{CONTEXT}} at Acme $& Co");
});

it("shares the Profile with the coach only along with its memory", () => {
	const context = {
		application: null,
		profile: { memoryMode: "off" },
		details: "# Dana Reyes\n\n## Experience\n\nDesigner at Lumen",
		facts: [],
		stories: [],
	} as unknown as Parameters<typeof buildCareerInstructions>[0]["context"];
	const instructions = (shareMemory: boolean) =>
		buildCareerInstructions({ context, shareApplication: false, shareMemory, tab: undefined });

	expect(instructions(true)).toContain("Designer at Lumen");
	expect(instructions(false)).not.toContain("Designer at Lumen");
});
