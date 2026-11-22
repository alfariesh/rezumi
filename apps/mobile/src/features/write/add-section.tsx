import type { ProfileSectionType } from "@rezumi/schema/profile/data";
// Add section (the web's add-section.tsx): sections the Profile can fill ("From your Profile", with their entries),
// every section not in use ("Start empty"), and Custom section, which asks what goes in it. A blank resume shows
// the first sections to add as chips, with an offer to import instead.
import type { CustomSectionType, SectionType } from "@rezumi/schema/resume/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { sectionParts, sectionsFromProfile } from "@rezumi/resume/profile-link";
import { useBuilderProfile, useTakeProfileParts } from "./profile-link";
import { SECTION_ICONS, SECTION_TITLES } from "@/features/entries/fields";
import { useEdit } from "@/features/entries/hooks";
import {
	addBuiltinSection,
	addCustomSection,
	BUILTIN_SECTION_TYPES,
	CUSTOM_SECTION_TYPES,
	ensurePlaced,
	isSectionInUse,
} from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { Button, Card, Icon, LinkButton, ListRow, ListSection, Sheet, Text, Typography } from "@/ui";

type Added = (sectionId: string, entryId: string | null) => void;

/** Adds a section and tells the outline which one (and its first entry, to open). */
export function useAddSection(onAdded: Added) {
	const { i18n } = useLingui();
	const edit = useEdit();
	const profile = useBuilderProfile();
	const take = useTakeProfileParts();
	return {
		builtin: (type: "summary" | SectionType) => {
			let entryId: string | null = null;
			edit((draft) => {
				entryId = addBuiltinSection(draft, type);
			});
			onAdded(type, entryId);
		},
		custom: (type: CustomSectionType) => {
			let ids = { sectionId: "", entryId: "" };
			edit((draft) => {
				ids = addCustomSection(draft, type, i18n._(SECTION_TITLES[type]));
			});
			onAdded(ids.sectionId, ids.entryId);
		},
		fromProfile: (type: "summary" | ProfileSectionType) => {
			if (!profile) return;
			take(profile, sectionParts(profile, type), (draft) => {
				ensurePlaced(draft, type);
				if (type === "summary") draft.summary.hidden = false;
				else draft.sections[type].hidden = false;
			});
			onAdded(type, null);
		},
	};
}

type AddSectionSheetProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	added: ReadonlySet<string>;
	onAdded: Added;
};

export function AddSectionSheet({ isOpen, onOpenChange, added, onAdded }: AddSectionSheetProps) {
	const { t, i18n } = useLingui();
	const profile = useBuilderProfile();
	const add = useAddSection(onAdded);
	const [custom, setCustom] = useState(false);
	const unusedKey = useWriteData(
		(data) =>
			(["summary", ...BUILTIN_SECTION_TYPES] as const).filter((type) => !isSectionInUse(data, type, added)).join(","),
		"",
	);
	const unused = unusedKey ? (unusedKey.split(",") as ("summary" | SectionType)[]) : [];
	const fromProfile = profile ? sectionsFromProfile(profile, unused as ("summary" | ProfileSectionType)[]) : [];
	// With every built-in section in use, the custom types are the only choice.
	const showCustom = custom || unused.length === 0;
	const close = () => {
		setCustom(false);
		onOpenChange(false);
	};
	const pick = (run: () => void) => () => {
		close();
		run();
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={(open) => (open ? onOpenChange(true) : close())}
			title={showCustom ? t`Custom section` : t`Add section`}
			closeLabel={t`Close`}
			detents={[0.7, 1]}
			testID="add-section-sheet"
		>
			{showCustom ? (
				<>
					{unused.length > 0 ? (
						<ListSection>
							<ListRow title={t`Add section`} icon="caret-left" chevron={false} onPress={() => setCustom(false)} />
						</ListSection>
					) : null}
					<ListSection title={t`What goes in it?`}>
						{CUSTOM_SECTION_TYPES.map((type) => (
							<ListRow
								key={type}
								title={i18n._(SECTION_TITLES[type])}
								icon={SECTION_ICONS[type]}
								chevron={false}
								onPress={pick(() => add.custom(type))}
							/>
						))}
					</ListSection>
				</>
			) : (
				<>
					{fromProfile.length > 0 ? (
						<ListSection title={t`From your Profile`}>
							{fromProfile.map(({ type, count }) => (
								<ListRow
									key={type}
									title={i18n._(SECTION_TITLES[type])}
									icon={SECTION_ICONS[type]}
									value={type === "summary" ? undefined : plural(count, { one: "# entry", other: "# entries" })}
									chevron={false}
									onPress={pick(() => add.fromProfile(type))}
									testID={`add-from-profile-${type}`}
								/>
							))}
						</ListSection>
					) : null}
					<ListSection title={fromProfile.length > 0 ? t`Start empty` : undefined}>
						{unused.map((type) => (
							<ListRow
								key={type}
								title={i18n._(SECTION_TITLES[type])}
								icon={SECTION_ICONS[type]}
								chevron={false}
								onPress={pick(() => add.builtin(type))}
								testID={`add-section-${type}`}
							/>
						))}
					</ListSection>
					<ListSection>
						<ListRow
							title={t`Custom section`}
							icon="plus"
							onPress={() => setCustom(true)}
							testID="add-custom-section"
						/>
					</ListSection>
				</>
			)}
		</Sheet>
	);
}

const SUGGESTED: ("summary" | SectionType)[] = ["experience", "education", "skills", "summary"];

type StartSuggestionsProps = { onAdded: Added; onImport: () => void };

/** A blank resume: the first sections to add, and an offer to import a resume instead. */
export function StartSuggestions({ onAdded, onImport }: StartSuggestionsProps) {
	const { t, i18n } = useLingui();
	const add = useAddSection(onAdded);
	return (
		<Card>
			<Card.Body className="gap-3">
				<Typography type="body-sm" className="text-muted">
					{t`Start with the sections most resumes have.`}
				</Typography>
				<View className="flex-row flex-wrap gap-2">
					{SUGGESTED.map((type) => (
						<Button key={type} variant="secondary" size="sm" onPress={() => add.builtin(type)}>
							<Icon name="plus" size={16} />
							<Button.Label>{i18n._(SECTION_TITLES[type])}</Button.Label>
						</Button>
					))}
				</View>
				<View className="flex-row flex-wrap items-center gap-1">
					<Text size="xs" tone="muted">
						{t`Have a resume already?`}
					</Text>
					<LinkButton onPress={onImport}>
						<LinkButton.Label>{t`Import it`}</LinkButton.Label>
					</LinkButton>
				</View>
			</Card.Body>
		</Card>
	);
}
