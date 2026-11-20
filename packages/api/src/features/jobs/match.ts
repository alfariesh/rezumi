import type { JobListingCard, JobListingMatch } from "@rezumi/schema/jobs/search";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { matchSkills } from "../career/matching";
import { readProfileContext } from "../profile/context";

/**
 * The free match chip on a listing (K8, `02-teknis.md` section 19): which of the skills the listing names the person's
 * Profile mentions. Worked out on the server when a result is answered, because the Profile isn't on the page; it
 * reads the Profile once per answer and calls nothing paid.
 */

/** Enough to reach a long Profile's Skills section, which comes after the career history. */
const PROFILE_MATCH_CHARS = 60_000;
/** Shared facts read for matching, newest first. */
const MAX_MATCH_FACTS = 300;

/** The person's Profile and their switched-on shared facts, as one text to look for skills in. */
export async function profileMatchText(userId: string): Promise<string> {
	const [profile, facts] = await Promise.all([
		readProfileContext(userId, db, PROFILE_MATCH_CHARS),
		db
			.select({ text: schema.careerFact.text })
			.from(schema.careerFact)
			.where(
				and(
					eq(schema.careerFact.userId, userId),
					isNull(schema.careerFact.applicationId),
					eq(schema.careerFact.status, "active"),
				),
			)
			.limit(MAX_MATCH_FACTS),
	]);
	return [profile?.text ?? "", ...facts.map((fact) => fact.text)].join("\n").trim();
}

/** Listing id → its skills against the Profile text, for listings that name skills. */
export function listingMatches(
	listings: Pick<JobListingCard, "id" | "skills">[],
	profileText: string,
): Record<string, JobListingMatch> {
	const matches: Record<string, JobListingMatch> = {};
	if (!profileText) return matches;
	for (const listing of listings) {
		const match = matchSkills(listing.skills, profileText);
		if (match) matches[listing.id] = match;
	}
	return matches;
}
