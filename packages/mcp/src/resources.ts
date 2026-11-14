import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RouterClient } from "@orpc/server";
import type router from "@rezumi/api/routers";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ORPCError } from "@orpc/server";
import { PORTFOLIO_EDIT_GUIDE } from "@rezumi/portfolio/edits";
import { createDesignCatalog } from "@rezumi/resume/design-catalog";
import { createResumeDataJsonSchema } from "@rezumi/schema/resume/json-schema";
import { MCP_TOOL_NAME as T } from "./mcp-tool-names";
import { safeMcpError } from "./results";

export function registerResources(server: McpServer, client: RouterClient<typeof router>) {
	// ── Resource: resume://{id} ──────────────────────────────────
	// Template resource: read resume JSON by ID. Discovery is via list tool (tools), not resources/list.
	const resumeTemplate = new ResourceTemplate("resume://{id}", { list: undefined });

	server.registerResource(
		"resume",
		resumeTemplate,
		{
			title: "Resume Data",
			mimeType: "application/json",
			description: [
				"Full resume data as JSON, including basics, summary, sections, custom sections, and metadata.",
				`Discover resume IDs with the \`${T.listResumes}\` tool, then read \`resume://{id}\` or use \`${T.getResume}\`.`,
				"Appears in `resources/templates/list`; not enumerated in `resources/list`.",
				"Embedded as context in MCP prompts (build_resume, improve_resume, etc.).",
			].join(" "),
		},
		async (uri: URL) => {
			try {
				const match = /^resume:\/\/([^/?#]+)$/.exec(uri.href);
				const id = match?.[1] ? decodeURIComponent(match[1]) : "";
				if (!id || /[\s/?#@]/.test(id))
					throw new ORPCError("BAD_REQUEST", { message: "Invalid resume URI. Expected format: resume://{id}" });

				const resume = await client.resume.getById({ id });

				return {
					contents: [
						{
							uri: uri.href,
							mimeType: "application/json" as const,
							text: JSON.stringify(resume.data, null, 2),
						},
					],
				};
			} catch (error) {
				throw safeMcpError(error, "reading resume resource");
			}
		},
	);

	// ── Resource: resume://_meta/schema ───────────────────────────
	// Static resource containing the JSON Schema for resume data.
	// LLMs should reference this when generating JSON Patch operations
	// to ensure paths and values conform to the expected structure.
	server.registerResource(
		"resume-schema",
		"resume://_meta/schema",
		{
			title: "Resume Data JSON Schema",
			mimeType: "application/json",
			description: [
				"The JSON Schema describing the complete resume data structure.",
				"Reference this when generating JSON Patch operations to ensure paths and value types are valid.",
				"Covers: basics, summary, picture, sections (experience, education, skills, etc.),",
				"custom sections, and metadata (template, layout, typography, colors, CSS).",
			].join(" "),
		},
		(uri: URL) => {
			try {
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: "application/json" as const,
							// Generated from the Zod schema, like /schema.json, so it never drifts from what writes accept.
							text: JSON.stringify(createResumeDataJsonSchema(), null, 2),
						},
					],
				};
			} catch (error) {
				throw safeMcpError(error, "reading resume schema resource");
			}
		},
	);

	// ── Resource: portfolio://current ─────────────────────────────
	// The account's one portfolio, as `get_portfolio` reads it.
	server.registerResource(
		"portfolio",
		"portfolio://current",
		{
			title: "Portfolio",
			mimeType: "application/json",
			description: [
				"The account's portfolio as an AI edits it: status and address, theme and design, every item with its id, the",
				"career sections from the CV or Profile (read-only), the pictures it can place, limits and plan locks.",
				`Same as the \`${T.getPortfolio}\` tool; change it with \`${T.editPortfolio}\`.`,
			].join(" "),
		},
		async (uri: URL) => {
			try {
				const portfolio = await client.portfolio.aiView({});
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: "application/json" as const,
							text: JSON.stringify(
								{
									updatedAt: portfolio.updatedAt.toISOString(),
									published: portfolio.published,
									url: portfolio.url,
									view: portfolio.view,
								},
								null,
								2,
							),
						},
					],
				};
			} catch (error) {
				throw safeMcpError(error, "reading portfolio resource", "portfolio");
			}
		},
	);

	// ── Resource: portfolio://_meta/edits ─────────────────────────
	// Static resource: the edit language `edit_portfolio` takes.
	server.registerResource(
		"portfolio-edits",
		"portfolio://_meta/edits",
		{
			title: "Portfolio Edit Language",
			mimeType: "text/markdown",
			description: [
				`The edit language \`${T.editPortfolio}\` takes: operations, lists and their item fields, settable fields, positions`,
				"and refs, image refs, rich text and examples. Read it before editing a portfolio.",
			].join(" "),
		},
		(uri: URL) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown" as const, text: PORTFOLIO_EDIT_GUIDE }] }),
	);

	// ── Resource: resume://_meta/design ───────────────────────────
	// Static resource: the templates, icon set and logo rules, so agents choose real names instead of guessing.
	server.registerResource(
		"resume-design",
		"resume://_meta/design",
		{
			title: "Resume Design Catalog",
			mimeType: "application/json",
			description: [
				"The templates on offer (lineup with summaries, layout, plan and preset look), the resume icon set by",
				"category with the icon settings, and how profile and tool logos appear.",
				"Read it before setting /metadata/template, /metadata/design/icons or any `icon` field.",
			].join(" "),
		},
		(uri: URL) => {
			try {
				return {
					contents: [
						{
							uri: uri.href,
							mimeType: "application/json" as const,
							text: JSON.stringify(createDesignCatalog(), null, 2),
						},
					],
				};
			} catch (error) {
				throw safeMcpError(error, "reading resume design resource");
			}
		},
	);
}
