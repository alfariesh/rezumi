import type { SourceResult } from "@rezumi/schema/profile/sources";
import { env } from "@rezumi/env/server";
import { linkedInProfileNotes, parseLinkedInProfile } from "@rezumi/import/linkedin";
import { linkedInProfileId, linkedInProfileUrl } from "@rezumi/schema/profile/sources";
import { sourceErrors } from "./errors";
import { consumeSourceLimit } from "./limits";
import { sourceDeadline, sourceResult, timedOut } from "./result";

/**
 * LinkedIn through an Apify actor (`APIFY_LINKEDIN_ACTOR`), run synchronously: one request starts the run and answers
 * with its dataset. The person pastes their own profile's address. The actor reads public profile details only: the
 * mode that searches for email addresses is never asked for. The token goes in a header, never in an address or a
 * message, and the profile read is neither stored nor logged.
 */

/** The actor's mode without email search, at its price per thousand profiles. */
export const LINKEDIN_SCRAPER_MODE = "Profile details no email ($4 per 1k)";
/** Seconds the run may take; a profile takes a few. */
const RUN_TIMEOUT_SECONDS = 60;
/** The most one run may cost on the operator's Apify account, in US dollars: one profile is $0.004. */
const MAX_CHARGE_USD = 0.05;

class ApifyError extends Error {
	constructor(readonly status: number) {
		super(`Apify answered ${status}`);
		this.name = "ApifyError";
	}
}

/** Whether this server can read LinkedIn profiles at all. */
export const linkedInAvailable = () => Boolean(env.APIFY_TOKEN);

async function runActor(token: string, profileUrl: string, signal: AbortSignal): Promise<unknown> {
	const query = new URLSearchParams({
		timeout: String(RUN_TIMEOUT_SECONDS),
		maxItems: "1",
		maxTotalChargeUsd: String(MAX_CHARGE_USD),
		format: "json",
		clean: "true",
	});
	const actor = encodeURIComponent(env.APIFY_LINKEDIN_ACTOR);
	const response = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?${query}`, {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify({ profileScraperMode: LINKEDIN_SCRAPER_MODE, queries: [profileUrl] }),
		signal,
		redirect: "error",
	});
	if (!response.ok) {
		await response.body?.cancel().catch(() => {});
		throw new ApifyError(response.status);
	}
	return await response.json();
}

/** The profile in an actor's answer: the first item, when it is a found profile with a name. */
function foundProfile(items: unknown): Record<string, unknown> | null {
	const first: unknown = Array.isArray(items) ? items[0] : null;
	if (!first || typeof first !== "object" || Array.isArray(first)) return null;
	const profile = first as Record<string, unknown>;
	if (typeof profile.status === "number" && profile.status !== 200) return null;
	const named = [profile.firstName, profile.lastName].some((part) => typeof part === "string" && part.trim());
	return named ? profile : null;
}

/** Reads the person's LinkedIn profile into Profile data: details, summary, career and the profile under Profiles. */
export async function readLinkedIn(userId: string, address: string, signal?: AbortSignal): Promise<SourceResult> {
	const token = env.APIFY_TOKEN;
	if (!token) throw sourceErrors.unavailable("Reading LinkedIn profiles isn't set up on this server.");
	const id = linkedInProfileId(address);
	if (!id) throw sourceErrors.invalid("Paste the address of a LinkedIn profile, such as linkedin.com/in/your-name.");

	await consumeSourceLimit("linkedin", userId);
	let items: unknown;
	try {
		items = await runActor(token, linkedInProfileUrl(id), sourceDeadline((RUN_TIMEOUT_SECONDS + 15) * 1000, signal));
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof ApifyError && error.status >= 400 && error.status < 500 && error.status !== 408)
			// The operator's token, plan or actor: worth a line in the server log, which never holds the token.
			console.warn("[profile-sources] Apify refused the LinkedIn run", { status: error.status });
		throw sourceErrors.failed(
			timedOut(error) || (error instanceof ApifyError && error.status === 408)
				? "LinkedIn took too long to answer. Try again, or upload a file instead."
				: "LinkedIn couldn't be read just now. Try again later, or upload a file instead.",
		);
	}

	const profile = foundProfile(items);
	if (!profile)
		throw sourceErrors.notFound("No public LinkedIn profile was found at that address. Check it, or upload a file.");
	try {
		return sourceResult(parseLinkedInProfile(profile), linkedInProfileNotes(profile));
	} catch {
		throw sourceErrors.failed("This LinkedIn profile couldn't be read. Upload a file instead.");
	}
}
