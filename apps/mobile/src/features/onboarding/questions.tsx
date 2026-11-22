// The two questions onboarding asks while the sources are read: which roles, and where and how. Both optional, both
// kept in Preferences (the coach uses them to find roles that fit).
import type { OnboardingAnswers } from "@rezumi/career/onboarding";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { ChipInput, TagGroup, Text, haptics } from "@/ui";

type QuestionsProps = { value: OnboardingAnswers; onChange: (value: OnboardingAnswers) => void };

export function Questions({ value, onChange }: QuestionsProps) {
	const { t } = useLingui();
	const days = ["any", "0", "1", "2", "3", "4", "5"] as const;
	return (
		<View className="gap-6">
			<ChipInput
				label={t`What roles are you aiming for?`}
				placeholder={t`Add a role`}
				description={t`For example: Product designer, Data analyst.`}
				values={value.targetRoles}
				onChange={(targetRoles) => onChange({ ...value, targetRoles })}
				removeLabel={(role) => t`Remove ${role}`}
				variant="secondary"
				testID="question-roles"
			/>
			<ChipInput
				label={t`Where do you want to work?`}
				placeholder={t`Add a place`}
				description={t`Cities or countries. Leave it empty for anywhere.`}
				values={value.locations}
				onChange={(locations) => onChange({ ...value, locations })}
				removeLabel={(place) => t`Remove ${place}`}
				variant="secondary"
				testID="question-places"
			/>
			<View className="gap-2">
				<Text weight="medium">{t`Office days a week, at most`}</Text>
				{/* Seven short choices: tags that wrap, where a segment would cut the words. */}
				<TagGroup
					selectionMode="single"
					selectedKeys={new Set([value.maxOfficeDays === null ? "any" : String(value.maxOfficeDays)])}
					onSelectionChange={(keys) => {
						const [day] = [...keys];
						if (day === undefined) return;
						haptics.selection();
						onChange({ ...value, maxOfficeDays: day === "any" ? null : Number(day) });
					}}
					accessibilityLabel={t`Office days a week, at most`}
				>
					<TagGroup.List>
						{days.map((day) => (
							<TagGroup.Item key={day} id={day} testID={`office-days-${day}`}>
								<TagGroup.ItemLabel>{day === "any" ? t`Any` : day === "0" ? t`Remote` : day}</TagGroup.ItemLabel>
							</TagGroup.Item>
						))}
					</TagGroup.List>
				</TagGroup>
			</View>
		</View>
	);
}
