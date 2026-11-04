import type { RouterOutput } from "@/libs/orpc/client";
import type { PlanFeatures, PlanId } from "@rezumi/schema/billing";
import type { Template } from "@rezumi/schema/templates";
import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { FREE_TEMPLATES, isFreeTemplate } from "@rezumi/schema/billing";
import { templates } from "@/dialogs/resume/template/data";
import { orpc } from "@/libs/orpc/client";

export type PlanSummary = RouterOutput["billing"]["summary"];
export type PlanFeature = keyof PlanFeatures;

/** The account's plan and usage, for display only: the server enforces every rule. */
export function usePlan(): PlanSummary | undefined {
	return useQuery(orpc.billing.summary.queryOptions()).data;
}

/** Whether a feature is open: until the plan loads and while plans don't apply to the account, it is. */
export const hasPlanFeature = (plan: PlanSummary | undefined, feature: PlanFeature) =>
	!plan?.enabled || plan.features[feature];

export function usePlanFeature(feature: PlanFeature) {
	return hasPlanFeature(usePlan(), feature);
}

/** A template the plan doesn't open: premium, while plans apply and the plan lacks premium templates. */
export const isLockedTemplate = (plan: PlanSummary | undefined, template: Template) =>
	!isFreeTemplate(template) && !hasPlanFeature(plan, "premiumTemplates");

/** Premium templates carry a label wherever plans apply to the account. */
export const isLabelledTemplate = (plan: PlanSummary | undefined, template: Template) =>
	Boolean(plan?.enabled) && !isFreeTemplate(template);

export const getPlanName = (planId: PlanId) => (planId === "free" ? t`Free` : planId === "plus" ? "Plus" : "Pro AI");

const freeTemplateNames = () => FREE_TEMPLATES.map((id) => templates[id].name);

/** What a plan refusal was about: a document limit, or a feature. */
export type PlanProblem =
	| {
			kind: "limit";
			limit: "activeResumes" | "activeCoverLetters";
			max: number;
			used: number;
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
			used: typeof data.used === "number" ? data.used : 0,
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

/** A plan problem in the user's words: what happened and the free way on. Never a price. */
export function describePlanProblem(problem: PlanProblem): { title: string; description: string } {
	if (problem.kind === "limit") {
		const { max, requested } = problem;
		const several = requested.resumes > 0 && requested.coverLetters > 0;
		const adds = several
			? plural(requested.coverLetters, {
					one: "This file holds a resume and # cover letter, and they're saved together.",
					other: "This file holds a resume and # cover letters, and they're saved together.",
				})
			: "";
		const room =
			problem.limit === "activeResumes"
				? t`Your plan keeps up to ${max} resumes outside Trash. Move one you don't need to Trash to make room; you can restore it later.`
				: t`Your plan keeps up to ${max} cover letters outside Trash. Move one you don't need to Trash to make room; you can restore it later.`;
		return {
			title: problem.limit === "activeResumes" ? t`No room for another resume` : t`No room for another cover letter`,
			description: [adds, room].filter(Boolean).join(" "),
		};
	}
	const free = new Intl.ListFormat(i18n.locale, { type: "conjunction" }).format(freeTemplateNames());
	switch (problem.feature) {
		case "premiumTemplates":
			return {
				title: t`This template isn't in your plan`,
				description: t`You can preview every template. ${free} are included, and documents that already use another template keep it.`,
			};
		case "brandLogos":
			return {
				title: t`Tool logos aren't in your plan`,
				description: t`Every other icon is included: contact, section titles, skills, interests and profile logos. Documents that already show tool logos keep them.`,
			};
		case "wordOdtExport":
			return {
				title: t`Word and ODT downloads aren't in your plan`,
				description: t`Download a PDF instead: it keeps your design exactly. Markdown and JSON downloads are included too.`,
			};
		case "customStyles":
			return {
				title: t`Custom styles aren't in your plan`,
				description: t`Styles you already saved keep working. Design covers templates, fonts, colors and spacing.`,
			};
		case "customFonts":
			return {
				title: t`Your own fonts aren't in your plan`,
				description: t`Choose any of the fonts in Design instead.`,
			};
		case "automationApi":
			return {
				title: t`API and MCP access isn't in your plan`,
				description: t`Rezumi on the web and on your phone always works. Other apps and assistants that connect with an API key or OAuth need a paid plan.`,
			};
	}
}

/**
 * What an import changes to fit the plan, as the server does it: a premium template becomes the first free one, tool
 * logos are switched off, and custom styles and uploaded fonts are left out. Null when the file fits.
 */
export function describeImportedDesign(
	plan: PlanSummary | undefined,
	design: {
		template: Template;
		stylesheet?: { source: { text: string } } | undefined;
		typography?: { customFonts?: unknown[] | undefined } | undefined;
		design?: { icons?: { logos?: boolean | undefined } | undefined } | undefined;
	},
): string | null {
	const logos = design.design?.icons?.logos === true && !hasPlanFeature(plan, "brandLogos");
	const fonts = Boolean(design.typography?.customFonts?.length) && !hasPlanFeature(plan, "customFonts");
	const notices = [
		describeImportedTemplateAndStyles(plan, design),
		logos ? t`Tool logos aren't in your plan, so the imported document shows skills without them.` : null,
		fonts ? t`Your own fonts aren't in your plan, so the imported document uses a standard font.` : null,
	].filter(Boolean);
	return notices.length > 0 ? notices.join(" ") : null;
}

function describeImportedTemplateAndStyles(
	plan: PlanSummary | undefined,
	design: { template: Template; stylesheet?: { source: { text: string } } | undefined },
): string | null {
	const template = isLockedTemplate(plan, design.template);
	const styles = Boolean(design.stylesheet?.source.text.trim()) && !hasPlanFeature(plan, "customStyles");
	const name = templates[design.template].name;
	const free = templates[FREE_TEMPLATES[0]].name;
	if (template && styles)
		return t`${name} and custom styles aren't in your plan, so the imported document uses ${free} without the file's styles.`;
	if (template) return t`${name} isn't in your plan, so the imported document uses ${free}.`;
	if (styles) return t`Custom styles aren't in your plan, so the imported document leaves the file's styles out.`;
	return null;
}
