import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourcesStatus } from "@rezumi/schema/profile/sources";
import { Button, Dropdown, Label, Modal, Skeleton, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { storeSavedProfile } from "./queries";
import { countReviewEntries, isFetching } from "./sources/model";
import { focusFirstProblem, SourceFields, SourcesNote } from "./sources/source-fields";
import { SourceProgress } from "./sources/source-progress";
import { SourceReview } from "./sources/source-review";
import { finishReview, useSourcesFlow } from "./sources/use-sources-flow";
import { saveProfileNow, useProfileDraftStore } from "./store";
import { CareerLoadError } from "@/features/career/load-state";
import { toastError } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { orpc } from "@/libs/orpc/client";

const FIELD_PREFIX = "profile-source";

/**
 * While the Profile has no career yet: fill it from what the person has (a LinkedIn link, a resume file, a GitHub
 * username, a website), reviewed before anything goes in, or from one of the account's resumes. Onboarding offers the
 * same sources with the same fields and review. Only what the Profile lacks is added; nothing typed here changes.
 */
export function FillProfile() {
	const [open, setOpen] = useState(false);
	// What the sources add to: the Profile as it is when the dialog opens. A new key starts a fresh run.
	const [run, setRun] = useState<{ base: ProfileData; key: number } | null>(null);

	const openDialog = () => {
		const data = useProfileDraftStore.getState().data;
		if (!data) return;
		setRun({ base: profileFromResume(data), key: Date.now() });
		setOpen(true);
	};

	return (
		<section className="grid gap-3 rounded-2xl border border-dashed border-border p-5">
			<div className="flex items-start gap-4">
				<span className="grid size-11 shrink-0 place-items-center rounded-xl bg-default text-muted">
					<Icon name="file-arrow-up" size={24} />
				</span>
				<div className="grid gap-1">
					<h2 className="text-base font-semibold">
						<Trans>Fill your Profile from what you have</Trans>
					</h2>
					<p className="text-body-sm text-muted">
						<Trans>
							Bring your LinkedIn, a resume file, your GitHub or your website, or take what's in one of your resumes.
							Only what your Profile is missing is added, and you check it first.
						</Trans>
					</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-2 sm:ps-15">
				<Button onPress={openDialog}>
					<Trans>Bring what you have</Trans>
				</Button>
				<FillFromResume />
			</div>
			<FillFromSourcesDialog open={open} onOpenChange={setOpen} run={run} />
		</section>
	);
}

type FillFromSourcesDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	run: { base: ProfileData; key: number } | null;
};

/** The sources, then what they found to review, in one dialog. Adding is an ordinary Profile edit, with Undo. */
function FillFromSourcesDialog({ open, onOpenChange, run }: FillFromSourcesDialogProps) {
	const mobile = useBreakpoint() === "mobile";
	const status = useQuery({ ...orpc.profile.sources.status.queryOptions(), enabled: open });

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size={mobile ? "full" : "lg"} scroll="inside">
				<Modal.Dialog className="sm:max-w-[640px]">
					<Modal.CloseTrigger aria-label={t`Close`} />
					{status.isError && !status.data ? (
						<Modal.Body>
							<CareerLoadError onRetry={() => void status.refetch()} />
						</Modal.Body>
					) : status.data && run ? (
						<SourcesSteps key={run.key} status={status.data} base={run.base} onDone={() => onOpenChange(false)} />
					) : (
						<Modal.Body>
							<div role="status" className="grid gap-4 py-2">
								<span className="sr-only">{t`Loading`}</span>
								<Skeleton className="h-7 w-56 rounded-lg" />
								{[0, 1, 2].map((row) => (
									<div key={row} className="grid gap-2">
										<Skeleton className="h-4 w-32 rounded-md" />
										<Skeleton className="h-10 rounded-xl" />
									</div>
								))}
							</div>
						</Modal.Body>
					)}
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

type SourcesStepsProps = {
	status: SourcesStatus;
	base: ProfileData;
	onDone: () => void;
};

function SourcesSteps({ status, base, onDone }: SourcesStepsProps) {
	const [phase, setPhase] = useState<"sources" | "review">("sources");
	const [saving, setSaving] = useState(false);
	const [copiedPhotos] = useState(() => new Map<string, string>());
	const descriptionId = useId();
	const availability = { linkedin: status.linkedin, github: status.github, website: status.website };
	const flow = useSourcesFlow({
		base,
		availability,
		accountImage: status.account.image,
		github: status.account.githubUsername ?? "",
	});
	const fetching = isFetching(flow.runs);
	const kept = countReviewEntries(flow.groups, flow.excluded);
	const found = flow.groups.length > 0 || flow.photos.length > 0;

	const start = () => {
		const problems = flow.start();
		if (problems) {
			focusFirstProblem(FIELD_PREFIX, problems);
			return;
		}
		setPhase("review");
	};

	const add = async () => {
		setSaving(true);
		const { data: reviewed, photoFailed } = await finishReview(flow, copiedPhotos);
		const { data, update } = useProfileDraftStore.getState();
		setSaving(false);
		if (!data) return;
		// An ordinary edit of the Profile: it saves like typing, and Undo takes it back.
		const filled = resumeDataFromProfile(reviewed, data);
		update(
			(draft) => {
				draft.basics = filled.basics;
				draft.picture.url = filled.picture.url;
				draft.summary.content = filled.summary.content;
				draft.sections = filled.sections as typeof draft.sections;
			},
			{ newStep: true },
		);
		onDone();
		toast.add({
			description: photoFailed
				? t`Added to your Profile, without the photo: it couldn't be copied. Check each section.`
				: t`Added to your Profile. Check each section.`,
			actionProps: { children: t`Undo`, onClick: () => useProfileDraftStore.getState().undo() },
		});
	};

	if (phase === "sources")
		return (
			<>
				<Modal.Header>
					<Modal.Heading>
						<Trans>Bring what you have</Trans>
					</Modal.Heading>
					<p id={descriptionId} className="text-body-sm text-muted">
						<Trans>Add any of these. You check what we find before it goes in your Profile.</Trans>
					</p>
				</Modal.Header>
				<Modal.Body className="grid gap-5 py-1">
					<SourceFields
						idPrefix={FIELD_PREFIX}
						inputs={flow.inputs}
						onChange={flow.change}
						availability={availability}
						problems={flow.problems}
						accountGithub={status.account.githubUsername}
					/>
					<SourcesNote availability={availability} />
				</Modal.Body>
				<Modal.Footer>
					<Button slot="close" variant="tertiary">
						<Trans>Cancel</Trans>
					</Button>
					<Button isDisabled={!flow.hasInput} onPress={start}>
						<Trans>Continue</Trans>
					</Button>
				</Modal.Footer>
			</>
		);

	return (
		<>
			<Modal.Header>
				<Modal.Heading>
					<Trans>Check what we found</Trans>
				</Modal.Heading>
				<p className="text-body-sm text-muted">
					<Trans>Untick anything you'd rather leave out.</Trans>
				</p>
			</Modal.Header>
			<Modal.Body className="grid gap-4 py-1">
				<SourceProgress runs={flow.runs} onRetry={flow.retry} />
				{found && (
					<div className={ENTER_CLASS}>
						<SourceReview
							merged={flow.merged}
							groups={flow.groups}
							excluded={flow.excluded}
							onExcludedChange={flow.setExcluded}
							photos={flow.photos}
							photo={flow.photo}
							onPhotoChange={flow.setPhoto}
							name={base.basics.name || status.account.name}
						/>
					</div>
				)}
				{!found && !fetching && (
					<p className={`${ENTER_CLASS} text-body-sm text-muted`}>
						<Trans>Nothing new to add: your Profile already has what we found, or the sources couldn't be read.</Trans>
					</p>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button variant="tertiary" isDisabled={saving} onPress={() => setPhase("sources")}>
					<Trans>Back</Trans>
				</Button>
				<Button
					isDisabled={fetching || !found || (kept === 0 && !flow.photo)}
					isPending={saving}
					onPress={() => void add()}
				>
					{fetching ? (
						<Trans>Reading…</Trans>
					) : (
						<Plural value={kept} _0="Add the photo" one="Add # entry" other="Add # entries" />
					)}
				</Button>
			</Modal.Footer>
		</>
	);
}

/** Fill from a resume…: the server adds what the Profile lacks from a resume the account owns. */
function FillFromResume() {
	const queryClient = useQueryClient();
	const { data: documents } = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));
	const resumes = (documents ?? []).filter((document) => document.type === "resume");
	const { mutateAsync, isPending } = useMutation(orpc.profile.fillFromResume.mutationOptions());

	const fill = async (resumeId: string) => {
		const resume = resumes.find((item) => item.id === resumeId);
		// The server reads the saved Profile, so what's typed goes first.
		if (!(await saveProfileNow())) return;
		const before = useProfileDraftStore.getState().updatedAt;
		try {
			const result = await mutateAsync({ resumeId });
			storeSavedProfile(queryClient, result);
			useProfileDraftStore.getState().load(result);
			const name = resume?.name ?? "";
			toast.add({
				description:
					result.updatedAt?.getTime() === before?.getTime()
						? t`Your Profile already has everything in “${name}”.`
						: t`Filled your Profile from “${name}”. Check each section.`,
			});
		} catch (error) {
			toastError(error, t`Couldn't fill your Profile. Try again.`);
		}
	};

	if (resumes.length === 0) return null;

	return (
		<Dropdown>
			<Button variant="secondary" isPending={isPending}>
				{isPending && <Spinner size="sm" color="current" aria-hidden />}
				<Trans>Fill from a resume…</Trans>
			</Button>
			<Dropdown.Popover placement="bottom start" className="max-h-80 w-72">
				<Dropdown.Menu>
					{resumes.map((resume) => (
						<Dropdown.Item key={resume.id} id={resume.id} textValue={resume.name} onAction={() => void fill(resume.id)}>
							<Icon name="file-text" className="text-muted" />
							<Label className="truncate">{resume.name}</Label>
						</Dropdown.Item>
					))}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
