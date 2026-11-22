// One resume entry and the summary, full screen, on the Phase 06 entry editor pointed at the resume: the Profile
// marker above the fields, and the entry's options (Save to Profile, hide, duplicate, move) under them.
import type { WriteSection } from "@/features/entries/model";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { profileSectionOf } from "@rezumi/resume/profile-link";
import { MoveTargets, useEntryActions } from "./entry-actions";
import { useWriteSection } from "./hooks";
import { ProfileMarker, ResumeProfileProvider } from "./profile-link";
import { resumeWriteSource } from "./source";
import { ResumeGate } from "./states";
import { EntryEditor, SummaryEditor } from "@/features/entries/entry-editor";
import { useEntry, useSectionTitle } from "@/features/entries/hooks";
import { WriteSourceProvider } from "@/features/entries/source";
import { routes } from "@/routes";
import { ListRow, ListSection, Sheet } from "@/ui";

type ResumeScreenProps = { id: string; children: ReactNode };

/** A pushed Write screen: waits for the draft, then edits it with the Profile at hand. */
export function ResumeScreen({ id, children }: ResumeScreenProps) {
	return (
		<ResumeGate id={id}>
			<WriteSourceProvider source={resumeWriteSource}>
				<ResumeProfileProvider>{children}</ResumeProfileProvider>
			</WriteSourceProvider>
		</ResumeGate>
	);
}

type EntryScreenProps = { id: string; sectionId: string; entryId: string; focusField?: string | undefined };

export function EntryScreen({ id, sectionId, entryId, focusField }: EntryScreenProps) {
	return (
		<ResumeScreen id={id}>
			<ResumeEntry id={id} sectionId={sectionId} entryId={entryId} focusField={focusField} />
		</ResumeScreen>
	);
}

function ResumeEntry({ id, sectionId, entryId, focusField }: EntryScreenProps) {
	const section = useWriteSection(sectionId);
	const linked = section ? profileSectionOf(section) : null;
	return (
		<EntryEditor
			sectionId={sectionId}
			entryId={entryId}
			focusField={focusField}
			top={
				linked ? (
					<View className="flex-row justify-end">
						<ProfileMarker part={{ kind: "item", section: linked, id: entryId }} />
					</View>
				) : null
			}
			extra={section ? <EntryOptions id={id} section={section} entryId={entryId} /> : null}
		/>
	);
}

type EntryOptionsProps = { id: string; section: WriteSection; entryId: string };

function EntryOptions({ id, section, entryId }: EntryOptionsProps) {
	const { t } = useLingui();
	const router = useRouter();
	const entry = useEntry(section.id, entryId);
	const actions = useEntryActions(section, entryId);
	const [moving, setMoving] = useState(false);
	if (!entry) return null;
	return (
		<>
			<ListSection>
				{actions.saveToProfile ? (
					<ListRow title={t`Save to Profile`} icon="upload-simple" chevron={false} onPress={actions.saveToProfile} />
				) : null}
				<ListRow
					title={entry.hidden ? t`Show on page` : t`Hide from page`}
					icon={entry.hidden ? "eye" : "eye-slash"}
					chevron={false}
					onPress={actions.toggleHidden}
					testID="entry-toggle-hidden"
				/>
				<ListRow
					title={t`Duplicate`}
					icon="copy"
					chevron={false}
					onPress={() => router.push(routes.entry(id, section.id, actions.duplicate(entry)))}
				/>
				<ListRow title={t`Move to…`} icon="arrow-right" onPress={() => setMoving(true)} />
			</ListSection>
			<Sheet isOpen={moving} onOpenChange={setMoving} title={t`Move to…`} closeLabel={t`Close`} detents={[0.7]}>
				<MoveTargets
					section={section}
					onMove={(target) => {
						setMoving(false);
						actions.moveTo(target);
						// The entry now lives in another section: back to the outline, where it shows.
						router.back();
					}}
				/>
			</Sheet>
		</>
	);
}

/** The summary: one rich text with the web's guidance, Improve and its Profile marker. */
type SummaryScreenProps = { id: string };

export function SummaryScreen({ id }: SummaryScreenProps) {
	return (
		<ResumeScreen id={id}>
			<ResumeSummary />
		</ResumeScreen>
	);
}

function ResumeSummary() {
	const { t } = useLingui();
	const title = useSectionTitle({ id: "summary", kind: "summary", type: "summary" });
	return (
		<SummaryEditor
			title={title}
			hint={t`2–3 sentences reads best`}
			labelAction={<ProfileMarker part={{ kind: "summary" }} />}
		/>
	);
}
