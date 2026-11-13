import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMemo, useState } from "react";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { applyTemplatePreset } from "@rezumi/resume/template-preset";
import { templateLineup } from "@rezumi/schema/templates";
import { isLocale } from "@rezumi/utils/locale";
import { isLabelledTemplate, isLockedTemplate, usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { TemplateCard } from "@/features/resume/editor/design/template-card";
import { thumbnailContent } from "@/features/resume/editor/design/thumbnails";

/** How many templates show before "More templates": the first ones in gallery order the plan opens. */
export const FIRST_TEMPLATES = 6;

/** The templates offered first, then the rest of the lineup once asked for. The chosen one always shows. */
export function offeredTemplates(locked: (template: Template) => boolean, all: boolean, chosen: Template): Template[] {
	if (all) return [...templateLineup];
	const first = templateLineup.filter((template) => !locked(template)).slice(0, FIRST_TEMPLATES);
	return first.includes(chosen) ? first : [...first, chosen];
}

/**
 * A new resume takes its template with the template's own look (fonts, accent), so each card is drawn that way. The
 * thumbnail is cached by template and content, so a fresh copy each render draws nothing again.
 */
function withLook(data: ResumeData, template: Template): ResumeData {
	const look = structuredClone(data);
	look.metadata.template = template;
	applyTemplatePreset(look, template);
	return look;
}

type TemplateChoiceProps = {
	/** The Profile the first resume starts from; the cards draw it in each template. */
	profile: ProfileData;
	value: Template;
	onChange: (template: Template) => void;
};

/**
 * A short gallery for the first resume: the templates the plan opens, each drawn with the person's own details, and
 * the rest a press away (premium ones explain the plan when chosen, as in the builder).
 */
export function TemplateChoice({ profile, value, onChange }: TemplateChoiceProps) {
	const { i18n } = useLingui();
	const plan = usePlan();
	const [all, setAll] = useState(false);
	const data = useMemo(() => {
		const resume = resumeDataFromProfile(profile);
		// Section titles in the cards read in the app's language, as the resume itself will.
		if (isLocale(i18n.locale)) resume.metadata.page.locale = i18n.locale;
		return resume;
	}, [profile, i18n.locale]);
	const content = thumbnailContent(data);
	const shown = offeredTemplates((template) => isLockedTemplate(plan, template), all, value);

	return (
		<div className="grid gap-4">
			<div role="group" aria-label={t`Templates`} className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
				{shown.map((id) => {
					const locked = isLockedTemplate(plan, id);
					return (
						<TemplateCard
							key={id}
							id={id}
							data={withLook(data, id)}
							content={content}
							selected={id === value}
							labelled={isLabelledTemplate(plan, id)}
							locked={locked}
							onChoose={() => {
								if (locked) openPlanDialog({ kind: "feature", feature: "premiumTemplates" });
								else onChange(id);
							}}
						/>
					);
				})}
			</div>
			{!all && shown.length < templateLineup.length && (
				<Button variant="ghost" className="justify-self-center" onPress={() => setAll(true)}>
					<Trans>More templates</Trans>
				</Button>
			)}
		</div>
	);
}
