import { Alert, Button, Checkbox, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useRef, useState } from "react";
import { PORTFOLIO_AI_DRAFT_WORKS } from "@rezumi/schema/portfolio/ai";
import { Icon } from "@rezumi/ui/components/icon";
import { useSourceResume } from "../editor/context";
import { usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { applyDraftToEditor } from "./apply";
import { DraftNote, DraftProgress, draftFailure, useDraftRun } from "./draft-form";
import { useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu } from "@/features/billing/ai-source-menu";

/** "Write a draft with AI" at the top of Content, for a portfolio that has a resume to write from. */
export function AiDraftButton() {
	const [open, setOpen] = useState(false);
	const ai = useAiSource();
	const source = useSourceResume();
	if (!source.data || !ai.source) return null;
	return (
		<>
			<Button variant="secondary" fullWidth onPress={() => setOpen(true)}>
				<Icon name="sparkle" size={18} />
				<Trans>Write a draft with AI</Trans>
			</Button>
			{open && <AiDraftDialog onClose={() => setOpen(false)} />}
		</>
	);
}

type AiDraftDialogProps = { onClose: () => void };

function AiDraftDialog({ onClose }: AiDraftDialogProps) {
	const id = useId();
	const data = usePortfolioData();
	const works = data.works.items;
	const [note, setNote] = useState("");
	const [chosen, setChosen] = useState(() =>
		data.works.items
			.filter((work) => !work.hidden)
			.slice(0, PORTFOLIO_AI_DRAFT_WORKS)
			.map((work) => work.id),
	);
	const [failure, setFailure] = useState<string | null>(null);
	const draft = useDraftRun();
	const stopped = useRef(false);
	/** Getting the latest changes saved first. Like writing, it can't be left halfway. */
	const [saving, setSaving] = useState(false);
	const busy = saving || draft.isRunning;
	const full = chosen.length >= PORTFOLIO_AI_DRAFT_WORKS;

	const write = async () => {
		stopped.current = false;
		setFailure(null);
		// The server reads the saved works, so what was just typed has to get there first.
		setSaving(true);
		const saved = await usePortfolioEditorStore.getState().flush();
		setSaving(false);
		if (!saved) {
			setFailure(t`Your latest changes aren't saved yet. Wait for them to save, then try again.`);
			return;
		}
		try {
			const result = await draft.run({ workIds: chosen, ...(note.trim() ? { note: note.trim() } : {}) });
			applyDraftToEditor(result);
			onClose();
		} catch (error) {
			setFailure(draftFailure(error, stopped.current));
		}
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && !busy && onClose()}>
			<Modal.Container size="md" scroll="inside">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					{!busy && <Modal.CloseTrigger aria-label={t`Close`} />}
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							<Trans>Write a draft with AI</Trans>
						</Modal.Heading>
						<p className="text-sm text-muted">
							<Trans>
								From your resume: your greeting, About me, and the story of each work you pick. It replaces what's in
								those places. You can undo it.
							</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="grid gap-4">
						{busy ? (
							<DraftProgress
								onStop={() => {
									stopped.current = true;
									draft.stop();
								}}
							/>
						) : (
							<>
								{works.length > 0 && (
									<fieldset className="grid gap-2">
										<legend className="pb-2 text-sm font-medium">
											<Trans>Works to write (up to {PORTFOLIO_AI_DRAFT_WORKS})</Trans>
										</legend>
										{works.map((work) => {
											const selected = chosen.includes(work.id);
											return (
												<Checkbox
													key={work.id}
													isSelected={selected}
													isDisabled={!selected && full}
													onChange={(checked) =>
														setChosen((list) =>
															checked ? [...list, work.id] : list.filter((entry) => entry !== work.id),
														)
													}
												>
													<Checkbox.Content>
														<Checkbox.Control className="border border-separator">
															<Checkbox.Indicator />
														</Checkbox.Control>
														<span className="min-w-0 truncate text-sm">{work.title.trim() || t`Untitled work`}</span>
													</Checkbox.Content>
												</Checkbox>
											);
										})}
									</fieldset>
								)}
								<DraftNote value={note} onChange={setNote} />
								{failure && (
									<Alert status="warning">
										<Alert.Indicator />
										<Alert.Content>
											<Alert.Description>{failure}</Alert.Description>
										</Alert.Content>
									</Alert>
								)}
							</>
						)}
					</Modal.Body>
					{!busy && (
						<Modal.Footer className="flex-wrap items-center">
							<AiSourceMenu action="portfolio-draft" className="me-auto" />
							<Button variant="secondary" onPress={onClose}>
								<Trans>Cancel</Trans>
							</Button>
							<Button onPress={() => void write()}>
								<Icon name="sparkle" size={18} />
								<Trans>Write draft</Trans>
							</Button>
						</Modal.Footer>
					)}
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
