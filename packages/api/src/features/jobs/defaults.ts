import type { JobSearchDefaults } from "@rezumi/schema/jobs/search";
import { careerService } from "../career/service";
import { searchScope } from "./regions";

/** A preferred place that means "remote", not a city: "Remote", "Remote (EU)", "Fully remote". */
const REMOTE_PLACE = /\bremote\b/i;

/**
 * Where the Jobs page starts (`01-desain.md` section 1): the first role and place from the career preferences and the
 * country searches target (`searchRegions`, else the account time zone's). A preferred place that only says "remote"
 * becomes the remote filter instead of a city.
 */
export async function jobSearchDefaults(userId: string, deviceTimeZone?: string): Promise<JobSearchDefaults> {
	const [profile, scope] = await Promise.all([careerService.profile(userId), searchScope(userId, deviceTimeZone)]);
	const roles = profile.targetRoles.map((role) => role.trim()).filter((role) => role.length >= 2);
	const place = scope.locations.find((location) => location.trim()) ?? "";
	const remote = REMOTE_PLACE.test(place);
	return {
		query: roles[0] ?? "",
		location: remote ? "" : place.trim(),
		country: scope.regions[0] ?? "",
		remote: remote ? "only" : "any",
		suggestions: roles.slice(0, 3),
	};
}
