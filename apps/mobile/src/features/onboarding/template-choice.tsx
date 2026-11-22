// A short gallery for the first resume: the templates the plan opens, each drawn with the person's own details by the
// native renderer (as Design → Template does), and the rest a press away. iOS lists only what the account can use;
// Android lists the rest labelled, and a locked one explains the plan without selling it (K6).
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { offeredTemplates } from "@rezumi/career/onboarding";
import { templateName } from "@rezumi/resume/design-presets";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { applyTemplatePreset } from "@rezumi/resume/template-preset";
import { templateSample } from "@rezumi/resume/template-sample";
import { templateLayouts, templateLineup } from "@rezumi/schema/templates";
import { isLocale } from "@rezumi/utils/locale";
import { useSession } from "@/auth/session";
import { isLabelledTemplate, isLockedTemplate, showPlanAlert, usePlan } from "@/features/billing/plan";
import { canShowPlans } from "@/features/billing/plan-alert";
import {
	readStoredTemplateThumbnail,
	storeTemplateThumbnail,
	templateThumbnailKey,
} from "@/features/documents/thumbnail-store";
import { enqueueThumbnail, renderFirstPage, thumbnailPixelWidth } from "@/preview/thumbnail-queue";
import { Button, Chip, Icon, Text, cx, haptics } from "@/ui";

/** The resume in a template's own look (fonts, accent), as a new resume in that template starts. */
function withLook(data: ResumeData, template: Template): ResumeData {
	const look = structuredClone(data);
	look.metadata.template = template;
	applyTemplatePreset(look, template);
	return look;
}

type TemplateChoiceProps = {
	profile: ProfileData;
	value: Template;
	onChange: (template: Template) => void;
	/** The gallery's width, for two columns. */
	width: number;
};

export function TemplateChoice({ profile, value, onChange, width }: TemplateChoiceProps) {
	const { t, i18n } = useLingui();
	const plan = usePlan();
	const [all, setAll] = useState(false);
	const data = useMemo(() => {
		const resume = resumeDataFromProfile(profile);
		// Section titles in the cards read in the app's language, as the resume itself will.
		if (isLocale(i18n.locale)) resume.metadata.page.locale = i18n.locale;
		return resume;
	}, [profile, i18n.locale]);
	const content = useMemo(() => templateThumbnailKey(data), [data]);
	const locked = (template: Template) => isLockedTemplate(plan, template);
	const offered = offeredTemplates(locked, all, value);
	// iOS never shows what the account can't use.
	const shown = canShowPlans() ? offered : offered.filter((template) => template === value || !locked(template));
	const listed = canShowPlans() ? templateLineup : templateLineup.filter((template) => !locked(template));
	const gap = 16;
	const cardWidth = Math.max(0, (width - gap) / 2);

	return (
		<View className="gap-4">
			<View className="flex-row flex-wrap gap-4" accessibilityRole="radiogroup" accessibilityLabel={t`Templates`}>
				{shown.map((id) => (
					<TemplateCard
						key={id}
						id={id}
						data={data}
						content={content}
						width={cardWidth}
						selected={id === value}
						labelled={isLabelledTemplate(plan, id)}
						onChoose={() => {
							if (locked(id)) showPlanAlert({ kind: "feature", feature: "premiumTemplates" });
							else {
								haptics.selection();
								onChange(id);
							}
						}}
					/>
				))}
			</View>
			{!all && shown.length < listed.length ? (
				<Button variant="ghost" className="self-center" onPress={() => setAll(true)}>
					<Button.Label>{t`More templates`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}

type TemplateCardProps = {
	id: Template;
	data: ResumeData;
	content: string;
	width: number;
	selected: boolean;
	labelled: boolean;
	onChoose: () => void;
};

function TemplateCard({ id, data, content, width, selected, labelled, onChoose }: TemplateCardProps) {
	const { t, i18n } = useLingui();
	const { server } = useSession();
	const pixelWidth = thumbnailPixelWidth(width);
	const { data: thumbnail } = useQuery({
		queryKey: ["onboarding-template", id, content, pixelWidth],
		queryFn: ({ signal }) =>
			readStoredTemplateThumbnail(content, id, pixelWidth) ??
			enqueueThumbnail(
				() =>
					renderFirstPage(
						withLook(data, id),
						pixelWidth,
						(uri) => storeTemplateThumbnail(content, id, pixelWidth, uri),
						id,
					),
				signal,
			),
		enabled: pixelWidth > 0,
		staleTime: Number.POSITIVE_INFINITY,
		// A failed render keeps the template's sample picture.
		retry: false,
	});
	const layout = templateLayouts[id];
	const tags = [layout.columns === 1 ? t`One column` : t`Two columns`, layout.atsSafe ? t`ATS-safe` : null]
		.filter(Boolean)
		.join(" · ");
	const name = templateName(id);
	// The card's page keeps A4's proportions; expo-image takes no className.
	const page = { width, height: (width * 297) / 210 };
	const frame = { width };

	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={`${name}, ${tags}`}
			accessibilityState={{ selected }}
			onPress={onChoose}
			className="gap-1.5 active:opacity-80"
			style={frame}
			testID={`template-${id}`}
		>
			<View
				className={cx(
					"overflow-hidden rounded-lg bg-paper",
					selected ? "border-2 border-accent" : "border border-border",
				)}
			>
				<Image
					source={{ uri: thumbnail ?? `${server}${templateSample(id, i18n.locale).image}` }}
					contentFit="cover"
					contentPosition="top"
					style={page}
					accessibilityIgnoresInvertColors
				/>
				{selected ? (
					<View className="absolute end-2 top-2 size-7 items-center justify-center rounded-full bg-accent">
						<Icon name="check" size={16} tone="accent-foreground" />
					</View>
				) : null}
			</View>
			<View className="flex-row items-center gap-1.5">
				<Text weight="medium" numberOfLines={1} className="shrink">
					{name}
				</Text>
				{labelled ? (
					<Chip size="sm" variant="soft">
						<Chip.Label>Plus</Chip.Label>
					</Chip>
				) : null}
			</View>
			<Text size="xs" tone="muted" numberOfLines={1}>
				{tags}
			</Text>
		</Pressable>
	);
}
