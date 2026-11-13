import z from "zod";
import { profileDataSchema } from "./data";

/**
 * Filling the Profile from outside sources (`profile.sources.*`): a LinkedIn profile, a GitHub account, a personal
 * website. Each source returns a draft in the Profile's own shape; nothing is saved until the person reviews it.
 */

/**
 * Short codes a source adds to its result, for the app to explain what it found:
 * - `private-profile`: the LinkedIn profile showed little more than a name, as a profile hidden from the public does.
 * - `no-public-repos`: the GitHub account has no public repositories of its own, so no projects came from it.
 * - `truncated`: the page was longer than what was read, so the end of it was left out.
 */
export const SOURCE_NOTES = ["private-profile", "no-public-repos", "truncated"] as const;

export type SourceNote = (typeof SOURCE_NOTES)[number];

export const sourceResultSchema = z.object({
	data: profileDataSchema.describe(
		"What the source holds, as Profile data: only what was found, everything else empty. Items have IDs.",
	),
	photoUrl: z
		.string()
		.nullable()
		.describe("The person's photo at the source, not copied yet: pass it to `adoptPhoto` to keep it."),
	notes: z.array(z.string()).describe("Short codes about the result (see SOURCE_NOTES)."),
});

export type SourceResult = z.infer<typeof sourceResultSchema>;

export const sourcesStatusSchema = z.object({
	linkedin: z
		.boolean()
		.describe("Whether LinkedIn profiles can be read: the server has an Apify token and the account isn't a guest."),
	github: z.boolean().describe("Whether GitHub accounts can be read. Always true."),
	website: z.boolean().describe("Whether personal websites can be read: the account isn't a guest."),
	account: z.object({
		name: z.string().describe("The account's name; empty for a guest."),
		email: z.string().describe("The account's email address; empty for a guest."),
		image: z.string().nullable().describe("The account's photo, from a sign-in provider or an upload."),
		githubUsername: z.string().nullable().describe("The login of the GitHub account linked to this account, if any."),
		providers: z.array(z.string()).describe('The sign-in providers linked to the account: "github", "google", ...'),
	}),
});

export type SourcesStatus = z.infer<typeof sourcesStatusSchema>;

// LinkedIn's public profile addresses: www., a country (id., uk.) or no subdomain, then /in/<public identifier>.
const LINKEDIN_HOST = /^(?:[a-z]{2,3}\.|www\.)?linkedin\.com$/;
// Letters of any script, digits, dashes and underscores; LinkedIn allows 3 to 100 characters.
const LINKEDIN_ID = /^[\p{L}\p{N}_-]{3,100}$/u;

/**
 * The public identifier of a LinkedIn profile address (`linkedin.com/in/<id>`, with or without https:// and www.),
 * or of a bare identifier. Null for anything else: another site, a company page, a search.
 */
export function linkedInProfileId(input: string): string | null {
	const text = input.trim();
	if (!text || text.length > 300 || /\s/.test(text)) return null;
	if (!/[/.:]/.test(text)) return LINKEDIN_ID.test(text) ? text : null;

	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
	if (!LINKEDIN_HOST.test(url.hostname.toLowerCase())) return null;

	const match = /^\/in\/([^/]+)\/?$/.exec(url.pathname);
	if (!match?.[1]) return null;
	let id: string;
	try {
		id = decodeURIComponent(match[1]);
	} catch {
		return null;
	}
	return LINKEDIN_ID.test(id) ? id : null;
}

/** The address Apify is asked for: the canonical form of a LinkedIn profile. */
export const linkedInProfileUrl = (id: string) => `https://www.linkedin.com/in/${encodeURIComponent(id)}`;

// GitHub logins: 1 to 39 letters, digits or dashes, not starting with a dash.
const GITHUB_LOGIN = /^[a-z\d][a-z\d-]{0,38}$/i;

/**
 * A GitHub login from what someone typed: `octocat`, `@octocat`, or `github.com/octocat` with or without https://.
 * Null for anything else.
 */
export function gitHubLogin(input: string): string | null {
	const text = input.trim().replace(/^@/, "");
	if (!text || text.length > 200 || /\s/.test(text)) return null;
	if (!/[/.:]/.test(text)) return GITHUB_LOGIN.test(text) ? text : null;

	let url: URL;
	try {
		url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
	if (!/^(?:www\.)?github\.com$/.test(url.hostname.toLowerCase())) return null;
	const match = /^\/([^/]+)\/?$/.exec(url.pathname);
	return match?.[1] && GITHUB_LOGIN.test(match[1]) ? match[1] : null;
}
