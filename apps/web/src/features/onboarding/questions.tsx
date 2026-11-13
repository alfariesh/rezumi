import type { CareerProfileData } from "@rezumi/schema/career";
import { t } from "@lingui/core/macro";
import { ChipField, OfficeDaysField } from "@/features/career/knowledge/preferences";

/** The two questions onboarding asks while sources load, kept in Preferences. */
export type OnboardingAnswers = Pick<CareerProfileData, "targetRoles" | "locations" | "maxOfficeDays">;

export const answersOf = (preferences: CareerProfileData): OnboardingAnswers => ({
	targetRoles: preferences.targetRoles,
	locations: preferences.locations,
	maxOfficeDays: preferences.maxOfficeDays,
});

export const sameAnswers = (a: OnboardingAnswers, b: OnboardingAnswers) =>
	a.maxOfficeDays === b.maxOfficeDays &&
	a.targetRoles.join("\n") === b.targetRoles.join("\n") &&
	a.locations.join("\n") === b.locations.join("\n");

type QuestionsProps = {
	value: OnboardingAnswers;
	onChange: (value: OnboardingAnswers) => void;
};

/** What roles, and where and how: the Preferences page's own fields, both optional. */
export function Questions({ value, onChange }: QuestionsProps) {
	return (
		<div className="grid gap-6">
			<ChipField
				label={t`What roles are you aiming for?`}
				placeholder={t`Add a role, then Enter`}
				description={t`For example: Product designer, Data analyst.`}
				value={value.targetRoles}
				onChange={(targetRoles) => onChange({ ...value, targetRoles })}
			/>
			<div className="grid gap-4">
				<ChipField
					label={t`Where do you want to work?`}
					placeholder={t`Add a place, then Enter`}
					description={t`Cities or countries. Leave it empty for anywhere.`}
					value={value.locations}
					onChange={(locations) => onChange({ ...value, locations })}
				/>
				<OfficeDaysField
					value={value.maxOfficeDays}
					onChange={(maxOfficeDays) => onChange({ ...value, maxOfficeDays })}
				/>
			</div>
		</div>
	);
}
