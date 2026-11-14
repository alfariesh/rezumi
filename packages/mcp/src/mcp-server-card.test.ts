import { describe, expect, it } from "vite-plus/test";
import { buildMcpServerCard } from "./mcp-server-card";

describe("buildMcpServerCard", () => {
	const card = buildMcpServerCard("1.2.3");

	it("declares a JSON Schema input for every tool", () => {
		for (const tool of card.tools) {
			expect(tool.inputSchema, tool.name).toBeDefined();
			expect(tool.annotations, tool.name).toBeDefined();
			expect(tool.title.length, tool.name).toBeGreaterThan(0);
			// Connector directories reject tools without annotations.title.
			expect(tool.annotations.title, tool.name).toBe(tool.title);
			expect(tool.description.length, tool.name).toBeGreaterThan(0);
		}
	});

	it("lists the portfolio tools, prompts and resources", () => {
		const tools = card.tools.map((tool) => tool.name);
		for (const name of [
			"get_portfolio",
			"create_portfolio",
			"edit_portfolio",
			"add_portfolio_image",
			"publish_portfolio",
			"get_portfolio_statistics",
		])
			expect(tools).toContain(name);
		expect(card.prompts.find((prompt) => prompt.name === "build_portfolio")?.arguments).toEqual([]);
		expect(card.prompts.find((prompt) => prompt.name === "improve_resume")?.arguments).toEqual([
			{ name: "id", description: "Resume ID.", required: true },
		]);
		expect(card.resources.map((resource) => resource.uri)).toEqual(
			expect.arrayContaining(["portfolio://current", "portfolio://_meta/edits"]),
		);
		const publish = card.tools.find((tool) => tool.name === "publish_portfolio");
		expect(publish?.annotations).toMatchObject({ destructiveHint: true, openWorldHint: true, readOnlyHint: false });
	});
});
