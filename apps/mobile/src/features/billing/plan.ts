import type { PlanFeature } from "./plan-alert";
import type { RouterOutput } from "@/api/client";
import type { PlanId } from "@rezumi/schema/billing";
import type { Template } from "@rezumi/schema/templates";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { FREE_TEMPLATES, isFreeTemplate } from "@rezumi/schema/billing";
import { canShowPlans } from "./plan-alert";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { templateName } from "@/features/design/presets";

export { canShowPlans, showPlanAlert } from "./plan-alert";
export type { PlanFeature } from "./plan-alert";

export type PlanSummary = RouterOutput["billing"]["summary"];

/** The account's plan and usage, for display only: the server enforces every rule. */
export function usePlan(): PlanSummary | undefined {
	const session = useSession();
	return useQuery(
		orpc.billing.summary.queryOptions({
			queryKey: [...orpc.billing.summary.key(), session.server],
			enabled: session.status === "signed-in",
			retry: false,
		}),
	).data;
}

/** Whether a feature is open: until the plan loads and while plans don't apply to the account, it is. */
export const hasPlanFeature = (plan: PlanSummary | undefined, feature: PlanFeature) =>
	!plan?.enabled || plan.features[feature];

/** A template the plan doesn't open: premium, while plans apply and the plan lacks premium templates. */
export const isLockedTemplate = (plan: PlanSummary | undefined, template: Template) =>
	!isFreeTemplate(template) && !hasPlanFeature(plan, "premiumTemplates");

/** Android labels premium templates while plans apply; iOS never labels them. */
export const isLabelledTemplate = (plan: PlanSummary | undefined, template: Template) =>
	canShowPlans() && Boolean(plan?.enabled) && !isFreeTemplate(template);

/**
 * The templates a picker lists. Android lists every one (locked ones labelled); iOS lists only those the account can
 * use, and the document's own.
 */
export const listedTemplates = (plan: PlanSummary | undefined, templates: readonly Template[], current: Template) =>
	canShowPlans() ? templates : templates.filter((id) => id === current || !isLockedTemplate(plan, id));

export const getPlanName = (planId: PlanId) => (planId === "free" ? t`Free` : planId === "plus" ? "Plus" : "Pro AI");

/** What an import changed to fit the plan, as the server does it. Null when the file fits. */
export function describeImportedDesign(
	plan: PlanSummary | undefined,
	design: {
		template: Template;
		stylesheet?: { source: { text: string } } | undefined;
		typography?: { customFonts?: unknown[] | undefined } | undefined;
	},
): string | null {
	const fonts = Boolean(design.typography?.customFonts?.length) && !hasPlanFeature(plan, "customFonts");
	const notice = describeImportedTemplateAndStyles(plan, design);
	if (!fonts) return notice;
	const fontsNotice = t`Your own fonts aren't available, so the imported document uses a standard font.`;
	return notice ? `${notice} ${fontsNotice}` : fontsNotice;
}

function describeImportedTemplateAndStyles(
	plan: PlanSummary | undefined,
	design: { template: Template; stylesheet?: { source: { text: string } } | undefined },
): string | null {
	const template = isLockedTemplate(plan, design.template);
	const styles = Boolean(design.stylesheet?.source.text.trim()) && !hasPlanFeature(plan, "customStyles");
	const name = templateName(design.template);
	const free = templateName(FREE_TEMPLATES[0]);
	if (template && styles)
		return t`${name} and custom styles aren't available, so the imported document uses ${free} without the file's styles.`;
	if (template) return t`${name} isn't available, so the imported document uses ${free}.`;
	if (styles) return t`Custom styles aren't available, so the imported document leaves the file's styles out.`;
	return null;
}
