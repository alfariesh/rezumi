import type { SourceResult } from "@rezumi/schema/profile/sources";
import { providerAccessToken } from "@rezumi/auth/config";
import { env } from "@rezumi/env/server";
import { parseGitHubProfile } from "@rezumi/import/github";
import { gitHubLogin } from "@rezumi/schema/profile/sources";
import { sourceErrors } from "./errors";
import { consumeSourceLimit } from "./limits";
import { sourceDeadline, sourceResult } from "./result";

/**
 * GitHub through its official REST API: the account (`/users/{login}`) and its own repositories, most recently pushed
 * first. Requests carry the GitHub token of the person's own GitHub sign-in when they have one, else the server's
 * `GITHUB_API_TOKEN`, else none (GitHub's anonymous limit). Only public data is read.
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_DEADLINE_MS = 15_000;

class GitHubError extends Error {
	constructor(readonly status: number) {
		super(`GitHub answered ${status}`);
		this.name = "GitHubError";
	}
}

/** Tokens to try in order: the person's own, the server's, then none. A token GitHub refuses moves to the next. */
async function gitHubTokens(userId: string): Promise<(string | null)[]> {
	const own = await providerAccessToken(userId, "github");
	return [...new Set([own, env.GITHUB_API_TOKEN ?? null, null])];
}

async function gitHubJson(path: string, tokens: (string | null)[], signal: AbortSignal): Promise<unknown> {
	for (const [index, token] of tokens.entries()) {
		const response = await fetch(`${GITHUB_API}${path}`, {
			headers: {
				accept: "application/vnd.github+json",
				"x-github-api-version": "2022-11-28",
				// GitHub refuses requests without one; generic, with nothing about the person asking.
				"user-agent": "Rezumi",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			signal,
			redirect: "error",
		});
		if (response.ok) return await response.json();
		await response.body?.cancel().catch(() => {});
		if (response.status === 401 && index < tokens.length - 1) continue;
		throw new GitHubError(response.status);
	}
	throw new GitHubError(401);
}

/** Reads a GitHub account into Profile data: details, the account under Profiles, projects and languages as skills. */
export async function readGitHub(userId: string, username: string, signal?: AbortSignal): Promise<SourceResult> {
	const login = gitHubLogin(username);
	if (!login) throw sourceErrors.invalid("Enter a GitHub username, such as octocat.");

	await consumeSourceLimit("github", userId);
	const deadline = sourceDeadline(GITHUB_DEADLINE_MS, signal);
	const tokens = await gitHubTokens(userId);
	const name = encodeURIComponent(login);
	try {
		const user = await gitHubJson(`/users/${name}`, tokens, deadline);
		// The account's own repositories, most recently pushed first: forks and archives are left out when mapping.
		const repos = await gitHubJson(`/users/${name}/repos?type=owner&sort=pushed&per_page=100`, tokens, deadline);
		const data = parseGitHubProfile({ user, repos });
		return sourceResult(data, data.sections.projects.items.length === 0 ? ["no-public-repos"] : []);
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof GitHubError && error.status === 404)
			throw sourceErrors.notFound("There's no GitHub account with that username.");
		if (error instanceof GitHubError && (error.status === 403 || error.status === 429))
			throw sourceErrors.failed("GitHub is limiting requests right now. Try again in an hour.");
		throw sourceErrors.failed("GitHub couldn't be read just now. Try again in a moment.");
	}
}

/** The login of the GitHub account linked to this account, by its GitHub ID; null when there's none or GitHub fails. */
export async function linkedGitHubLogin(userId: string, gitHubId: string | undefined): Promise<string | null> {
	if (!gitHubId || !/^\d+$/.test(gitHubId)) return null;
	try {
		const user = await gitHubJson(`/user/${gitHubId}`, await gitHubTokens(userId), sourceDeadline(5_000));
		const login = (user as { login?: unknown } | null)?.login;
		return typeof login === "string" ? gitHubLogin(login) : null;
	} catch {
		return null;
	}
}
