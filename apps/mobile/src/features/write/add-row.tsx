// Under an open section: "+ Add {type}" and, when the Profile has entries this section leaves out, Add from Profile,
// which lists them one by one or all at once (the web's AddFromProfile).
import type { WriteSection } from "@/features/entries/model";
import type { ProfileData, ProfileSectionType } from "@rezumi/schema/profile/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { missingFromProfile, profileSectionOf } from "@rezumi/resume/profile-link";
import { useWriteSection } from "./hooks";
import { useBuilderProfile, useTakeProfileParts } from "./profile-link";
import { ADD_LABELS } from "@/features/entries/fields";
import { describeEntry } from "@/features/entries/model";
import { useWriteData } from "@/features/entries/source";
import { Button, Icon, ListRow, ListSection, Sheet } from "@/ui";

/** The Profile entries a section leaves out, as a stable string of ids. */
function useMissing(section: WriteSection | null, profile: ProfileData | null): string[] {
	const linked = section ? profileSectionOf(section) : null;
	const key = useWriteData(
		(data) => (profile && linked ? missingFromProfile(data, profile, linked).join("\u0000") : ""),
		"",
	);
	return key ? key.split("\u0000") : [];
}

type AddRowProps = {
	sectionId: string;
	onAdd: (section: WriteSection) => void;
	onAddFromProfile: (section: WriteSection) => void;
};

export function AddRow({ sectionId, onAdd, onAddFromProfile }: AddRowProps) {
	const { i18n, t } = useLingui();
	const section = useWriteSection(sectionId);
	const missing = useMissing(section, useBuilderProfile());
	if (!section) return null;
	return (
		<View className="ms-6 flex-row flex-wrap items-center">
			<Button variant="ghost" size="sm" onPress={() => onAdd(section)} testID={`add-entry-${sectionId}`}>
				<Icon name="plus" size={16} tone="accent" />
				<Button.Label>{i18n._(ADD_LABELS[section.type])}</Button.Label>
			</Button>
			{missing.length > 0 ? (
				<Button variant="ghost" size="sm" onPress={() => onAddFromProfile(section)}>
					<Icon name="user-circle" size={16} tone="muted" />
					<Button.Label>{t`Add from Profile`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}

type AddFromProfileSheetProps = {
	section: WriteSection | null;
	onClose: () => void;
	/** Opens the entry that came over, when only one did. */
	onOpen: (sectionId: string, entryId: string) => void;
};

export function AddFromProfileSheet({ section, onClose, onOpen }: AddFromProfileSheetProps) {
	const { t } = useLingui();
	const profile = useBuilderProfile();
	const take = useTakeProfileParts();
	const missing = useMissing(section, profile);
	const linked: ProfileSectionType | null = section ? profileSectionOf(section) : null;
	const items = profile && linked ? (profile.sections[linked] as { id: string }[]) : [];

	const add = (ids: string[]) => {
		onClose();
		if (!profile || !linked || !section) return;
		take(
			profile,
			ids.map((id) => ({ kind: "item", section: linked, id })),
		);
		const [first] = ids;
		if (ids.length === 1 && first) onOpen(section.id, first);
	};

	return (
		<Sheet
			isOpen={section !== null}
			onOpenChange={(open) => !open && onClose()}
			title={t`Add from Profile`}
			closeLabel={t`Close`}
			detents={["auto", 0.9]}
		>
			{section ? (
				<ListSection>
					{[
						...missing.flatMap((id) => {
							const item = items.find((candidate) => candidate.id === id);
							if (!item) return [];
							const { title, meta } = describeEntry(section.type, item as Parameters<typeof describeEntry>[1]);
							return [
								<ListRow
									key={id}
									title={title || t`Untitled`}
									description={meta || undefined}
									chevron={false}
									onPress={() => add([id])}
								/>,
							];
						}),
						...(missing.length > 1
							? [
									<ListRow
										key="all"
										title={t`Add all (${missing.length})`}
										icon="plus"
										chevron={false}
										onPress={() => add(missing)}
									/>,
								]
							: []),
					]}
				</ListSection>
			) : null}
		</Sheet>
	);
}
