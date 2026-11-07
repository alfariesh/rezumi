import type { StepProps } from "./parts";
import { Button, Checkbox, Label, Modal, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useState } from "react";
import { useSourceResume } from "../../editor/context";
import { usePortfolioData, usePortfolioEditorStore, usePortfolioRecord } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { portfolioErrorMessage } from "../../errors";
import { usePortfolioLimits } from "../limits";
import { resumeProjects, workRoom } from "../works";
import { BackButton, StepAlert } from "./parts";
import { client } from "@/libs/orpc/client";

/** The edits waiting to be saved couldn't be saved first, so the server wasn't asked. */
class UnsavedEdits extends Error {}

/** Why projects couldn't be added, in the person's words. */
function importErrorMessage(error: unknown): string {
	if (error instanceof UnsavedEdits)
		return t`Your latest changes aren't saved yet, so the projects weren't added. Once they're saved, try again.`;
	const fallback = t`The projects couldn't be added. Check your connection, then try again.`;
	return error instanceof ORPCError ? portfolioErrorMessage(error, { fallback }) : fallback;
}

/** Resume projects as works: copied through the server, which checks the resume and saves the new works. */
export function FromResume({ onBack, onClose }: StepProps) {
	const data = usePortfolioData();
	const record = usePortfolioRecord();
	const source = useSourceResume();
	const limits = usePortfolioLimits();
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const projects = resumeProjects(source.data, data.works.items);
	const [chosen, setChosen] = useState<Set<string>>(() => new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const room = workRoom(data, limits.works);

	const add = async () => {
		setBusy(true);
		setError(null);
		try {
			const store = usePortfolioEditorStore.getState();
			if (!(await store.flush())) throw new UnsavedEdits();
			const current = usePortfolioEditorStore.getState().portfolio;
			if (!current) return;
			const ids = projects.filter((project) => chosen.has(project.id)).map((project) => project.id);
			const saved = await client.portfolio.importWorks({ resumeItemIds: ids, expectedUpdatedAt: current.updatedAt });
			usePortfolioEditorStore.getState().applyServerEdit(saved);
			const added = saved.data.works.items.filter(
				(work) => work.fromResumeItemId && ids.includes(work.fromResumeItemId),
			);
			onClose();
			if (added.length === 1 && added[0]) openWork(added[0].id);
		} catch (failure) {
			setError(importErrorMessage(failure));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Modal.Body className="grid gap-3">
				{!record.sourceResume || !source.data ? (
					<p className="text-sm text-muted">
						<Trans>This portfolio has no resume to take projects from. Choose one in Publish → Source resume.</Trans>
					</p>
				) : projects.length === 0 ? (
					<p className="text-sm text-muted">
						<Trans>Your resume has no projects yet. Add them in the resume editor, or start an empty work.</Trans>
					</p>
				) : (
					<ul className="grid gap-1">
						{projects.map((project) => (
							<li key={project.id}>
								<Checkbox
									isDisabled={project.imported || (!chosen.has(project.id) && chosen.size >= room)}
									isSelected={project.imported || chosen.has(project.id)}
									onChange={(selected) =>
										setChosen((previous) => {
											const next = new Set(previous);
											if (selected) next.add(project.id);
											else next.delete(project.id);
											return next;
										})
									}
									className="w-full rounded-xl p-2 hover:bg-default"
								>
									<Checkbox.Content className="w-full items-start">
										<Checkbox.Control className="mt-0.5">
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Label className="grid flex-1 gap-0.5 text-sm">
											<span>{project.name}</span>
											{(project.period || project.imported) && (
												<span className="text-xs text-muted">
													{[project.period, project.imported ? t`Already in your work` : ""]
														.filter(Boolean)
														.join(" · ")}
												</span>
											)}
										</Label>
									</Checkbox.Content>
								</Checkbox>
							</li>
						))}
					</ul>
				)}
				{error && <StepAlert status="danger" message={error} />}
			</Modal.Body>
			<Modal.Footer>
				<BackButton onPress={onBack} />
				<Button isDisabled={chosen.size === 0 || busy} onPress={() => void add()}>
					{busy && <Spinner size="sm" color="current" />}
					<Plural value={chosen.size} _0="Add work" one="Add # work" other="Add # works" />
				</Button>
			</Modal.Footer>
		</>
	);
}
