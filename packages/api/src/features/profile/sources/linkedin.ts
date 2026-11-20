import type { SourceResult } from "@rezumi/schema/profile/sources";
import { env } from "@rezumi/env/server";
import { linkedInProfileNotes, parseLinkedInProfile } from "@rezumi/import/linkedin";
import { linkedInProfileId, linkedInProfileUrl } from "@rezumi/schema/profile/sources";
import { callTreg, isTregConfigured, TregError } from "../../jobs/treg";
import { sourceErrors } from "./errors";
import { consumeSourceLimit } from "./limits";
import { sourceDeadline, sourceResult, timedOut } from "./result";

/**
 * LinkedIn profiles are read by HarvestAPI, first through treg (`TREG_API_KEY`, the token job search uses) and, when
 * treg can't answer, through the same scraper as an Apify actor (`APIFY_TOKEN`, `APIFY_LINKEDIN_ACTOR`). Both answer
 * with the same profile shape. The person pastes their own profile's address. Only public profile details are asked
 * for, never the mode that searches for email addresses. Tokens go in headers, never in an address or a message, and
 * the profile read is neither stored nor logged.
 *
 * A profile that doesn't exist is an answer, not a failure: Apify would miss it too, so it isn't asked.
 */

/**
 * HarvestAPI's full profile (`GET /linkedin/profile`): all experience, education and skills, $0.0064 a call (the basic
 * `.main` tool keeps five jobs and two skills). Check `GET https://treg.to/catalog/endpoints/<tool>` before changing it.
 */
const TREG_TOOL = "harvestapi.linkedin.user.profile";
/** The most one treg read may cost, in US dollars. */
const TREG_MAX_COST_USD = 0.02;
/** How long treg may take; a profile takes a few seconds, a miss about five. */
const TREG_TIMEOUT_MS = 25_000;

/** The actor's mode without email search, at its price per thousand profiles. */
const APIFY_SCRAPER_MODE = "Profile details no email ($4 per 1k)";
/** Seconds the Apify run may take; a profile takes a few. */
const APIFY_RUN_TIMEOUT_SECONDS = 60;
/** The most one run may cost on the operator's Apify account, in US dollars: one profile is $0.004. */
const APIFY_MAX_CHARGE_USD = 0.05;

class ApifyError extends Error {
	constructor(readonly status: number) {
		super(`Apify answered ${status}`);
		this.name = "ApifyError";
	}
}

type LinkedInProfile = Record<string, unknown>;

/** Whether this server can read LinkedIn profiles at all. */
export const linkedInAvailable = () => isTregConfigured() || Boolean(env.APIFY_TOKEN);

const isRecord = (value: unknown): value is LinkedInProfile =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A found profile with a name, or null when the answer holds none. */
function namedProfile(value: unknown): LinkedInProfile | null {
	if (!isRecord(value)) return null;
	if (typeof value.status === "number" && value.status !== 200) return null;
	const named = [value.firstName, value.lastName].some((part) => typeof part === "string" && part.trim());
	return named ? value : null;
}

/** treg's answer is HarvestAPI's own: `{ element, status }`, with `element: null` and `status: 404` for a miss. */
async function readThroughTreg(profileUrl: string, signal: AbortSignal | undefined): Promise<LinkedInProfile | null> {
	const { data } = await callTreg<unknown>({
		tool: TREG_TOOL,
		query: { url: profileUrl },
		maxCostUsd: TREG_MAX_COST_USD,
		feature: "profile-linkedin",
		timeoutMs: TREG_TIMEOUT_MS,
		signal,
	});
	if (!isRecord(data)) throw new TregError("unavailable");
	if (typeof data.status === "number" && data.status !== 200) return null;
	return namedProfile(data.element);
}

async function runApifyActor(token: string, profileUrl: string, signal: AbortSignal): Promise<LinkedInProfile | null> {
	const query = new URLSearchParams({
		timeout: String(APIFY_RUN_TIMEOUT_SECONDS),
		maxItems: "1",
		maxTotalChargeUsd: String(APIFY_MAX_CHARGE_USD),
		format: "json",
		clean: "true",
	});
	const actor = encodeURIComponent(env.APIFY_LINKEDIN_ACTOR);
	const response = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?${query}`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify({ profileScraperMode: APIFY_SCRAPER_MODE, queries: [profileUrl] }),
		signal,
		redirect: "error",
	});
	if (!response.ok) {
		await response.body?.cancel().catch(() => {});
		throw new ApifyError(response.status);
	}
	const items: unknown = await response.json();
	return namedProfile(Array.isArray(items) ? items[0] : null);
}

const failedMessage = (slow: boolean) =>
	slow
		? "LinkedIn took too long to answer. Try again, or upload a file instead."
		: "LinkedIn couldn't be read just now. Try again later, or upload a file instead.";

/** Reads the person's LinkedIn profile into Profile data: details, summary, career and the profile under Profiles. */
export async function readLinkedIn(userId: string, address: string, signal?: AbortSignal): Promise<SourceResult> {
	const apifyToken = env.APIFY_TOKEN;
	const treg = isTregConfigured();
	if (!treg && !apifyToken) throw sourceErrors.unavailable("Reading LinkedIn profiles isn't set up on this server.");
	const id = linkedInProfileId(address);
	if (!id) throw sourceErrors.invalid("Paste the address of a LinkedIn profile, such as linkedin.com/in/your-name.");
	const profileUrl = linkedInProfileUrl(id);

	await consumeSourceLimit("linkedin", userId);
	let profile: LinkedInProfile | null | undefined;
	let tregSlow = false;
	if (treg) {
		try {
			profile = await readThroughTreg(profileUrl, signal);
		} catch (error) {
			signal?.throwIfAborted();
			tregSlow = error instanceof TregError && error.code === "timeout";
			const code = error instanceof TregError ? error.code : "unavailable";
			const reason = error instanceof TregError ? error.reason : undefined;
			// treg's own code only (a spent balance, a refused parameter): the server log never holds the token.
			console.warn("[profile-sources] treg couldn't read the LinkedIn profile", {
				code,
				reason,
				fallback: Boolean(apifyToken),
			});
			if (!apifyToken) throw sourceErrors.failed(failedMessage(tregSlow));
		}
	}

	if (profile === undefined && apifyToken) {
		try {
			profile = await runApifyActor(
				apifyToken,
				profileUrl,
				sourceDeadline((APIFY_RUN_TIMEOUT_SECONDS + 15) * 1000, signal),
			);
		} catch (error) {
			signal?.throwIfAborted();
			if (error instanceof ApifyError && error.status >= 400 && error.status < 500 && error.status !== 408)
				// The operator's token, plan or actor: worth a line in the server log, which never holds the token.
				console.warn("[profile-sources] Apify refused the LinkedIn run", { status: error.status });
			throw sourceErrors.failed(
				failedMessage(tregSlow || timedOut(error) || (error instanceof ApifyError && error.status === 408)),
			);
		}
	}

	if (!profile)
		throw sourceErrors.notFound("No public LinkedIn profile was found at that address. Check it, or upload a file.");
	try {
		return sourceResult(parseLinkedInProfile(profile), linkedInProfileNotes(profile));
	} catch {
		throw sourceErrors.failed("This LinkedIn profile couldn't be read. Upload a file instead.");
	}
}
