import type { DesignProps } from "./types";
import type { IconDesign, IconStyle } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { ResumeIcon, useIconGlyphs } from "./resume-icon";
import { FieldLabel } from "./section";
import { canShowPlans, hasPlanFeature, showPlanAlert, usePlan } from "@/features/billing/plan";
import { ListRow, ListSection, Segment, Switch, cx } from "@/ui";

type IconGroupKey = "contact" | "sections" | "items" | "logos";

/** Icons the style row draws, so the difference between the styles shows before choosing. */
const SAMPLES = ["mail-01", "call-02", "location-01", "briefcase-01", "mortarboard-01", "star"];

/**
 * Icons: one switch for all of them, the style every icon is drawn in, and the groups that show. Tool logos need the
 * plan's `brandLogos` to be switched on: Android shows the switch locked and explains, iOS leaves it out. A resume that
 * already shows them keeps an open switch, to turn them off.
 */
export function IconsGroup({ data, write, disabled }: DesignProps) {
	const { t } = useLingui();
	const plan = usePlan();
	const icons = iconDesignOf(data.metadata.design);
	const glyphs = useIconGlyphs(icons.style);
	const logosLocked = !icons.logos && !hasPlanFeature(plan, "brandLogos");
	const set = (key: keyof IconDesign, patch: Partial<IconDesign>) =>
		write(
			`icons.${key}`,
			(draft) => {
				draft.metadata.design.icons = { ...iconDesignOf(draft.metadata.design), ...patch };
			},
			true,
		);
	const groups: { key: IconGroupKey; label: string; description: string }[] = [
		{
			key: "contact",
			label: t`Contact line`,
			description: t`Before your email, phone, location, website and custom fields.`,
		},
		{
			key: "sections",
			label: t`Section titles`,
			description: t`Before titles such as Education, Skills and Certifications.`,
		},
		{
			key: "items",
			label: t`Skills, interests and profiles`,
			description: t`The icons you pick, and network logos such as LinkedIn and GitHub.`,
		},
		{
			key: "logos",
			label: t`Tool logos in skills`,
			description: t`Logos beside the tools a skill names, such as React, Python or Figma. The words always print.`,
		},
	];

	return (
		<>
			<ListSection>
				<ListRow
					title={t`Show icons`}
					description={t`Turn off for a text-only resume.`}
					trailing={
						<Switch
							isSelected={icons.enabled}
							isDisabled={disabled}
							accessibilityLabel={t`Show icons`}
							onSelectedChange={(enabled) => set("enabled", { enabled })}
						/>
					}
				/>
			</ListSection>

			<View className={cx("gap-2", !icons.enabled && "opacity-50")}>
				<FieldLabel label={t`Icon style`} />
				<Segment<IconStyle>
					accessibilityLabel={t`Icon style`}
					value={icons.style}
					isDisabled={disabled || !icons.enabled}
					onValueChange={(style) => set("style", { style })}
					options={[
						{ value: "standard", label: t`Standard` },
						{ value: "rounded", label: t`Rounded` },
						{ value: "sharp", label: t`Sharp` },
					]}
				/>
				<View className="min-h-8 flex-row items-center justify-around rounded-xl bg-surface-secondary py-2">
					{SAMPLES.map((name) => (
						<ResumeIcon key={name} name={name} glyphs={glyphs} size={20} />
					))}
				</View>
			</View>

			<ListSection title={t`Where icons show`}>
				{groups.flatMap(({ key, label, description }) => {
					const locked = key === "logos" && logosLocked;
					// iOS names no plan: a switch the plan doesn't open is left out.
					if (locked && !canShowPlans()) return [];
					return [
						<ListRow
							key={key}
							title={locked ? `${label} · Plus` : label}
							description={description}
							icon={locked ? "lock" : undefined}
							isDisabled={!icons.enabled}
							trailing={
								<Switch
									isSelected={icons[key]}
									isDisabled={disabled || !icons.enabled}
									accessibilityLabel={label}
									onSelectedChange={(checked) =>
										locked ? showPlanAlert({ kind: "feature", feature: "brandLogos" }) : set(key, { [key]: checked })
									}
								/>
							}
						/>,
					];
				})}
			</ListSection>
		</>
	);
}
