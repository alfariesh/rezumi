import { Button, Dropdown, Label, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { completeProfile, profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { storeSavedProfile } from "./queries";
import { saveProfileNow, useProfileDraftStore } from "./store";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { detectImportKind, IMPORT_ACCEPT, ImportError } from "@/features/resume/import/read-file";
import { requireImportKind, useReadResumeFile } from "@/features/resume/import/use-read-resume-file";
import { getOrpcErrorMessage, toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/**
 * While the Profile has no career yet: fill it from a file (a resume or a LinkedIn export, read the way New document
 * reads it, without making a resume) or from one of the account's resumes. Either way only what the Profile lacks is
 * added; nothing typed here changes.
 */
export function FillProfile() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [reading, setReading] = useState(false);
	const readFile = useReadResumeFile();

	const importFile = async (file: File) => {
		setReading(true);
		try {
			const kind = requireImportKind(await detectImportKind(file));
			if (kind === "cover-letter-json")
				throw new ImportError(t`This is a cover letter. Import a resume or a LinkedIn export instead.`);
			const imported = await readFile(file, kind);
			const { data, update } = useProfileDraftStore.getState();
			if (!data) return;
			const next = completeProfile(profileFromResume(data), imported);
			if (!next) {
				toast.add({ description: t`Your Profile already has everything in ${file.name}.` });
				return;
			}
			// An ordinary edit of the Profile: it saves like typing and Undo takes it back.
			const filled = resumeDataFromProfile(next, data);
			update(
				(draft) => {
					draft.basics = filled.basics;
					draft.picture.url = filled.picture.url;
					draft.summary.content = filled.summary.content;
					draft.sections = filled.sections as typeof draft.sections;
				},
				{ newStep: true },
			);
			toast.add({
				description: t`Filled your Profile from ${file.name}. Check each section.`,
				actionProps: { children: t`Undo`, onClick: () => useProfileDraftStore.getState().undo() },
			});
		} catch (error) {
			if (!openPlanDialogForError(error)) openCreditsDialogForError(error);
			toast.add({
				type: "error",
				description:
					error instanceof ImportError
						? error.message
						: getOrpcErrorMessage(error, {
								byCode: {
									BAD_REQUEST: t`The file couldn't be read as a resume.`,
									BAD_GATEWAY: t`Couldn't reach the AI provider. Try again in a moment.`,
								},
								fallback: t`Couldn't read the file. Try again.`,
							}),
			});
		} finally {
			setReading(false);
		}
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
							Import a resume or a LinkedIn export, or take what's in one of your resumes. Only what your Profile is
							missing is added.
						</Trans>
					</p>
				</div>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={IMPORT_ACCEPT}
				className="hidden"
				aria-label={t`Choose a file to fill your Profile`}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void importFile(file);
				}}
			/>
			<div className="flex flex-wrap gap-2 sm:ps-15">
				<Button isPending={reading} onPress={() => inputRef.current?.click()}>
					{reading && <Spinner size="sm" color="current" aria-hidden />}
					{reading ? <Trans>Reading the file…</Trans> : <Trans>Import a file</Trans>}
				</Button>
				<FillFromResume />
			</div>
		</section>
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
