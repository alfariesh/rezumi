// Profile → Career: the summary and every career section in the Profile's fixed order, each entry opening full screen.
// Empty sections wait in Add section. While the career is empty: Bring what you have, or Fill from a resume.
import type { WriteSection } from "@/features/write/model";
import type { ProfileSectionType } from "@rezumi/schema/profile/data";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PROFILE_SECTION_TYPES } from "@rezumi/schema/profile/data";
import { stripHtml } from "@rezumi/utils/string";
import { FillFromResumeSheet } from "./fill-sheet";
import { SaveNote } from "./save-note";
import { profileWriteSource, useProfileQuery } from "./source";
import { ProfileLoadError, ProfileSkeleton } from "./states";
import { refreshProfile } from "./store";
import { requestFocus, useAddEntry, useSectionTitle } from "@/features/entries/hooks";
import { WriteSourceProvider, useWriteData } from "@/features/entries/source";
import { ADD_LABELS, SECTION_ICONS, SECTION_TITLES } from "@/features/write/fields";
import { describeEntry, isDraftEntry } from "@/features/write/model";
import { routes } from "@/routes";
import { Button, Card, EmptyState, ListRow, ListSection, Screen, Sheet, Text } from "@/ui";

const sectionOf = (type: ProfileSectionType): WriteSection => ({ id: type, kind: "builtin", type });

export function CareerPanel() {
	const { query, ready } = useProfileQuery();
	if (!ready && query.isError) return <ProfileLoadError onRetry={() => void query.refetch()} />;
	if (!ready) return <ProfileSkeleton />;
	return (
		<WriteSourceProvider source={profileWriteSource}>
			<Career />
		</WriteSourceProvider>
	);
}

function Career() {
	const { t } = useLingui();
	const router = useRouter();
	const addEntry = useAddEntry();
	const [adding, setAdding] = useState(false);
	const [filling, setFilling] = useState(false);
	const summary = useWriteData((data) => stripHtml(data.summary.content).trim(), "");
	const inUse = useWriteData(
		(data) => PROFILE_SECTION_TYPES.filter((type) => data.sections[type].items.length > 0).join(","),
		"",
	);
	const used = inUse ? (inUse.split(",") as ProfileSectionType[]) : [];
	const unused = PROFILE_SECTION_TYPES.filter((type) => !used.includes(type));
	const empty = !summary && used.length === 0;

	const add = (type: ProfileSectionType) => {
		setAdding(false);
		const id = addEntry(sectionOf(type));
		requestFocus(id);
		router.push(routes.profileEntry(type, id));
	};

	return (
		<Screen onRefresh={refreshProfile} testID="profile-career">
			<SaveNote />
			{empty ? (
				<Card>
					<Card.Body className="gap-3">
						<Text weight="medium">{t`Fill your career in one go`}</Text>
						<Text size="xs" tone="muted">
							{t`Bring a resume file, LinkedIn, GitHub or your website and check what we found, or copy from a resume you've made. You can also type it in below.`}
						</Text>
						<View className="flex-row flex-wrap gap-2">
							<Button onPress={() => router.push(routes.profileBring())} testID="profile-bring">
								{t`Bring what you have`}
							</Button>
							<Button variant="secondary" onPress={() => setFilling(true)}>
								{t`Fill from a resume`}
							</Button>
						</View>
					</Card.Body>
				</Card>
			) : null}
			<ListSection title={t`Summary`}>
				<ListRow
					title={summary ? (summary.length > 120 ? `${summary.slice(0, 120)}…` : summary) : t`Add a summary`}
					icon={SECTION_ICONS.summary}
					onPress={() => router.push(routes.profileSummary())}
					testID="profile-summary-row"
				/>
			</ListSection>
			{used.map((type) => (
				<CareerSection key={type} type={type} onAdd={() => add(type)} />
			))}
			<Button variant="secondary" onPress={() => setAdding(true)} testID="profile-add-section">
				{t`Add section`}
			</Button>
			{!empty ? (
				<View className="flex-row flex-wrap gap-2">
					<Button variant="ghost" size="sm" onPress={() => router.push(routes.profileBring())}>
						{t`Bring what you have`}
					</Button>
					<Button variant="ghost" size="sm" onPress={() => setFilling(true)}>
						{t`Fill from a resume`}
					</Button>
				</View>
			) : null}
			<AddSectionSheet isOpen={adding} onOpenChange={setAdding} types={unused} onAdd={add} />
			<FillFromResumeSheet isOpen={filling} onOpenChange={setFilling} />
		</Screen>
	);
}

type CareerSectionProps = { type: ProfileSectionType; onAdd: () => void };

function CareerSection({ type, onAdd }: CareerSectionProps) {
	const { t, i18n } = useLingui();
	const router = useRouter();
	const section = sectionOf(type);
	const title = useSectionTitle(section);
	const entries = useWriteData((data) => data.sections[type].items, []);

	return (
		<View className="gap-2">
			<ListSection title={title}>
				{entries.map((entry) => {
					const { title: entryTitle, meta } = describeEntry(type, entry);
					return (
						<ListRow
							key={entry.id}
							title={entryTitle || t`Untitled`}
							description={isDraftEntry(type, entry) ? t`Not finished: add the main detail.` : meta || undefined}
							onPress={() => router.push(routes.profileEntry(type, entry.id))}
						/>
					);
				})}
			</ListSection>
			<Button variant="ghost" size="sm" className="self-start" onPress={onAdd}>
				{i18n._(ADD_LABELS[type])}
			</Button>
		</View>
	);
}

type AddSectionSheetProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	types: readonly ProfileSectionType[];
	onAdd: (type: ProfileSectionType) => void;
};

function AddSectionSheet({ isOpen, onOpenChange, types, onAdd }: AddSectionSheetProps) {
	const { t, i18n } = useLingui();
	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Add section`}
			closeLabel={t`Close`}
			detents={["auto", 0.9]}
			padded={false}
		>
			{types.length === 0 ? (
				<EmptyState kind="inline" title={t`Every section is in use.`} />
			) : (
				<ListSection>
					{types.map((type) => (
						<ListRow
							key={type}
							title={i18n._(SECTION_TITLES[type])}
							icon={SECTION_ICONS[type]}
							chevron={false}
							onPress={() => onAdd(type)}
						/>
					))}
				</ListSection>
			)}
		</Sheet>
	);
}
