import { useLingui } from "@lingui/react/macro";
import { Pressable } from "react-native";
import { templateName } from "@rezumi/resume/design-presets";
import { useApplyTemplate, usePreviewTemplate } from "./draft";
import { Text } from "@/ui";

/**
 * "Previewing X · tap to apply" over the top of the page while a template is tried in the gallery. Applies as the
 * gallery's Apply does: a template the plan doesn't open explains the plan instead.
 */
export function TemplatePreviewCaption() {
	const { t } = useLingui();
	const template = usePreviewTemplate();
	const apply = useApplyTemplate();
	if (!template) return null;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLiveRegion="polite"
			accessibilityHint={t`Applies the template you are trying.`}
			onPress={() => apply(template)}
			className="absolute top-3 min-h-11 justify-center self-center rounded-full bg-foreground px-4 shadow-overlay active:opacity-80"
		>
			<Text weight="medium" className="text-background">
				{t`Previewing ${templateName(template)} · tap to apply`}
			</Text>
		</Pressable>
	);
}
