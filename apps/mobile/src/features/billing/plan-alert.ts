import type { PlanFeatures } from "@rezumi/schema/billing";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { Alert, Platform } from "react-native";
import { FREE_TEMPLATES } from "@rezumi/schema/billing";
import { templateName } from "@/features/design/presets";

// Kept apart from plan.ts, which reads the API: the API client shows these alerts and must not import itself.

export type PlanFeature = keyof PlanFeatures;

/**
 * Store rules (.agents/docs/plans/membership/00-keputusan-produk.md §6): Android shows plans and their limits without
 * selling them; iOS shows nothing about plans until In-App Purchase exists, only what the account can use. This is the
 * one switch the screens read.
 */
export const canShowPlans = () => Platform.OS === "android";

/** What a plan refusal was about: a document limit, or a feature. */
export type PlanProblem =
	| {
			kind: "limit";
			limit: "activeResumes" | "activeCoverLetters";
			max: number;
			requested: { resumes: number; coverLetters: number };
	  }
	| { kind: "feature"; feature: PlanFeature };

/** The plan problem behind a server error (PLAN_LIMIT_REACHED or PLAN_FEATURE_REQUIRED), else null. */
export function getPlanProblem(error: unknown): PlanProblem | null {
	if (!(error instanceof ORPCError)) return null;
	const data = (error.data ?? {}) as Record<string, unknown>;
	if (error.code === "PLAN_LIMIT_REACHED") {
		const requested = (data.requested ?? {}) as { resumes?: unknown; coverLetters?: unknown };
		return {
			kind: "limit",
			limit: data.limit === "activeCoverLetters" ? "activeCoverLetters" : "activeResumes",
			max: typeof data.max === "number" ? data.max : 0,
			requested: {
				resumes: typeof requested.resumes === "number" ? requested.resumes : 0,
				coverLetters: typeof requested.coverLetters === "number" ? requested.coverLetters : 0,
			},
		};
	}
	if (error.code === "PLAN_FEATURE_REQUIRED" && typeof data.feature === "string")
		return { kind: "feature", feature: data.feature as PlanFeature };
	return null;
}

const freeTemplateList = () => FREE_TEMPLATES.map(templateName).join(", ");

/**
 * A plan problem in neutral words: what happened and the free way on. Never a price, a link or a way to buy; iOS
 * doesn't mention plans at all.
 */
export function describePlanProblem(problem: PlanProblem): { title: string; message: string } {
	const ios = !canShowPlans();
	if (problem.kind === "limit") {
		const { max } = problem;
		const several = problem.requested.resumes > 0 && problem.requested.coverLetters > 0;
		const room =
			problem.limit === "activeResumes"
				? t`You can keep up to ${max} resumes outside Trash. Move one you don't need to Trash to make room; you can restore it later.`
				: t`You can keep up to ${max} cover letters outside Trash. Move one you don't need to Trash to make room; you can restore it later.`;
		return {
			title: problem.limit === "activeResumes" ? t`No room for another resume` : t`No room for another cover letter`,
			message: several
				? `${t`This file holds a resume and its cover letters, and they're saved together.`} ${room}`
				: room,
		};
	}
	switch (problem.feature) {
		case "premiumTemplates":
			return {
				title: ios ? t`This template isn't available` : t`This template isn't in your plan`,
				message: t`${freeTemplateList()} are available, and documents that already use another template keep it.`,
			};
		case "wordOdtExport":
			return {
				title: ios ? t`Word and ODT aren't available` : t`Word and ODT downloads aren't in your plan`,
				message: t`Download a PDF instead: it keeps your design exactly. Markdown and JSON are available too.`,
			};
		case "customStyles":
			return {
				title: ios ? t`Custom styles aren't available` : t`Custom styles aren't in your plan`,
				message: t`Styles you already saved keep working. Design covers templates, fonts, colors and spacing.`,
			};
		case "customFonts":
			return {
				title: ios ? t`Your own fonts aren't available` : t`Your own fonts aren't in your plan`,
				message: t`Choose any of the fonts in Design instead.`,
			};
		case "automationApi":
			return {
				title: ios ? t`API and MCP access isn't available` : t`API and MCP access isn't in your plan`,
				message: t`This app always works. Other apps and assistants that connect with an API key need more.`,
			};
	}
}

/**
 * Explains a plan problem in the platform's alert. Android adds one informative sentence about where plans are sold,
 * with no link or button (Google Play allows that; Apple doesn't, so iOS says nothing about it).
 */
export function showPlanAlert(problem: PlanProblem) {
	const { title, message } = describePlanProblem(problem);
	const where = canShowPlans() ? `\n\n${t`Plans can be bought on the rezumi.app website.`}` : "";
	Alert.alert(title, `${message}${where}`, [{ text: t`OK` }]);
}

/** Shows the plan alert when `error` is a plan refusal from the server; returns whether it did. */
export function showPlanAlertForError(error: unknown) {
	const problem = getPlanProblem(error);
	if (problem) showPlanAlert(problem);
	return problem !== null;
}
