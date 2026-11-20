import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ORPCError } from "@orpc/server";
import z from "zod";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { MCP_TOOL_NAME } from "./mcp-tool-names";

/** Refusals with a 5xx status that still say something true and useful: job search being out of service for now. */
const TOLD_SERVER_CODES = new Set(["JOBS_UNAVAILABLE", "JOBS_BUDGET_LIMITED"]);
const toldError = (error: unknown): error is ORPCError<string, unknown> =>
	error instanceof ORPCError && (error.status < 500 || TOLD_SERVER_CODES.has(error.code));

function errorMessage(error: unknown): string {
	if (toldError(error)) return error.message;
	if (error instanceof z.ZodError) return "Invalid input. Check the tool schema.";
	return "Unexpected failure. Retry; contact the administrator if it persists.";
}

/**
 * Maps a failed router call to an actionable next step for the model.
 *
 * Matches on the error's `code` and `status` rather than its message: procedures
 * throw `new ORPCError("RESUME_LOCKED")` and friends without a message, so the
 * message is the code itself (`"RESUME_LOCKED"`) or oRPC's own default
 * (`"Not Found"` for `NOT_FOUND`), and HTTP status never appears in it at all.
 */
/** Which tools a failure came from, when their errors need their own hints (`NOT_FOUND` means no portfolio there). */
export type ErrorDomain = "portfolio" | "jobs";

/** Refusals of the portfolio procedures, which say what to do next for an agent. */
function portfolioHint(code: string, inPortfolio: boolean): string | null {
	const { getPortfolio, createPortfolio, publishPortfolio } = MCP_TOOL_NAME;
	switch (code) {
		case "PORTFOLIO_DISABLED":
			return "Portfolios aren't available for this account yet. Tell the user; no portfolio tool will work.";
		case "PORTFOLIO_EXISTS":
			return `The account already has its one portfolio. Read it with \`${getPortfolio}\` and edit it instead.`;
		case "PORTFOLIO_EMAIL_NOT_VERIFIED":
			return `Ask the user to verify their email address in Rezumi, then call \`${publishPortfolio}\` again.`;
		case "PORTFOLIO_VERSION_CONFLICT":
			return `The portfolio changed since you read it. Call \`${getPortfolio}\` again and redo the edits on what it shows now (or leave expectedUpdatedAt out: edits address items by id).`;
		case "PORTFOLIO_SUSPENDED":
			return "An administrator took this portfolio down, so it can't be published. Tell the user; they can appeal to support.";
		case "PORTFOLIO_FILE_TOO_LARGE":
		case "PORTFOLIO_IMAGE_INVALID":
			return `Supply a JPEG, PNG or WebP picture of at most ${PORTFOLIO_UPLOAD.imageBytes / 1024 / 1024} MB and ${PORTFOLIO_UPLOAD.imageSide} px on its longest side; the server can't resize pictures.`;
		case "PORTFOLIO_IMAGE_UNREACHABLE":
		case "PORTFOLIO_LINK_UNREADABLE":
			return `That address couldn't be downloaded. Ask the user for the picture as a file instead (\`${MCP_TOOL_NAME.addPortfolioImage}\` with \`file\`).`;
		case "PORTFOLIO_STORAGE_FULL":
			return "The portfolio's storage is full. Ask the user to remove pictures it no longer uses in the editor.";
		case "PORTFOLIO_WORKS_LIMIT":
			return "The portfolio holds as many works as it may. Ask the user which works to remove, or import fewer projects.";
		case "PORTFOLIO_WORK_NOT_FOUND":
			return `No work has that id. Read the ids with \`${getPortfolio}\`.`;
		case "PORTFOLIO_SOURCE_INVALID":
			return `Choose another resume (\`${MCP_TOOL_NAME.listResumes}\`), or null for the Profile.`;
		case "NOT_FOUND":
			return inPortfolio ? `This account has no portfolio yet. Create one with \`${createPortfolio}\`.` : null;
		default:
			return null;
	}
}

/** Refusals of the job search tools. */
function jobsHint(code: string): string | null {
	switch (code) {
		case "JOBS_UNAVAILABLE":
			return "Job search can't be used on this server right now. Tell the user and don't retry soon.";
		case "JOBS_BUDGET_LIMITED":
			return "Job search reached today's limit on this server. Tell the user to try again tomorrow; don't retry today.";
		case "PLAN_LIMIT_REACHED":
			return "The user's job searches for today are used up (see `resetsAt` in the error data). Tell the user; reading pages already opened today still works, new searches don't.";
		case "NOT_FOUND":
			return `This listing isn't available anymore (closed or removed). Run \`${MCP_TOOL_NAME.searchJobs}\` again.`;
		case "RATE_LIMIT_EXCEEDED":
			return "Too many searches in a short time. Wait a minute before searching again.";
		case "BAD_REQUEST":
			return `This page can't be continued. Run \`${MCP_TOOL_NAME.searchJobs}\` again without \`cursor\`.`;
		default:
			return null;
	}
}

function errorHint(error: unknown, domain?: ErrorDomain): string {
	if (!(error instanceof ORPCError)) return "";

	const { unlockResume, listResumes, listApplications } = MCP_TOOL_NAME;
	const { code, status } = error;

	const portfolio = portfolioHint(code, domain === "portfolio");
	if (portfolio) return `\n\nHint: ${portfolio}`;
	const jobs = domain === "jobs" ? jobsHint(code) : null;
	if (jobs) return `\n\nHint: ${jobs}`;
	if (code === "PLAN_LIMIT_REACHED" || code === "PLAN_FEATURE_REQUIRED")
		return "\n\nHint: The account's plan doesn't allow this. Explain the limit to the user and suggest what the plan includes; don't retry it.";

	// Check codes before statuses: RESUME_SLUG_ALREADY_EXISTS is thrown with status 400.
	if (code === "RESUME_SLUG_ALREADY_EXISTS") return "\n\nHint: The slug is already in use. Try a different one.";
	if (code === "INVALID_SLUG")
		return "\n\nHint: Use lowercase letters and numbers joined by single dashes, e.g. 'product-designer'.";
	if (code === "RESUME_LOCKED")
		return `\n\nHint: This resume is locked. Ask the user before unlocking with \`${unlockResume}\`.`;
	// Every tool shares this handler, so the wording stays entity-agnostic: `NOT_FOUND` is
	// thrown by the application procedures too, and resume-flavoured advice misdirects there.
	if (code === "NOT_FOUND" || status === 404)
		return `\n\nHint: Not found. Check the ID — \`${listResumes}\`, \`${MCP_TOOL_NAME.listCoverLetters}\`, and \`${listApplications}\` return valid ones.`;
	if (code === "FORBIDDEN" || status === 403)
		return "\n\nHint: Permission denied. This account cannot access that record.";
	if (code === "CONFLICT" || status === 409)
		return "\n\nHint: Reread the document and recompute changes using its latest timestamp or revision.";
	if (status === 401) return "\n\nHint: Reconnect with OAuth or supply a valid API key.";
	if (status === 429) return "\n\nHint: Rate limit exceeded. Wait before retrying.";
	if (status === 400) return "\n\nHint: Invalid request. Check the input parameters against the tool's schema.";
	return "";
}

/**
 * Wraps an async tool handler with consistent error formatting.
 * On success, returns the handler's result directly.
 * On failure, returns `{ isError: true, content: [{ type: "text", text }] }` with actionable hints.
 */
export function withErrorHandling<T, Args extends unknown[]>(
	label: string,
	handler: (params: T, ...args: Args) => Promise<CallToolResult>,
	domain?: ErrorDomain,
) {
	return async (params: T, ...args: Args): Promise<CallToolResult> => {
		try {
			return await handler(params, ...args);
		} catch (error) {
			const reference = toldError(error) || error instanceof z.ZodError ? undefined : randomUUID();
			if (reference) console.error("MCP tool failure", { reference, operation: label });
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: `Error ${label}: ${errorMessage(error)}${errorHint(error, domain)}${reference ? `\n\nReference: ${reference}` : ""}`,
					},
				],
			};
		}
	};
}

export function text(value: string, structured: Record<string, unknown> = { message: value }): CallToolResult {
	return { content: [{ type: "text", text: value }], structuredContent: JSON.parse(JSON.stringify(structured)) };
}

export function json(value: unknown): CallToolResult {
	const structured = Array.isArray(value)
		? { items: value }
		: value !== null && typeof value === "object"
			? value
			: { result: value ?? null };
	return text(JSON.stringify(value ?? null, null, 2), structured as Record<string, unknown>);
}

/** Protocol callbacks cannot return tool isError results; emit sanitized JSON-RPC errors. */
export function safeMcpError(error: unknown, operation: string, domain?: ErrorDomain): McpError {
	const invalidInput = error instanceof z.ZodError || error instanceof URIError;
	const known = error instanceof ORPCError && error.status < 500;
	const reference = known || invalidInput ? undefined : randomUUID();
	if (reference) console.error("MCP callback failure", { reference, operation });
	const message = invalidInput ? "Invalid input. Check the resource URI or prompt arguments." : errorMessage(error);
	return new McpError(
		known || invalidInput ? ErrorCode.InvalidParams : ErrorCode.InternalError,
		`${message}${errorHint(error, domain)}${reference ? `\n\nReference: ${reference}` : ""}`,
		{
			code: known ? error.code : invalidInput ? "INVALID_INPUT" : "INTERNAL_ERROR",
			...(reference ? { reference } : {}),
		},
	);
}

type DynamicClient = { [key: string]: DynamicClient | ((input: unknown) => Promise<unknown>) };
export function getClientCall(client: object, path: string) {
	let value: DynamicClient | ((input: unknown) => Promise<unknown>) = client as DynamicClient;
	for (const part of path.split(".")) {
		if (typeof value === "function" || !value[part]) throw new Error(`Missing MCP client procedure: ${path}`);
		value = value[part];
	}
	if (typeof value !== "function") throw new Error(`Invalid MCP client procedure: ${path}`);
	return value;
}
