import type { DbOrTx } from "@rezumi/db/client";
import type { PortfolioEditPlan, PortfolioUpload } from "@rezumi/portfolio/edits";
import type { PlanId } from "@rezumi/schema/billing";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { getEntitlements, isBillingAppliedTo } from "../billing/entitlements";
import { OVERDUE } from "./file-store";

/**
 * What AI editing needs besides the portfolio's data (Phase 14, `phase-14-asisten-ai.md` §4.3): the plan the edit
 * engine checks before a save would, and the pictures uploaded but not placed yet, which an edit may place.
 */

const PLAN_NAMES: Record<PlanId, string> = { free: "Free", plus: "Plus", "pro-ai": "Pro AI" };

/**
 * What the account's plan allows a portfolio, for the edit engine to refuse a change before the save would (the save
 * still checks: `assertPortfolioPlan`). Null while plans don't apply to the account; reads nothing more then.
 */
export async function portfolioEditPlan(userId: string, client: DbOrTx = db): Promise<PortfolioEditPlan> {
	if (!(await isBillingAppliedTo(userId, client))) return null;
	const entitlements = await getEntitlements(userId, new Date(), client);
	return {
		maxWorks: entitlements.limits.portfolioWorks,
		features: {
			premiumPortfolioThemes: entitlements.features.premiumPortfolioThemes,
			premiumHeroEffects: entitlements.features.premiumHeroEffects,
			hidePortfolioCredit: entitlements.features.hidePortfolioCredit,
		},
		name: PLAN_NAMES[entitlements.planId],
	};
}

/** The most uploads not placed yet that AI is shown, newest first; older ones wait for the cleanup job. */
const MAX_UPLOADS = 40;

/** A picture's small copy: `<id>-sm.<ext>` beside `<id>.<ext>` (`uploadImage`). */
const THUMBNAIL = /^(.+)-sm\.(?:webp|jpe?g|png)$/;
const withoutExtension = (key: string) => key.replace(/\.[^./]+$/, "");

/**
 * The account's uploaded pictures that no saved data uses (recorded in `portfolio_file`, waiting out the grace
 * period), as images an edit may place, each with its small copy when it has one. Files already due for deletion
 * aren't offered: a save would refuse them.
 */
export async function unplacedUploads(userId: string, client: DbOrTx = db): Promise<PortfolioUpload[]> {
	const file = schema.portfolioFile;
	const rows = await client
		.select({ key: file.key, width: file.width, height: file.height, createdAt: file.createdAt })
		.from(file)
		.where(and(eq(file.userId, userId), eq(file.kind, "image"), gt(file.unusedSince, OVERDUE)))
		.orderBy(desc(file.createdAt))
		.limit(MAX_UPLOADS * 2);
	const thumbnails = new Map(
		rows.flatMap((row) => {
			const match = THUMBNAIL.exec(row.key);
			return match?.[1] ? [[match[1], row.key] as const] : [];
		}),
	);
	return rows
		.filter((row) => !THUMBNAIL.test(row.key) && row.width && row.height)
		.slice(0, MAX_UPLOADS)
		.map((row) => {
			const thumbKey = thumbnails.get(withoutExtension(row.key));
			return {
				key: row.key,
				width: row.width as number,
				height: row.height as number,
				alt: "",
				...(thumbKey ? { thumbKey } : {}),
				uploadedAt: row.createdAt.toISOString(),
			};
		});
}
