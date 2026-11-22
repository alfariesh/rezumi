// Write (the web's write-panel.tsx): the locked and import notes, Basics, the outline of sections in print order with
// their entries, then Add section. Every field saves as you type; a locked resume shows the same outline read-only.
// Parts that differ from the account's Profile carry a calm marker (`profile-link.tsx`). Renders inside the editor
// chrome: no top bar and no safe areas of its own.
import type { Href } from "expo-router";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { getOutlineRows } from "@rezumi/resume/write";
import { AddSectionSheet, StartSuggestions } from "./add-section";
import { Outline } from "./outline";
import { ResumeProfileProvider } from "./profile-link";
import { resumeWriteSource } from "./source";
import { ResumeGate } from "./states";
import { BasicsCard, ImportedNote, LockedNote } from "./write-header";
import { requestFocus } from "@/features/entries/hooks";
import { WriteSourceProvider, useWriteData } from "@/features/entries/source";
import { routes } from "@/routes";
import { Button, Icon, Text } from "@/ui";

type WritePaneProps = {
	id: string;
	/** Where an import came from ("LinkedIn"): shows what came in until dismissed. */
	imported?: string | undefined;
	/** A section to open (a link from Check or the page). */
	section?: string | undefined;
};

export function WritePane(props: WritePaneProps) {
	return (
		<ResumeGate id={props.id}>
			<WriteSourceProvider source={resumeWriteSource}>
				<ResumeProfileProvider>
					<Write {...props} />
				</ResumeProfileProvider>
			</WriteSourceProvider>
		</ResumeGate>
	);
}

function Write({ id, imported, section }: WritePaneProps) {
	const { t } = useLingui();
	const router = useRouter();
	const locked = resumeWriteSource.useLocked();
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(section ? [section] : []));
	const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set(section ? [section] : []));
	const [adding, setAdding] = useState(false);
	const [importNote, setImportNote] = useState(imported);
	const empty = useWriteData((data) => getOutlineRows(data, added).length === 0, false);

	const push = (href: Href) => router.push(href);
	const openEntry = (sectionId: string, entryId: string) => push(routes.entry(id, sectionId, entryId));
	const openSummary = () => push(routes.entry(id, "summary", "summary"));
	const onAdded = (sectionId: string, entryId: string | null) => {
		setAdded((current) => new Set(current).add(sectionId));
		setOpen((current) => new Set(current).add(sectionId));
		if (entryId) {
			requestFocus(entryId);
			openEntry(sectionId, entryId);
		} else if (sectionId === "summary") openSummary();
	};
	const toggle = (sectionId: string) =>
		setOpen((current) => {
			const next = new Set(current);
			if (!next.delete(sectionId)) next.add(sectionId);
			return next;
		});

	const header = (
		<View className="gap-3 p-4 pb-2">
			{locked ? <LockedNote /> : null}
			{importNote ? <ImportedNote source={importNote} onDismiss={() => setImportNote(undefined)} /> : null}
			<BasicsCard onOpen={() => push(routes.entry(id, "basics", "basics"))} />
			{empty ? null : (
				<View className="flex-row flex-wrap items-center justify-between gap-2 pt-2">
					<Text size="xs" weight="semibold" tone="muted">
						{t`Sections in print order`}
					</Text>
					{locked ? null : (
						<Text size="xs" tone="muted">
							{t`Hold ⋮⋮ to move`}
						</Text>
					)}
				</View>
			)}
		</View>
	);
	const footer = (
		<View className="gap-3 p-4">
			{empty && !locked ? <StartSuggestions onAdded={onAdded} onImport={() => push(routes.new())} /> : null}
			{locked ? null : (
				<Button variant="secondary" onPress={() => setAdding(true)} testID="write-add-section">
					<Icon name="plus" size={16} />
					<Button.Label>{t`Add section`}</Button.Label>
				</Button>
			)}
			<Text size="xs" tone="muted" className="text-center">
				{t`Hidden sections keep their content but aren't printed or shared. Fields save as you type.`}
			</Text>
		</View>
	);

	return (
		<View className="flex-1 bg-background">
			<Outline
				added={added}
				open={open}
				onToggle={toggle}
				onOpenEntry={openEntry}
				onOpenSummary={openSummary}
				header={header}
				footer={footer}
			/>
			<AddSectionSheet isOpen={adding} onOpenChange={setAdding} added={added} onAdded={onAdded} />
		</View>
	);
}
