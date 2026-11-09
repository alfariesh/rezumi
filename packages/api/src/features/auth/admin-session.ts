import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";

/** The owner's tools: web sessions of accounts with the admin role only, the role read from the database. */
export async function assertAdminSession(authentication: { user: { id: string }; method: string } | null | undefined) {
	if (authentication?.method !== "session")
		throw new ORPCError("FORBIDDEN", { message: "Admin tools are only available in a web browser." });
	const [account] = await db
		.select({ role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, authentication.user.id));
	if (account?.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Only administrators can do this." });
}
