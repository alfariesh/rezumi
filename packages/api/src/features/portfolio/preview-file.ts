import { createHmac } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { safeEquals } from "../resume/access";
import { ownerIsNotBanned } from "../resume/access-policy";
import { getPortfolioMode, isPortfolioEnabledFor } from "./mode";

export const PORTFOLIO_PREVIEW_FILE_PARAM = "preview";
export const PORTFOLIO_PREVIEW_FILE_TTL_MS = 10 * 60 * 1000;

const sign = (key: string, expires: number) =>
	createHmac("sha256", env.AUTH_SECRET)
		.update(JSON.stringify(["rezumi:portfolio-preview-file:v1", key, expires]))
		.digest("hex");

export function portfolioPreviewFileToken(key: string, expires: number): string {
	return `${expires}.${sign(key, expires)}`;
}

/** A preview URL grants read access to exactly one still-used file, until it expires. */
export async function canReadPortfolioPreviewFile(key: string, value: string, now = Date.now()): Promise<boolean> {
	const match = /^(\d{1,16})\.[a-f0-9]{64}$/.exec(value);
	const expires = Number(match?.[1]);
	if (!Number.isSafeInteger(expires) || expires <= now || !safeEquals(value, portfolioPreviewFileToken(key, expires)))
		return false;

	const mode = getPortfolioMode();
	if (mode === "off") return false;
	const [row] = await db
		.select({ role: schema.user.role, isAnonymous: schema.user.isAnonymous })
		.from(schema.portfolioFile)
		.innerJoin(schema.user, eq(schema.portfolioFile.userId, schema.user.id))
		.innerJoin(schema.portfolio, eq(schema.portfolioFile.userId, schema.portfolio.userId))
		.where(and(eq(schema.portfolioFile.key, key), isNull(schema.portfolioFile.unusedSince), ownerIsNotBanned()))
		.limit(1);
	return !!row && isPortfolioEnabledFor(row, mode);
}
