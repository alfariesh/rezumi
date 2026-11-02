import type { db } from "@rezumi/db/client";
import { eq } from "drizzle-orm";
import * as schema from "@rezumi/db/schema";

/** A transaction on the database client. Billing locks hold only inside one, so billing writes take nothing else. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Locks the account's billing row until the transaction ends, creating it first if needed. Every change to passes,
 * credits or payments, and every document-limit check, takes this lock first in the same transaction, so two devices
 * or a payment notification racing a status check apply one after the other.
 */
export async function lockBillingAccount(tx: Transaction, userId: string) {
	await tx.insert(schema.billingAccount).values({ userId }).onConflictDoNothing();
	const [account] = await tx
		.select()
		.from(schema.billingAccount)
		.where(eq(schema.billingAccount.userId, userId))
		.for("update");
	if (!account) throw new Error("The billing account row is missing after its insert.");
	return account;
}
