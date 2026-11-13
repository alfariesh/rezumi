import type { AiSourceRequest } from "../../billing/ai-source";
import type { WebAccessFailure } from "../../web-access/contracts";
import type { SourceNote, SourceResult } from "@rezumi/schema/profile/sources";
import { ORPCError } from "@orpc/server";
import { isProfileEmpty } from "@rezumi/schema/profile/data";
import { rethrowAiError } from "../../ai/procedure";
import { aiService } from "../../ai/service";
import { runWithAiSource } from "../../billing/metered-ai";
import { WebAccessError } from "../../web-access/contracts";
import { webAccessService } from "../../web-access/credentials";
import { readPage } from "../../web-access/service";
import { sourceErrors } from "./errors";
import { sourceResult } from "./result";

/**
 * A personal website: the page is read with the app's web reader (public https addresses only, every redirect
 * checked), then AI turns its text into Profile data with the same rules as a file import: only what the page states.
 * The page's text goes to the model as data, never as instructions.
 */

/** An address as typed, as the https page the reader asks for; null when it isn't a web address. */
export function websiteAddress(input: string): string | null {
	const text = input.trim();
	if (!text || text.length > 2048 || /\s/.test(text)) return null;
	try {
		const url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(text) ? text : `https://${text}`);
		if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
		// The reader reads https only; personal sites that still answer on http almost always answer on https too.
		url.protocol = "https:";
		url.hash = "";
		return url.toString();
	} catch {
		return null;
	}
}

function pageError(reason: WebAccessFailure) {
	switch (reason) {
		case "unsafe-url":
		case "malformed":
			return sourceErrors.invalid("Enter the address of a public website, such as yourname.com.");
		case "unreachable":
		case "not-a-page":
		case "empty":
			return sourceErrors.notFound("That page couldn't be found or has no text to read. Check the address.");
		case "rate-limit":
			return sourceErrors.limit("Too many pages were read in a short time. Try again in a minute.");
		case "challenge":
		case "auth":
			return sourceErrors.failed("That site doesn't let other services read it. Upload a file instead.");
		default:
			return sourceErrors.failed("That page couldn't be read just now. Try again in a moment.");
	}
}

async function readWebsitePage(userId: string, address: string, signal: AbortSignal | undefined) {
	try {
		return await readPage(address, { connection: await webAccessService.resolve(userId), userId, signal });
	} catch (error) {
		signal?.throwIfAborted();
		throw pageError(error instanceof WebAccessError ? error.reason : "unreachable");
	}
}

type WebsiteRequest = AiSourceRequest & { url: string };

/** Reads the person's website into Profile data. AI does the reading: Rezumi AI (2 credits) or the user's own. */
export async function readWebsite(
	userId: string,
	request: WebsiteRequest,
	signal?: AbortSignal,
): Promise<SourceResult> {
	const address = websiteAddress(request.url);
	if (!address) throw sourceErrors.invalid("Enter the address of a public website, such as yourname.com.");

	try {
		return await runWithAiSource(
			{
				userId,
				action: "profile-website",
				aiSource: request.aiSource,
				idempotencyKey: request.idempotencyKey,
				missing: () =>
					new ORPCError("BAD_REQUEST", {
						message: "Test and turn on an AI provider in Settings → AI & developer first.",
					}),
			},
			// The page is read once the AI is settled, so a request with no AI to run on reads nothing; a page that can't
			// be read gives the credits back like any other failure.
			async (ai) => {
				const page = await readWebsitePage(userId, address, signal);
				const notes: SourceNote[] = page.truncated || page.completeness === "incomplete" ? ["truncated"] : [];
				const data = await aiService.parseWebsite({
					languageModel: ai.model,
					text: page.content,
					url: page.resolvedUrl ?? page.requestedUrl,
					signal,
				});
				signal?.throwIfAborted();
				const result = sourceResult(data, notes);
				// Nothing about a person on the page: nothing to pay for either (the credits come back).
				if (isProfileEmpty(result.data))
					throw sourceErrors.notFound("That page doesn't say who you are or what you do.");
				return result;
			},
		);
	} catch (error) {
		if (error instanceof SyntaxError)
			throw new ORPCError("BAD_REQUEST", {
				message: "The AI's answer couldn't be read. Try again, or choose another model.",
			});
		rethrowAiError(error, "The AI's answer wasn't in the expected format. Try again, or choose another model.");
	}
}
