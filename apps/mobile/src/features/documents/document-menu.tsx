// The resume editor's document menu, as the web builder's: Rename, Duplicate, Lock editing, Notes, Details, Print,
// More download formats, History, then Move to Trash (with Undo). In the editor chrome (`inChrome`) the chrome's ⋯
// opens it; elsewhere (Download & history) it brings its own ⋯ button. It owns no draft lifecycle: the builder layout
// does, and this only reads and updates the open resume.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { DetailsPanel, DuplicatePanel, NotesPanel } from "./document-menu-panels";
import { RenamePanel } from "./menu-panels";
import { useDocumentOperations } from "./queries";
import { client } from "@/api/client";
import { useResumeStore } from "@/draft";
import { resume as draftResume } from "@/draft/runtime";
import { flushResume } from "@/features/share/document";
import { printResume } from "@/features/share/files";
import { routes } from "@/routes";
import { useBuilderChrome } from "@/shell/builder-chrome";
import { useKeyCommands } from "@/shell/key-commands";
import { Button, IconButton, ListRow, ListSection, Sheet, showToast } from "@/ui";

type Step = "menu" | "rename" | "duplicate" | "notes" | "details";

type DocumentMenuProps = {
	id: string;
	/** Opens from the editor chrome's ⋯ instead of its own button. */
	inChrome?: boolean;
};

export function DocumentMenu({ id, inChrome = false }: DocumentMenuProps) {
	const { t } = useLingui();
	const router = useRouter();
	const draft = useResumeStore();
	const resume = draft.document?.id === id ? draft.document : null;
	const operations = useDocumentOperations();
	const [step, setStep] = useState<Step | null>(null);
	const pending = useRef(Promise.resolve(false));
	const [printing, setPrinting] = useState(false);
	const busy = operations.busy || printing;

	const run = async (action: () => Promise<unknown>) => {
		const task = operations.run(action);
		pending.current = task;
		if (await task) setStep(null);
	};
	const go = (href: Parameters<typeof router.push>[0]) => {
		setStep(null);
		router.push(href);
	};
	const print = () => {
		if (!resume || printing) return;
		setPrinting(true);
		void printResume(resume.data, resume.name)
			.catch(() => showToast({ title: t`Couldn't print. Try again.`, variant: "danger" }))
			.finally(() => setPrinting(false));
	};
	const trash = (name: string) =>
		void run(async () => {
			await flushResume(id);
			await client.documents.trash({ type: "resume", id });
			await useResumeStore.getState().close();
			router.replace(routes.documents());
			showToast({
				title: t`“${name}” moved to Trash`,
				undo: {
					label: t`Undo`,
					onUndo: () =>
						void pending.current.then(() => operations.run(() => client.documents.restore({ type: "resume", id }))),
				},
			});
		});

	useBuilderChrome(inChrome ? { onMenu: resume ? () => setStep("menu") : undefined } : {});
	useKeyCommands(inChrome ? [{ id: "print", input: "p", title: t`Print`, run: print }] : []);

	const titles: Record<Step, string> = {
		menu: resume?.name ?? t`Document options`,
		rename: t`Rename`,
		duplicate: t`Duplicate resume`,
		notes: t`Notes`,
		details: t`Resume details`,
	};
	const locked = resume?.isLocked ?? false;

	return (
		<>
			{inChrome ? null : (
				<IconButton
					icon="dots-three"
					label={t`Document options`}
					isDisabled={!resume}
					onPress={() => setStep("menu")}
				/>
			)}
			<Sheet
				isOpen={step !== null && !!resume}
				onOpenChange={(open) => {
					if (!open && !busy) setStep(null);
				}}
				title={step ? titles[step] : undefined}
				closeLabel={t`Close`}
				canDismiss={!busy}
				testID="builder-document-menu"
			>
				{resume && step === "menu" ? (
					<View className="gap-4">
						<ListSection>
							<ListRow
								icon="pencil-simple"
								title={t`Rename…`}
								description={locked ? t`Unlock it first` : undefined}
								isDisabled={locked || busy}
								onPress={() => setStep("rename")}
							/>
							<ListRow icon="copy" title={t`Duplicate`} isDisabled={busy} onPress={() => setStep("duplicate")} />
							<ListRow
								icon={locked ? "lock-open" : "lock"}
								title={locked ? t`Unlock editing` : t`Lock editing`}
								chevron={false}
								isDisabled={busy}
								onPress={() =>
									void run(async () => {
										if (!locked) await flushResume(id);
										await client.documents.setLocked({ type: "resume", id, isLocked: !locked });
										// Metadata only: a refresh keeps the undo history.
										await draftResume.refresh();
									})
								}
							/>
							<ListRow icon="note" title={t`Notes`} isDisabled={busy} onPress={() => setStep("notes")} />
							<ListRow icon="info" title={t`Details`} isDisabled={busy} onPress={() => setStep("details")} />
							<ListRow icon="printer" title={t`Print`} chevron={false} isDisabled={busy} onPress={print} />
							{inChrome ? (
								<ListRow
									icon="download-simple"
									title={t`More download formats`}
									isDisabled={busy}
									onPress={() => go(routes.export(id))}
								/>
							) : null}
							<ListRow
								icon="clock-counter-clockwise"
								title={t`History`}
								isDisabled={busy}
								onPress={() => go(routes.history(id))}
							/>
						</ListSection>
						<ListSection>
							<ListRow
								icon="trash"
								title={t`Move to Trash`}
								tone="danger"
								description={locked ? t`Unlock it first` : undefined}
								isDisabled={locked || busy}
								onPress={() => trash(resume.name)}
								testID="builder-document-menu-trash"
							/>
						</ListSection>
					</View>
				) : null}
				{resume && step && step !== "menu" ? (
					<View className="gap-2">
						{step === "rename" ? (
							<RenamePanel
								name={resume.name}
								busy={busy}
								onSave={(name) =>
									void run(async () => {
										const trimmed = name.trim();
										if (!trimmed) return;
										await flushResume(id);
										useResumeStore.getState().updateDocument((value) => {
											value.name = trimmed;
										});
										await flushResume(id);
									})
								}
							/>
						) : null}
						{step === "duplicate" ? <DuplicatePanel id={id} resume={resume} busy={busy} run={run} /> : null}
						{step === "notes" ? <NotesPanel resume={resume} /> : null}
						{step === "details" ? <DetailsPanel resume={resume} /> : null}
						<Button variant="ghost" isDisabled={busy} onPress={() => setStep("menu")}>
							<Button.Label>{t`Back`}</Button.Label>
						</Button>
					</View>
				) : null}
			</Sheet>
		</>
	);
}
