import type { SourcesStatus } from "@rezumi/schema/profile/sources";
import { readSourceAccount } from "./account";
import { linkedGitHubLogin } from "./github";
import { linkedInAvailable } from "./linkedin";

/** Which sources this account can use, and what its sign-ins already tell (name, email, photo, GitHub login). */
export async function sourcesStatus(userId: string): Promise<SourcesStatus> {
	const account = await readSourceAccount(userId);
	const guest = account.isAnonymous;
	const gitHubId = account.logins.find((login) => login.providerId === "github")?.accountId;
	return {
		linkedin: linkedInAvailable() && !guest,
		github: true,
		website: !guest,
		account: {
			// A guest's name and address are generated, not theirs.
			name: guest ? "" : account.name.trim(),
			email: guest ? "" : account.email.trim(),
			image: account.image?.trim() || null,
			githubUsername: guest ? null : await linkedGitHubLogin(userId, gitHubId),
			providers: [...new Set(account.logins.map((login) => login.providerId))],
		},
	};
}
