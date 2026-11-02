import type { Transaction } from "./account";
import type { DbOrTx } from "@rezumi/db/client";
import type { PlanFeatures, PlanId } from "@rezumi/schema/billing";
import type { Template } from "@rezumi/schema/templates";
import { ORPCError } from "@orpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { FREE_TEMPLATES, isFreeTemplate } from "@rezumi/schema/billing";
import { lockBillingAccount } from "./account";
import { getBillingMode, getEntitlements } from "./entitlements";

export type PlanLimit = "activeResumes" | "activeCoverLetters";
export type PlanFeature = keyof PlanFeatures;

/** New documents a write makes: resumes and cover letters that won't be in Trash. */
export type DocumentRequest = { resumes?: number; coverLetters?: number };

/** Documents that count against a plan's limits: those not in Trash. */
export async function countActiveDocuments(userId: string, database: DbOrTx = db) {
	const [[resumes], [coverLetters]] = await Promise.all([
		database
			.select({ total: count() })
			.from(schema.resume)
			.where(and(eq(schema.resume.userId, userId), isNull(schema.resume.trashedAt))),
		database
			.select({ total: count() })
			.from(schema.coverLetter)
			.where(and(eq(schema.coverLetter.userId, userId), isNull(schema.coverLetter.trashedAt))),
	]);
	return { activeResumes: resumes?.total ?? 0, activeCoverLetters: coverLetters?.total ?? 0 };
}

const counted = (total: number, one: string, other: string) => `${total} ${total === 1 ? one : other}`;

function describeRequest(request: Required<DocumentRequest>) {
	const parts = [
		request.resumes > 0 ? counted(request.resumes, "resume", "resumes") : "",
		request.coverLetters > 0 ? counted(request.coverLetters, "cover letter", "cover letters") : "",
	];
	return parts.filter(Boolean).join(" and ");
}

/**
 * Making documents past the plan's limit. Messages stay neutral (no prices, no buying, no links) because the iOS and
 * Android apps show them as they are; the web adds its own way to see plans from the code.
 */
export function planLimitReached(input: {
	limit: PlanLimit;
	max: number;
	used: number;
	planId: PlanId;
	requested: Required<DocumentRequest>;
}) {
	const [one, other] = input.limit === "activeResumes" ? ["resume", "resumes"] : ["cover letter", "cover letters"];
	const adding = input.limit === "activeResumes" ? input.requested.resumes : input.requested.coverLetters;
	const several = adding > 1 || (input.requested.resumes > 0 && input.requested.coverLetters > 0);
	const message = several
		? `This adds ${describeRequest(input.requested)}, which goes over the limit of ${input.max} active ${other} (${input.used} in use). Move documents you don't need to Trash, then try again.`
		: `The limit of ${input.max} active ${other} is reached. Move a ${one} to Trash to make a new one.`;
	return new ORPCError("PLAN_LIMIT_REACHED", {
		status: 403,
		message,
		data: { limit: input.limit, max: input.max, used: input.used, planId: input.planId, requested: input.requested },
	});
}

const freeTemplateNames = FREE_TEMPLATES.map((id) => id.charAt(0).toUpperCase() + id.slice(1));

function featureMessage(feature: PlanFeature) {
	switch (feature) {
		case "premiumTemplates":
			return `This template isn't included in your plan. Choose one of ${freeTemplateNames.slice(0, -1).join(", ")} or ${freeTemplateNames.at(-1)}. Documents that already use a template keep it.`;
		case "wordOdtExport":
			return "Word and ODT downloads aren't included in your plan. Download a PDF, Markdown or JSON file instead.";
		case "customStyles":
			return "Custom styles aren't included in your plan. Styles already saved keep working, and the Design controls cover other changes.";
		case "customFonts":
			return "Uploading your own fonts isn't included in your plan. Choose one of the fonts in Design instead.";
		case "automationApi":
			// Only third-party apps see this (never Rezumi's own), so it may point at the plans page on the web.
			return `Connecting apps through the Rezumi API or MCP needs the Plus or Pro AI plan. Open ${new URL("/dashboard/settings/billing", env.APP_URL).href} to see your plan.`;
	}
}

/** Using a feature the account's plan doesn't include. */
export function planFeatureRequired(feature: PlanFeature, planId: PlanId) {
	return new ORPCError("PLAN_FEATURE_REQUIRED", {
		status: 403,
		message: featureMessage(feature),
		data: { feature, planId },
	});
}

/** Throws PLAN_FEATURE_REQUIRED unless the account's plan includes `feature` (or plans don't apply to it). */
export async function assertFeature(userId: string, feature: PlanFeature, database: DbOrTx = db) {
	const entitlements = await getEntitlements(userId, new Date(), database);
	if (entitlements.enabled && !entitlements.features[feature]) throw planFeatureRequired(feature, entitlements.planId);
}

/**
 * Throws PLAN_LIMIT_REACHED when making `request` would take the account past its plan's active-document limits.
 * Call it in the transaction that inserts or restores the documents, before the write: it takes the billing lock, so
 * parallel requests count one after the other and can't pass the limit together. Documents already there are never
 * touched, and nothing is read or locked while plans don't apply to the account.
 */
export async function assertDocumentCapacity(
	tx: Transaction,
	userId: string,
	request: DocumentRequest,
	now = new Date(),
) {
	const requested = { resumes: request.resumes ?? 0, coverLetters: request.coverLetters ?? 0 };
	if (requested.resumes + requested.coverLetters <= 0) return;
	const entitlements = await getEntitlements(userId, now, tx);
	if (!entitlements.enabled) return;

	await lockBillingAccount(tx, userId);
	const used = await countActiveDocuments(userId, tx);
	for (const [limit, adding] of [
		["activeResumes", requested.resumes],
		["activeCoverLetters", requested.coverLetters],
	] as const) {
		const max = entitlements.limits[limit];
		if (adding > 0 && max !== null && used[limit] + adding > max)
			throw planLimitReached({ limit, max, used: used[limit], planId: entitlements.planId, requested });
	}
}

/** The same check before slow work, such as an AI call that ends in a new document; the save checks again. */
export async function precheckDocumentCapacity(userId: string, request: DocumentRequest) {
	if (getBillingMode() === "off") return;
	await db.transaction((tx) => assertDocumentCapacity(tx, userId, request));
}

/** The parts of a resume's or letter's design a plan governs. */
export type PlanDesign = {
	template: Template;
	stylesheet?: { source: { text: string } } | undefined;
};

/** A design as stored, before validation: older rows may hold anything. */
export type StoredDesign = { template?: unknown; stylesheet?: unknown } | null | undefined;

function stylesheetText(design: StoredDesign) {
	const source = (design?.stylesheet as { source?: { text?: unknown } } | null | undefined)?.source;
	return typeof source?.text === "string" ? source.text.trim() : "";
}

/**
 * The features a design change needs: a premium template chosen anew, or custom styles added or changed. Keeping a
 * premium template or saved styles, removing styles, and moving to a free template need nothing.
 */
export function designFeaturesNeeded(before: StoredDesign, after: PlanDesign): PlanFeature[] {
	const needed: PlanFeature[] = [];
	if (!isFreeTemplate(after.template) && after.template !== before?.template) needed.push("premiumTemplates");
	const styles = stylesheetText(after);
	if (styles && styles !== stylesheetText(before)) needed.push("customStyles");
	return needed;
}

/** Throws PLAN_FEATURE_REQUIRED when a write changes the design in a way the plan doesn't include. */
export async function assertDesignChange(
	userId: string,
	before: StoredDesign,
	after: PlanDesign,
	database: DbOrTx = db,
) {
	const needed = designFeaturesNeeded(before, after);
	if (needed.length === 0) return;
	const entitlements = await getEntitlements(userId, new Date(), database);
	if (!entitlements.enabled) return;
	const missing = needed.find((feature) => !entitlements.features[feature]);
	if (missing) throw planFeatureRequired(missing, entitlements.planId);
}

/**
 * An imported file's design, fitted to the plan: a premium template becomes the first free one and custom styles are
 * left out, so the import still succeeds. Returns what changed, for the app to tell the user. Mutates `design`.
 */
export async function fitImportedDesign(userId: string, design: PlanDesign, database: DbOrTx = db) {
	const changed = { template: false, stylesheet: false };
	const needed = designFeaturesNeeded(null, design);
	if (needed.length === 0) return changed;
	const entitlements = await getEntitlements(userId, new Date(), database);
	if (!entitlements.enabled) return changed;
	if (needed.includes("premiumTemplates") && !entitlements.features.premiumTemplates) {
		design.template = FREE_TEMPLATES[0];
		changed.template = true;
	}
	if (needed.includes("customStyles") && !entitlements.features.customStyles) {
		delete design.stylesheet;
		changed.stylesheet = true;
	}
	return changed;
}
