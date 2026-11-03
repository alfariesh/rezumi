import type { Application } from "../../types";
import { Widget } from "@heroui-pro/react";
import { Button, buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useId, useRef } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { PIPELINE } from "../../stages";
import { useInvalidateApplications } from "../../use-application-actions";
import { pickPdf } from "../file-attachment-field";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { useDialogStore } from "@/dialogs/store";
import { SettingsRow, SettingsRows } from "@/features/settings/section";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/** When the application was sent: its first stage at Applied or beyond. */
function sentOn(application: Application) {
	const applied = PIPELINE.indexOf("applied");
	const entry = [...application.activity]
		.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
		.find((item) => item.type === "stage" && PIPELINE.indexOf(item.stage) >= applied);
	return new Date(entry?.at ?? application.appliedAt);
}

type SentDocumentsProps = { application: Application; disabled: boolean };

type PdfRowProps = {
	title: string;
	value: { url: string; name: string } | null;
	attachLabel: string;
	disabled: boolean;
	onChange: (file: File | null) => void;
};

/** An uploaded PDF: its name as a link and a way to remove it, or a button to attach one. */
function PdfRow({ title, value, attachLabel, disabled, onChange }: PdfRowProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<SettingsRow
			as="li"
			icon="file-pdf"
			title={
				value ? (
					<a href={value.url} target="_blank" rel="noreferrer" className="hover:underline">
						{value.name}
					</a>
				) : (
					title
				)
			}
			description={value ? <Trans>PDF attached</Trans> : <Trans>No PDF attached</Trans>}
			inline
		>
			{value ? (
				<IconButton
					icon="x"
					iconSize={16}
					size="sm"
					label={t`Remove ${value.name}`}
					isDisabled={disabled}
					onPress={() => onChange(null)}
				/>
			) : (
				<Button variant="secondary" size="sm" isDisabled={disabled} onPress={() => inputRef.current?.click()}>
					<Icon name="upload-simple" size={16} />
					{attachLabel}
				</Button>
			)}
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				disabled={disabled}
				onChange={(event) => {
					const file = pickPdf(event);
					if (file) onChange(file);
				}}
			/>
		</SettingsRow>
	);
}

/**
 * What you sent: one row each for the resume, the cover letter and their uploaded PDFs. A linked resume opens the
 * version that was sent (read-only, with a way back to the latest); an empty row offers to prepare or write one.
 * Before the application is sent the widget is "Documents for this job".
 */
export function SentDocuments({ application, disabled }: SentDocumentsProps) {
	const { i18n } = useLingui();
	const titleId = useId();
	const navigate = useNavigate();
	const invalidate = useInvalidateApplications();
	const openDialog = useDialogStore((state) => state.openDialog);
	const { data: documents } = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));

	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: (error) => toastError(error, t`Couldn't save the documents. Try again.`),
	});
	const createLetter = useMutation(orpc.coverLetters.create.mutationOptions());

	const resume = documents?.find((document) => document.type === "resume" && document.id === application.resumeId);
	const letter = documents?.find((document) => document.type === "letter" && document.id === application.coverLetterId);
	const date = sentOn(application).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" });
	const busy = disabled || update.isPending;

	// A structured letter: the server fills the recipient from the application and makes it the application's letter.
	const writeLetter = async () => {
		const letterInput = {
			name: t`Cover letter — ${application.company}`.slice(0, 100),
			applicationId: application.id,
			...(application.resumeId ? { resumeId: application.resumeId } : {}),
		};
		try {
			const created = await createLetter.mutateAsync(letterInput);
			invalidate(application.id);
			void navigate({ to: "/builder/letter/$coverLetterId", params: { coverLetterId: created.id } });
		} catch (error) {
			toastError(error, t`Couldn't create the letter. Try again.`);
		}
	};

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading
				id={titleId}
				icon="paperclip"
				title={application.status === "saved" ? <Trans>Documents for this job</Trans> : <Trans>What you sent</Trans>}
			/>
			<Widget.Content>
				<SettingsRows>
					<SettingsRow
						as="li"
						icon="file-text"
						title={application.resumeId ? (resume?.name ?? t`Linked resume`) : t`Resume`}
						description={
							application.resumeId ? (
								application.sentResumeVersionId ? (
									application.sentCheckScore !== null ? (
										<Trans>
											Version sent {date} · Check {application.sentCheckScore}
										</Trans>
									) : (
										<Trans>Version sent {date}</Trans>
									)
								) : (
									<Trans>Linked · not sent yet</Trans>
								)
							) : (
								<Trans>Not prepared yet</Trans>
							)
						}
						inline
					>
						{application.resumeId ? (
							<Link
								to="/builder/$resumeId"
								params={{ resumeId: application.resumeId }}
								search={application.sentResumeVersionId ? { version: application.sentResumeVersionId } : {}}
								className={buttonVariants({ size: "sm", variant: "secondary" })}
							>
								<Icon name="arrow-up-right" size={16} />
								<Trans>Open</Trans>
							</Link>
						) : (
							<Button
								size="sm"
								variant="secondary"
								isDisabled={disabled}
								onPress={() => openDialog("document.new", { step: "copy", applicationId: application.id })}
							>
								<Icon name="copy" size={16} />
								<Trans>Prepare</Trans>
							</Button>
						)}
					</SettingsRow>

					<SettingsRow
						as="li"
						icon="envelope-simple"
						title={application.coverLetterId ? (letter?.name ?? t`Cover letter`) : t`Cover letter`}
						description={
							application.coverLetterId ? (
								application.sentCoverLetterVersionId ? (
									<Trans>Version sent {date}</Trans>
								) : (
									<Trans>Linked · not sent yet</Trans>
								)
							) : (
								<Trans>Not written yet</Trans>
							)
						}
						inline
					>
						{application.coverLetterId ? (
							<Link
								to="/builder/letter/$coverLetterId"
								params={{ coverLetterId: application.coverLetterId }}
								search={application.sentCoverLetterVersionId ? { version: application.sentCoverLetterVersionId } : {}}
								className={buttonVariants({ size: "sm", variant: "secondary" })}
							>
								<Icon name="arrow-up-right" size={16} />
								<Trans>Open</Trans>
							</Link>
						) : (
							<Button
								size="sm"
								variant="secondary"
								isDisabled={disabled || createLetter.isPending}
								onPress={() => void writeLetter()}
							>
								<Icon name="envelope-simple" size={16} />
								<Trans>Write</Trans>
							</Button>
						)}
					</SettingsRow>

					<PdfRow
						title={t`Resume PDF`}
						value={
							application.resumeFileUrl
								? { url: application.resumeFileUrl, name: application.resumeFileName || t`Resume file` }
								: null
						}
						attachLabel={t`Attach`}
						disabled={busy}
						onChange={(value) =>
							update.mutate({
								id: application.id,
								...(value ? { resumeFile: value } : { resumeFileUrl: null, resumeFileName: null }),
							})
						}
					/>

					<PdfRow
						title={t`Cover letter PDF`}
						value={
							application.coverLetterUrl
								? { url: application.coverLetterUrl, name: application.coverLetterName || t`Cover letter file` }
								: null
						}
						attachLabel={t`Attach`}
						disabled={busy}
						onChange={(value) =>
							update.mutate({
								id: application.id,
								...(value ? { coverLetterFile: value } : { coverLetterUrl: null, coverLetterName: null }),
							})
						}
					/>
				</SettingsRows>
			</Widget.Content>
		</Widget>
	);
}
