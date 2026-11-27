import type { StepProps } from "./parts";
import type { SiteImportProgress } from "@/features/profile/sources/site-import";
import type { WebsiteImportResult } from "@rezumi/schema/profile/website-import";
import { Button, Checkbox, FieldError, Input, Label, Modal, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { websiteAddress, websitePlatform } from "@rezumi/resume/profile-sources";
import { toast } from "@rezumi/ui/components/toast";
import { usePortfolioEditorStore } from "../../editor/store";
import { usePortfolioEditorUi } from "../../editor/ui";
import { BackButton, StepAlert, useReportBusy } from "./parts";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu, openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { profileQueryOptions } from "@/features/profile/queries";
import {
	inputProblemMessage,
	siteImportNoteMessage,
	siteImportStepLabel,
	sourceErrorMessage,
} from "@/features/profile/sources/messages";
import { importSite } from "@/features/profile/sources/site-import";
import { SiteWorksReview } from "@/features/profile/sources/site-works-review";
import { siteWorksProgressLabel, useSiteWorks } from "@/features/profile/sources/use-site-works";
import { client, orpc } from "@/libs/orpc/client";

/** Why the address can't be imported as typed, or null. */
function addressProblem(text: string): string | null {
	const url = websiteAddress(text);
	if (!url) return inputProblemMessage("website", "invalid");
	const platform = websitePlatform(url);
	if (platform) return inputProblemMessage("website", platform === "linkedin" ? "linkedin-site" : "platform-site");
	return null;
}

/**
 * Works from the person's own website: its address and "this is my site", the import's progress, then its works to
 * review (the new ones ticked) and save. Saving also adds their Profile projects. The import is the same one onboarding
 * runs, at the same price (the account's first is free); closing the dialog while it reads stops it.
 */
export function FromSite({ onBack, onClose, onBusy }: StepProps) {
	const id = useId();
	const ai = useAiSource();
	const queryClient = useQueryClient();
	const status = useQuery(orpc.profile.sources.status.queryOptions());
	const profile = useQuery(profileQueryOptions());
	const openWork = usePortfolioEditorUi((state) => state.openWork);
	const [text, setText] = useState("");
	const [own, setOwn] = useState(false);
	const [tried, setTried] = useState(false);
	const [progress, setProgress] = useState<SiteImportProgress | null>(null);
	const [importing, setImporting] = useState(false);
	const [result, setResult] = useState<WebsiteImportResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const controller = useRef<AbortController | null>(null);
	const siteWorks = useSiteWorks(result, profile.data?.data.sections.projects ?? []);
	const problem = addressProblem(text);
	useReportBusy(siteWorks.saving, onBusy);

	useEffect(() => () => controller.current?.abort(), []);

	const start = async () => {
		setTried(true);
		const url = websiteAddress(text);
		if (problem || !url || !own) return;
		controller.current?.abort();
		const current = new AbortController();
		controller.current = current;
		setImporting(true);
		setError(null);
		setProgress(null);
		try {
			const found = await importSite(url, aiSourceFields(ai), setProgress, current.signal);
			if (controller.current === current) setResult(found);
			// The account's free import may be used now: its price reads again.
			void queryClient.invalidateQueries({ queryKey: orpc.profile.sources.status.queryKey() });
		} catch (failure) {
			if (current.signal.aborted) return;
			if (!openPlanDialogForError(failure)) openCreditsDialogForError(failure);
			setError(sourceErrorMessage("website", failure));
		} finally {
			if (controller.current === current) setImporting(false);
		}
	};

	const save = async () => {
		setError(null);
		const store = usePortfolioEditorStore.getState();
		if (!(await store.flush())) {
			setError(t`Your latest changes aren't saved yet, so the works weren't added. Once they're saved, try again.`);
			return;
		}
		const done = await siteWorks.save();
		if (!done) return;
		const fresh = await client.portfolio.get().catch(() => null);
		if (fresh?.portfolio) usePortfolioEditorStore.getState().applyServerEdit(fresh.portfolio);
		onClose();
		const added = fresh?.portfolio?.data.works.items.at(-1);
		if (done.added === 1 && added) openWork(added.id);
		toast.add({
			description:
				done.added === 0 ? (
					<Trans>Your portfolio already has these works.</Trans>
				) : (
					<Plural value={done.added} one="Added # work from your site." other="Added # works from your site." />
				),
		});
	};

	if (result) {
		const notes = result.notes.flatMap((note) => siteImportNoteMessage(note) ?? []);
		return (
			<>
				<Modal.Body className="grid gap-3">
					{result.works.length === 0 ? (
						<p className="text-body-sm text-muted">
							<Trans>No works were found on this site. Add them one by one, or try another address.</Trans>
						</p>
					) : (
						<SiteWorksReview
							works={siteWorks.works}
							chosen={siteWorks.chosen}
							onToggle={siteWorks.toggle}
							imported={siteWorks.room.imported}
							room={siteWorks.room.room}
							planLimit={siteWorks.room.planLimited ? siteWorks.room.max : null}
							hasPortfolio
							published={siteWorks.room.published}
						/>
					)}
					{notes.length > 0 && (
						<div className="grid gap-0.5">
							{notes.map((note) => (
								<p key={note} className="text-body-xs text-muted">
									{note}
								</p>
							))}
						</div>
					)}
					{error && <StepAlert status="danger" message={error} />}
				</Modal.Body>
				<Modal.Footer>
					<BackButton isDisabled={siteWorks.saving} onPress={() => setResult(null)} />
					<Button isDisabled={siteWorks.count === 0 || siteWorks.saving} onPress={() => void save()}>
						{siteWorks.saving && <Spinner size="sm" color="current" />}
						{siteWorks.progress ? (
							siteWorksProgressLabel(siteWorks.progress)
						) : (
							<Plural value={siteWorks.count} _0="Add works" one="Add # work" other="Add # works" />
						)}
					</Button>
				</Modal.Footer>
			</>
		);
	}

	const free = status.data?.websiteImportFree === true;
	return (
		<>
			<Modal.Body className="grid gap-4">
				<p className="text-body-sm text-muted">
					<Trans>
						We read your home page and up to ten pages about your work, then show what we found. Nothing is added until
						you choose.
					</Trans>
				</p>
				<TextField
					fullWidth
					value={text}
					onChange={setText}
					isDisabled={importing}
					isInvalid={tried && problem !== null}
					validationBehavior="aria"
					type="url"
				>
					<Label htmlFor={`${id}-address`}>
						<Trans>Your website</Trans>
					</Label>
					<Input
						id={`${id}-address`}
						dir="ltr"
						variant="secondary"
						placeholder="yourname.com"
						autoComplete="off"
						spellCheck={false}
						onKeyDown={(event) => {
							if (event.key === "Enter") void start();
						}}
					/>
					<FieldError>{problem}</FieldError>
				</TextField>
				<Checkbox
					isSelected={own}
					onChange={setOwn}
					isDisabled={importing}
					isInvalid={tried && !own}
					validationBehavior="aria"
				>
					<Checkbox.Content>
						<Checkbox.Control>
							<Checkbox.Indicator />
						</Checkbox.Control>
						<Trans>This is my own site</Trans>
					</Checkbox.Content>
					<FieldError>
						<Trans>Confirm this is your own site.</Trans>
					</FieldError>
				</Checkbox>
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-xs text-muted">
					{free ? <Trans>Your first website import is free.</Trans> : null}
					<AiSourceMenu action="profile-website-import" free={free} className="-my-1" />
				</div>
				{importing && (
					<p role="status" className="flex items-center gap-2 text-body-sm text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						{siteImportStepLabel(progress)}
					</p>
				)}
				{error && <StepAlert status="danger" message={error} />}
				<p className="text-body-xs text-muted">
					<Trans>
						The pages' text goes to the AI. Pictures of the works you add are copied to your portfolio's storage.
					</Trans>
				</p>
			</Modal.Body>
			<Modal.Footer>
				<BackButton onPress={onBack} />
				<Button isDisabled={importing || !text.trim()} onPress={() => void start()}>
					{importing && <Spinner size="sm" color="current" />}
					<Trans>Find my works</Trans>
				</Button>
			</Modal.Footer>
		</>
	);
}
