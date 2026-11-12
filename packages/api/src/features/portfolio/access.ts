import type { DbOrTx } from "@rezumi/db/client";
import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { portfolioErrors } from "./errors";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";

// Who may use portfolios, shared by the owner's procedures (`service.ts`, `media.ts`).

export type Account = { role: string | null; isAnonymous: boolean; emailVerified: boolean };

async function loadAccount(userId: string, client: DbOrTx = db): Promise<Account | null> {
	const [account] = await client
		.select({ role: schema.user.role, isAnonymous: schema.user.isAnonymous, emailVerified: schema.user.emailVerified })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	return account ?? null;
}

/** The account, when portfolios are open to it. Reads nothing while the mode is off. */
export async function enabledAccount(userId: string): Promise<Account | null> {
	const mode = getPortfolioMode();
	if (mode === "off") return null;
	const account = await loadAccount(userId);
	return account && isPortfolioEnabledFor(account, mode) ? account : null;
}

/** The account, when portfolios are open to it; `PORTFOLIO_DISABLED` otherwise. */
export async function requireEnabled(userId: string): Promise<Account> {
	const account = await enabledAccount(userId);
	if (!account) throw portfolioErrors.disabled();
	return account;
}

/** The account has a portfolio; `NOT_FOUND` otherwise. */
export async function requirePortfolio(userId: string): Promise<void> {
	const [portfolio] = await db
		.select({ id: schema.portfolio.id })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	if (!portfolio) throw portfolioErrors.notFound();
}
