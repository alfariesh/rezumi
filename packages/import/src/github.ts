import type { ResumeData } from "@rezumi/schema/resume/data";
import z from "zod";
import { getNetworkIcon } from "@rezumi/resume/icons";
import { resumeDataSchema } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { generateId } from "@rezumi/utils/string";
import { rethrowAsImportError } from "./error";
import { toHtmlDescription } from "./html";

/** How many repositories become projects, and how many languages become skills. */
export const GITHUB_PROJECTS = 6;
export const GITHUB_SKILLS = 10;

// Only the fields used here; GitHub's answers carry many more. Anything missing or of another type reads as empty.
const text = z.string().trim().catch("");
const optionalText = z.string().trim().nullish().catch(null);

const userSchema = z.object({
	login: text,
	name: optionalText,
	bio: optionalText,
	blog: optionalText,
	location: optionalText,
	email: optionalText,
	html_url: optionalText,
	twitter_username: optionalText,
});

const repoSchema = z.object({
	name: text,
	description: optionalText,
	html_url: optionalText,
	homepage: optionalText,
	language: optionalText,
	fork: z.boolean().catch(false),
	archived: z.boolean().catch(false),
	stargazers_count: z.number().catch(0),
	pushed_at: optionalText,
	owner: z.object({ login: text }).catch({ login: "" }),
});

type Repo = z.infer<typeof repoSchema>;

/** An http(s) address as written, with https:// added when it has no scheme; empty when it isn't one. */
function webAddress(value: string | null | undefined): string {
	const written = value?.trim() ?? "";
	if (!written || /\s/.test(written)) return "";
	try {
		const url = new URL(/^[a-z][\d+.a-z-]*:\/\//i.test(written) ? written : `https://${written}`);
		return /^https?:$/.test(url.protocol) ? url.toString() : "";
	} catch {
		return "";
	}
}

/** The account's own repositories worth showing: not forks, not archived, most starred first, then most recent. */
function ownRepos(login: string, repos: Repo[]): Repo[] {
	return repos
		.filter(
			(repo) => repo.name && !repo.fork && !repo.archived && repo.owner.login.toLowerCase() === login.toLowerCase(),
		)
		.sort(
			(a, b) =>
				b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at ?? "") - Date.parse(a.pushed_at ?? "") || 0,
		);
}

/**
 * Converts a GitHub account (`GET /users/{login}`) and its repositories (`GET /users/{login}/repos`) into ResumeData:
 * name, bio as the summary, location, website and public email; the account under Profiles; the six best own
 * repositories as projects; and the ten languages used most across them as skills.
 */
export function parseGitHubProfile(input: { user: unknown; repos: unknown }): ResumeData {
	const user = userSchema.parse(input.user && typeof input.user === "object" ? input.user : {});
	const repos = ownRepos(
		user.login,
		(Array.isArray(input.repos) ? input.repos : []).flatMap((repo) => {
			const parsed = repoSchema.safeParse(repo);
			return parsed.success ? [parsed.data] : [];
		}),
	);
	const result: ResumeData = structuredClone(defaultResumeData);

	result.basics = {
		...defaultResumeData.basics,
		name: user.name || user.login,
		location: user.location ?? "",
		email: user.email ?? "",
		website: { url: webAddress(user.blog), label: "" },
		customFields: [],
	};
	if (user.bio) result.summary = { ...defaultResumeData.summary, content: toHtmlDescription(user.bio), hidden: false };

	const profileUrl = webAddress(user.html_url) || (user.login ? `https://github.com/${user.login}` : "");
	result.sections.profiles.items = [
		...(user.login ? [{ network: "GitHub", username: user.login, url: profileUrl }] : []),
		...(user.twitter_username
			? [{ network: "X", username: user.twitter_username, url: `https://x.com/${user.twitter_username}` }]
			: []),
	].map((profile) => ({
		id: generateId(),
		hidden: false,
		icon: getNetworkIcon(profile.network),
		iconColor: "",
		network: profile.network,
		username: profile.username,
		website: { url: profile.url, label: profile.username, inlineLink: false },
	}));

	result.sections.projects.items = repos.slice(0, GITHUB_PROJECTS).map((repo) => ({
		id: generateId(),
		hidden: false,
		name: repo.name,
		period: "",
		website: { url: webAddress(repo.homepage) || webAddress(repo.html_url), label: "", inlineLink: false },
		description: toHtmlDescription(repo.description ?? undefined),
	}));

	// Languages by how many of the account's own repositories use them, the most used first.
	const counts = new Map<string, number>();
	for (const repo of repos) if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
	result.sections.skills.items = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, GITHUB_SKILLS)
		.map(([name]) => ({
			id: generateId(),
			hidden: false,
			icon: "star",
			iconColor: "",
			name,
			proficiency: "",
			level: 0,
			keywords: [],
		}));

	try {
		return resumeDataSchema.parse(result);
	} catch (error) {
		rethrowAsImportError(error);
	}
}
