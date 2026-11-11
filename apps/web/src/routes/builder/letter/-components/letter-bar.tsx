import { Dropdown, Label, Separator, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { cn } from "@rezumi/utils/style";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { createLetterFile, letterFileName } from "@/features/letters/export";
import { useLetterEditorStore } from "@/features/letters/store";
import { useLetterMode } from "@/features/letters/use-letter-mode";
import { DocumentMenuTrigger, DocumentTitle, ZoomControls } from "@/features/resume/editor/chrome";
import { DownloadButtons, EditorBarFrame } from "@/features/resume/editor/chrome/bar";
import { ModeSwitch } from "@/features/resume/editor/chrome/mode-switch";
import { STATUS_WORDS } from "@/features/resume/editor/save-status";
import { usePrompt } from "@/hooks/use-confirm";
import { getOrpcErrorMessage, getReadableErrorMessage } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

type LetterBarProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
};

/** Write · Design, then AI and History, down the left of the panel card. */
export function LetterModeTabs() {
	const [mode, setMode] = useLetterMode();

	return (
		<ModeSwitch
			selected={mode}
			onChange={setMode}
			views={["assistant", "history"]}
			modes={[
				{ id: "write", icon: "pencil-simple", label: t`Write` },
				{ id: "design", icon: "palette", label: t`Design` },
			]}
		/>
	);
}

/**
 * The 56px bar: back, the letter's name, menu and save state · zoom. Phones keep Download PDF at its end; elsewhere
 * it floats over the page (`LetterDownload`).
 */
export function LetterBar({ layout, pinnable }: LetterBarProps) {
	return (
		<EditorBarFrame
			layout={layout}
			pinnable={pinnable}
			menu={<LetterMenu />}
			center={<ZoomControls compact={layout === "tablet"} />}
		>
			{layout === "mobile" && <LetterDownload compact />}
		</EditorBarFrame>
	);
}

/** Download PDF and the ▾ for every format: floating over the page, or (`compact`) one icon in the phone's bar. */
export function LetterDownload({ compact = false }: { compact?: boolean }) {
	const download = useDownloadLetter();
	return (
		<DownloadButtons busy={download.busy} onDownload={() => void download.run()} compact={compact} iconOnly={false} />
	);
}

/** Download PDF: the letter as it prints, with the sender's header, named First-Last-Cover-Letter.pdf. */
export function useDownloadLetter() {
	const [busy, setBusy] = useState(false);

	const run = async () => {
		const letter = useLetterEditorStore.getState().letter;
		if (!letter || busy) return;
		setBusy(true);
		const toastId = toast.add({ type: "loading", description: t`Generating PDF…` });
		try {
			const blob = await createLetterFile(letter, "pdf");
			downloadWithAnchor(blob, `${letterFileName(letter)}.pdf`);
		} catch (error) {
			toast.add({
				type: "error",
				description: getReadableErrorMessage(error, t`Couldn't generate the PDF. Try again.`),
			});
		}
		setBusy(false);
		toast.close(toastId);
	};

	return { run, busy };
}

const failed = (error: unknown) =>
	toast.add({
		type: "error",
		description: getOrpcErrorMessage(error, { fallback: t`Couldn't update the letter. Try again.` }),
	});

/** The letter's name, renamed in place, then the ▾ menu (rename, duplicate, lock and Move to Trash) and the save state. */
function LetterMenu() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const prompt = usePrompt();
	const id = useLetterEditorStore((state) => state.letter?.id ?? "");
	const name = useLetterEditorStore((state) => state.letter?.name ?? "");
	const isLocked = useLetterEditorStore((state) => state.letter?.isLocked ?? false);
	const ref = { type: "letter" as const, id };

	const rename = async () => {
		const next = await prompt(t`Rename letter`, { defaultValue: name });
		const trimmed = next?.trim().slice(0, 100);
		if (trimmed && trimmed !== name) useLetterEditorStore.getState().edit({ name: trimmed });
	};

	const duplicate = async () => {
		try {
			if (!(await useLetterEditorStore.getState().flush()))
				throw new Error(t`Couldn't save your changes. Try again before continuing.`);
			const copy = await client.coverLetters.duplicate({ id });
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			toast.add({ description: t`Letter duplicated` });
			void navigate({ to: "/builder/letter/$coverLetterId", params: { coverLetterId: copy.id } });
		} catch (error) {
			openPlanDialogForError(error);
			failed(error);
		}
	};

	// Locking moves the letter's revision on, so the letter is read again afterwards.
	const setLocked = (locked: boolean) =>
		useLetterEditorStore
			.getState()
			.change(async () => {
				await client.documents.setLocked({ ...ref, isLocked: locked });
				return client.coverLetters.getById({ id });
			})
			.catch(failed);

	// Undoable, so it doesn't ask first: the letter waits in Trash for 30 days.
	const trash = async () => {
		try {
			if (!(await useLetterEditorStore.getState().flush()))
				throw new Error(t`Couldn't save your changes. Try again before continuing.`);
			await client.documents.trash(ref);
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			void navigate({ to: "/dashboard/documents" });
			toast.add({
				description: t`“${name}” moved to Trash`,
				actionProps: {
					children: t`Undo`,
					onClick: () =>
						void client.documents
							.restore(ref)
							.then(() => queryClient.invalidateQueries({ queryKey: orpc.documents.key() }))
							.catch(failed),
				},
			});
		} catch (error) {
			failed(error);
		}
	};

	return (
		<>
			<DocumentTitle
				name={name}
				isLocked={isLocked}
				onRename={(next) => useLetterEditorStore.getState().edit({ name: next })}
			/>
			<Dropdown>
				<DocumentMenuTrigger name={name} />
				<Dropdown.Popover placement="bottom start" className="w-60">
					<Dropdown.Menu>
						<Dropdown.Item id="rename" textValue={t`Rename…`} isDisabled={isLocked} onAction={() => void rename()}>
							<Icon name="pencil-simple" />
							<Label>
								<Trans>Rename…</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Item id="duplicate" textValue={t`Duplicate`} onAction={() => void duplicate()}>
							<Icon name="copy" />
							<Label>
								<Trans>Duplicate</Trans>
							</Label>
						</Dropdown.Item>
						<Dropdown.Item
							id="lock"
							textValue={isLocked ? t`Unlock editing` : t`Lock editing`}
							onAction={() => void setLocked(!isLocked)}
						>
							<Icon name={isLocked ? "lock-open" : "lock"} />
							<Label>{isLocked ? <Trans>Unlock editing</Trans> : <Trans>Lock editing</Trans>}</Label>
						</Dropdown.Item>
						<Separator />
						<Dropdown.Item
							id="trash"
							textValue={t`Move to Trash`}
							variant="danger"
							isDisabled={isLocked}
							onAction={() => void trash()}
						>
							<Icon name="trash" />
							<Label>
								<Trans>Move to Trash</Trans>
							</Label>
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
			<LetterSaveStatus />
		</>
	);
}

/** Saved, Saving…, Not saved · Retry, or Changed elsewhere · Reload (after which the letter reads as saved). */
function LetterSaveStatus() {
	const status = useLetterEditorStore((state) => state.status);
	const id = useLetterEditorStore((state) => state.letter?.id ?? "");

	const reload = async () => {
		try {
			useLetterEditorStore.getState().load(await client.coverLetters.getById({ id }));
		} catch (error) {
			failed(error);
		}
	};

	const words = {
		saving: t`Saving…`,
		saved: t`Saved`,
		error: t`Not saved`,
		conflict: t`Changed elsewhere`,
	}[status];

	return (
		<span
			role="status"
			aria-live="polite"
			title={words}
			className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-muted"
		>
			{status === "saving" && (
				<>
					<Spinner size="sm" color="current" aria-hidden />
					<span className={STATUS_WORDS}>
						<Trans>Saving…</Trans>
					</span>
				</>
			)}
			{status === "saved" && (
				<>
					<Icon name="cloud-check" size={16} />
					<span className={STATUS_WORDS}>
						<Trans>Saved</Trans>
					</span>
				</>
			)}
			{status === "error" && (
				<span className={cn(ENTER_CLASS, "flex min-w-0 items-center gap-1.5 text-danger")}>
					<Icon name="cloud-warning" size={16} />
					<span className={STATUS_WORDS}>
						<Trans>Not saved</Trans>
					</span>
					<span aria-hidden="true">·</span>
					{/* An inline text action inside the 16px status line: a HeroUI Button would be too tall here. */}
					<button
						type="button"
						onClick={() => void useLetterEditorStore.getState().flush()}
						aria-label={t`Retry saving`}
						className="cursor-(--cursor-interactive) rounded-sm font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus"
					>
						<Trans>Retry</Trans>
					</button>
				</span>
			)}
			{status === "conflict" && (
				<span className={cn(ENTER_CLASS, "flex min-w-0 items-center gap-1.5 text-warning")}>
					<Icon name="cloud-warning" size={16} />
					<span className="truncate">
						<span className={STATUS_WORDS}>
							<Trans>Changed elsewhere</Trans>
						</span>
					</span>
					<span aria-hidden="true">·</span>
					<button
						type="button"
						onClick={() => void reload()}
						className="cursor-(--cursor-interactive) rounded-sm font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus"
					>
						<Trans>Reload</Trans>
					</button>
				</span>
			)}
		</span>
	);
}
