import type { PlanFeatures } from "@rezumi/schema/billing";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { Alert } from "react-native";
import { templateName } from "@rezumi/resume/design-presets";
import { FREE_TEMPLATES } from "@rezumi/schema/billing";

// Kept apart from plan.ts, which reads the API: the API client shows these alerts and must not import itself.

export type PlanFeature = keyof PlanFeatures;

/** What a plan refusal was about: a document limit, or a feature. */
export type PlanProblem =
	| {
			kind: "limit";
			limit: "activeResumes" | "activeCoverLetters";
			max: number;
			requested: { resumes: number; coverLetters: number };
	  }
	| { kind: "feature"; feature: PlanFeature };

/**
 * The plan problem behind a server error (a document PLAN_LIMIT_REACHED or PLAN_FEATURE_REQUIRED), else null. A
 * refusal that names no limit is read as the document limits always were: the resumes.
 */
export function getPlanProblem(error: unknown): PlanProblem | null {
	if (!(error instanceof ORPCError)) return null;
	const data = (error.data ?? {}) as Record<string, unknown>;
	// Only the document limits are explained here; the screens that meet the others (today's job searches, job
	// alerts) say so in place, so the client's alert stays out of their way.
	if (
		error.code === "PLAN_LIMIT_REACHED" &&
		[undefined, "activeResumes", "activeCoverLetters"].includes(data.limit as string | undefined)
	) {
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

/** Explains the feature or limit and what the person can still use. */
export function describePlanProblem(problem: PlanProblem): { title: string; message: string } {
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
				title: t`This template isn't available`,
				message: t`${freeTemplateList()} are available, and documents that already use another template keep it.`,
			};
		case "brandLogos":
			return {
				title: t`Tool logos aren't available`,
				message: t`Every other icon is available: contact, section titles, skills, interests and profile logos. Documents that already show tool logos keep them.`,
			};
		case "wordOdtExport":
			return {
				title: t`Word and ODT aren't available`,
				message: t`Download a PDF instead: it keeps your design exactly. Markdown and JSON are available too.`,
			};
		case "customStyles":
			return {
				title: t`Custom styles aren't available`,
				message: t`Styles you already saved keep working. Design covers templates, fonts, colors and spacing.`,
			};
		case "customFonts":
			return {
				title: t`Your own fonts aren't available`,
				message: t`Choose any of the fonts in Design instead.`,
			};
		case "automationApi":
			return {
				title: t`API and MCP access isn't available`,
				message: t`Other apps cannot connect to this account with an API key.`,
			};
		// The web's portfolio features; the app only meets one when connecting a domain on the Share screen.
		case "customDomain":
			return { title: t`Your own domain isn't available`, message: t`Your page keeps its address on Rezumi.` };
		case "premiumPortfolioThemes":
		case "premiumHeroEffects":
		case "hidePortfolioCredit":
		case "detailedPortfolioStats":
			return {
				title: t`This option isn't available`,
				message: t`You can keep editing and sharing your portfolio.`,
			};
		default:
			return { title: t`This option isn't available`, message: t`Choose another option to continue.` };
	}
}

export function showPlanAlert(problem: PlanProblem) {
	const { title, message } = describePlanProblem(problem);
	Alert.alert(title, message, [{ text: t`OK` }]);
}

/** Shows the plan alert when `error` is a plan refusal from the server; returns whether it did. */
export function showPlanAlertForError(error: unknown) {
	const problem = getPlanProblem(error);
	if (problem) showPlanAlert(problem);
	return problem !== null;
}
