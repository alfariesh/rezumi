import { prepareMcpDiscovery } from "./discovery";
import { MCP_TOOL_NAME as T } from "./mcp-tool-names";
import { PROMPT_ARGUMENTS, PROMPT_META } from "./prompts";

/** Shared server identity for both the live MCP server and the static server card. */
export function buildMcpServerInfo(version: string) {
	return {
		name: "rezumi",
		version,
		title: "Rezumi",
		websiteUrl: "https://rezumi.app",
		description:
			"Rezumi is a free and open-source resume builder. Use this MCP server to work on your resumes, cover letters, job applications and portfolio with an LLM of your choice.",
		icons: [
			{ src: "https://rezumi.app/icon/light.svg", mimeType: "image/svg+xml", theme: "light" as const },
			{ src: "https://rezumi.app/icon/dark.svg", mimeType: "image/svg+xml", theme: "dark" as const },
		],
	};
}

/**
 * Static MCP server card (SEP-1649 / well-known `mcp/server-card.json`).
 * Kept in sync with `registerTools`, `registerResources`, and `registerPrompts`.
 *
 * Some registries only surface the `resources` array in their UI, not `resourceTemplates`.
 * The parameterized resume URI is therefore duplicated here so discovery matches the live template.
 */
export function buildMcpServerCard(appVersion: string) {
	const tools = prepareMcpDiscovery().tools.map(({ execution: _execution, ...tool }) => tool);

	const prompts = Object.entries(PROMPT_META).map(([name, meta]) => ({
		name,
		...meta,
		arguments: [...PROMPT_ARGUMENTS[name as keyof typeof PROMPT_META]],
	}));

	const resources = [
		{
			name: "resume-schema",
			title: "Resume Data JSON Schema",
			uri: "resume://_meta/schema",
			description: [
				"The JSON Schema describing the complete resume data structure.",
				"Reference when generating JSON Patch operations so paths and value types are valid.",
			].join(" "),
			mimeType: "application/json",
		},
		{
			name: "resume-design",
			title: "Resume Design Catalog",
			uri: "resume://_meta/design",
			description: [
				"The templates on offer, the resume icon set by category with the icon settings, and how logos appear.",
				"Read before setting the template, icon settings or icon fields.",
			].join(" "),
			mimeType: "application/json",
		},
		{
			name: "portfolio",
			title: "Portfolio",
			uri: "portfolio://current",
			description: [
				"The account's portfolio as an AI edits it: every item with its id, the career sections (read-only), pictures,",
				"limits and plan locks. Same as get_portfolio.",
			].join(" "),
			mimeType: "application/json",
		},
		{
			name: "portfolio-edits",
			title: "Portfolio Edit Language",
			uri: "portfolio://_meta/edits",
			description: "The edit language edit_portfolio takes. Read it before editing a portfolio.",
			mimeType: "text/markdown",
		},
		{
			name: "resume",
			title: "Resume Data",
			uri: "resume://{id}",
			description: [
				"Full resume JSON for one resume. Substitute a real ID for `{id}` (UUID from your account).",
				"On the wire this is a resource template (`resources/templates/list`), not a row in `resources/list`.",
				`Discover IDs with \`${T.listResumes}\`; read via \`resources/read\` on e.g. \`resume://<id>\` or use \`${T.getResume}\`.`,
			].join(" "),
			mimeType: "application/json",
		},
	];

	const resourceTemplates = [
		{
			name: "resume",
			title: "Resume Data",
			uriTemplate: "resume://{id}",
			description: "Full resume data as JSON. Discover IDs with the list tool; read via resources/read or read_resume.",
			mimeType: "application/json",
		},
	];

	return {
		/**
		 * Optional session fields for gateways. OAuth is primary; API key is optional for clients that support custom headers.
		 */
		configurationSchema: {
			type: "object",
			properties: {
				apiKey: {
					type: "string",
					title: "API key",
					description:
						"Optional. Create a key under Settings → API keys. Forwarded as the x-api-key header when not using OAuth.",
					"x-from": { header: "x-api-key" },
				},
			},
		},
		serverInfo: buildMcpServerInfo(appVersion),
		tools,
		prompts,
		resources,
		resourceTemplates,
		authentication: {
			required: true,
			schemes: ["oauth2", "bearer", "apiKey"],
		},
	};
}
