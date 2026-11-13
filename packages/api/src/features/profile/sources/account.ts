import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { sourceErrors } from "./errors";

export type SourceAccount = {
	name: string;
	email: string;
	image: string | null;
	isAnonymous: boolean;
	/** Linked sign-ins by provider ("github", "google", ...), with the provider's own ID for the person. */
	logins: { providerId: string; accountId: string }[];
};

/** The account as the sources see it: who it is and which sign-ins it has. Passwords are not sign-in providers. */
export async function readSourceAccount(userId: string): Promise<SourceAccount> {
	const [[owner], logins] = await Promise.all([
		db
			.select({
				name: schema.user.name,
				email: schema.user.email,
				image: schema.user.image,
				isAnonymous: schema.user.isAnonymous,
			})
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.limit(1),
		db
			.select({ providerId: schema.account.providerId, accountId: schema.account.accountId })
			.from(schema.account)
			.where(eq(schema.account.userId, userId)),
	]);
	return {
		name: owner?.name ?? "",
		email: owner?.email ?? "",
		image: owner?.image ?? null,
		isAnonymous: owner?.isAnonymous ?? false,
		logins: logins.filter((login) => login.providerId !== "credential"),
	};
}

/** Sources that read other sites for someone (LinkedIn, websites) need a signed-up account, not a guest. */
export async function assertNotGuest(userId: string) {
	const account = await readSourceAccount(userId);
	if (account.isAnonymous)
		throw sourceErrors.unavailable("Sign up to fill your Profile from this source. Guests can use GitHub or a file.");
	return account;
}
