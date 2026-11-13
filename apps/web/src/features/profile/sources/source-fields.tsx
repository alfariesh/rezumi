import type { SourceAvailability, SourceId, SourceInputProblem, SourceInputs } from "./model";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import type { DropEvent } from "react-aria";
import { DropZone, useDropZonePickerContext } from "@heroui-pro/react";
import { Button, Checkbox, Description, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { isFileDropItem } from "react-aria-components";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { formatFileSize } from "@rezumi/utils/file";
import { cn } from "@rezumi/utils/style";
import { inputProblemMessage } from "./messages";
import { AiSourceMenu } from "@/features/billing/ai-source-menu";
import { IMPORT_ACCEPT } from "@/features/resume/import/read-file";
import { ENTER_CLASS } from "@/libs/motion";

type SourceFieldsProps = {
	inputs: SourceInputs;
	onChange: (patch: Partial<SourceInputs>) => void;
	availability: SourceAvailability;
	/** Shown once the person tried to go on with something that can't run. */
	problems: Partial<Record<SourceId, SourceInputProblem>>;
	/** The username of the account's GitHub sign-in, which the GitHub field starts with. */
	accountGithub?: string | null;
	/** Field ids, so a caller can move focus to the first one with a problem. */
	idPrefix: string;
};

/**
 * "Bring what you have": a LinkedIn link, a resume file, a GitHub username and a personal website, any of them or
 * none. Used by onboarding and by the Profile's empty state, so both offer the same sources the same way.
 */
export function SourceFields(props: SourceFieldsProps) {
	const { inputs, onChange, availability, problems, accountGithub = null, idPrefix } = props;
	const githubFromAccount = Boolean(accountGithub) && inputs.github.trim() === accountGithub;

	return (
		<div className="grid gap-6">
			{availability.linkedin && (
				<div className="grid gap-3">
					<SourceTextField
						id={`${idPrefix}-linkedin`}
						icon="linkedin-logo"
						label={t`LinkedIn profile link`}
						placeholder="linkedin.com/in/your-name"
						value={inputs.linkedin}
						onChange={(linkedin) => onChange({ linkedin })}
						error={problems.linkedin === "invalid" ? inputProblemMessage("linkedin", "invalid") : undefined}
						type="url"
					/>
					{inputs.linkedin.trim() && (
						<Checkbox
							id={`${idPrefix}-linkedin-own`}
							validationBehavior="aria"
							isSelected={inputs.linkedinOwn}
							onChange={(linkedinOwn) => onChange({ linkedinOwn })}
							isInvalid={problems.linkedin === "unconfirmed"}
							className={ENTER_CLASS}
						>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
								<Trans>This is my own profile</Trans>
							</Checkbox.Content>
							<FieldError>{inputProblemMessage("linkedin", "unconfirmed")}</FieldError>
						</Checkbox>
					)}
				</div>
			)}

			<FileField id={`${idPrefix}-file`} file={inputs.file} onChange={(file) => onChange({ file })} />

			{availability.github && (
				<SourceTextField
					id={`${idPrefix}-github`}
					icon="github-logo"
					label={t`GitHub username`}
					placeholder="octocat"
					value={inputs.github}
					onChange={(github) => onChange({ github })}
					error={problems.github ? inputProblemMessage("github", problems.github) : undefined}
					description={githubFromAccount ? t`From your GitHub sign-in.` : t`Adds your own public projects.`}
					autoCapitalize="none"
				/>
			)}

			{availability.website && (
				<SourceTextField
					id={`${idPrefix}-website`}
					icon="globe"
					label={t`Personal website`}
					placeholder="yourname.com"
					value={inputs.website}
					onChange={(website) => onChange({ website })}
					error={problems.website ? inputProblemMessage("website", problems.website) : undefined}
					description={
						<span className="flex flex-wrap items-center gap-x-1">
							<Trans>Read with AI. Only what's on the page comes in.</Trans>
							<AiSourceMenu action="profile-website" className="-my-1" />
						</span>
					}
					type="url"
				/>
			)}
		</div>
	);
}

/** Moves focus to the first field that stops the sources from running: the way to fix it is right there. */
export function focusFirstProblem(idPrefix: string, problems: Partial<Record<SourceId, SourceInputProblem>>) {
	const first = (["linkedin", "github", "website"] as const).find((id) => id in problems);
	if (!first) return;
	const id = first === "linkedin" && problems.linkedin === "unconfirmed" ? "linkedin-own" : first;
	requestAnimationFrame(() => {
		const element = document.getElementById(`${idPrefix}-${id}`);
		(element instanceof HTMLInputElement ? element : element?.querySelector("input"))?.focus();
	});
}

type SourcesNoteProps = { availability: SourceAvailability; className?: string };

/** Who reads what, and when: only on the person's request, and nothing is saved before they check it. */
export function SourcesNote({ availability, className }: SourcesNoteProps) {
	return (
		<p className={cn("text-body-xs text-muted", className)}>
			{availability.linkedin ? (
				<Trans>
					We only read what you add here, once you continue: LinkedIn profiles through Apify, GitHub accounts through
					GitHub, websites with AI. Nothing goes into your Profile until you check it.
				</Trans>
			) : availability.website ? (
				<Trans>
					We only read what you add here, once you continue: GitHub accounts through GitHub, websites with AI. Nothing
					goes into your Profile until you check it.
				</Trans>
			) : (
				<Trans>
					We only read what you add here, once you continue. Nothing goes into your Profile until you check it.
				</Trans>
			)}
		</p>
	);
}

type SourceTextFieldProps = {
	id: string;
	icon: IconName;
	label: string;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	error: string | undefined;
	description?: ReactNode;
	type?: "url" | "text";
	autoCapitalize?: "none";
};

function SourceTextField(props: SourceTextFieldProps) {
	const { id, icon, label, placeholder, value, onChange, error, description, type = "text", autoCapitalize } = props;
	return (
		<TextField
			fullWidth
			value={value}
			onChange={onChange}
			isInvalid={error !== undefined}
			validationBehavior="aria"
			type={type}
		>
			<Label htmlFor={id}>{label}</Label>
			<InputGroup fullWidth variant="secondary">
				<InputGroup.Prefix>
					<Icon name={icon} size={18} className="text-muted" />
				</InputGroup.Prefix>
				<InputGroup.Input
					id={id}
					dir="ltr"
					placeholder={placeholder}
					autoComplete="off"
					spellCheck={false}
					{...(autoCapitalize ? { autoCapitalize } : {})}
				/>
			</InputGroup>
			{description && !error && <Description>{description}</Description>}
			<FieldError>{error}</FieldError>
		</TextField>
	);
}

type FileFieldProps = {
	id: string;
	file: File | null;
	onChange: (file: File | null) => void;
};

/** A resume file to read: dropped or chosen, then shown with its size and a way to take it out. */
function FileField({ id, file, onChange }: FileFieldProps) {
	const { i18n } = useLingui();

	const drop = async ({ items }: DropEvent) => {
		const item = items.find(isFileDropItem);
		const dropped = await item?.getFile();
		if (dropped) onChange(dropped);
	};

	return (
		<div className="grid gap-1.5">
			<span id={`${id}-label`} className="text-sm font-medium">
				<Trans>Resume file</Trans>
			</span>
			{file ? (
				<div className={cn(ENTER_CLASS, "flex items-center gap-3 rounded-field bg-default px-3 py-2.5")}>
					<Icon name={file.name.toLowerCase().endsWith(".pdf") ? "file-pdf" : "file-text"} className="text-muted" />
					<span className="grid min-w-0 flex-1">
						<span className="truncate text-sm font-medium">{file.name}</span>
						<span className="text-xs text-muted tabular-nums">{formatFileSize(file.size, i18n.locale)}</span>
					</span>
					<IconButton
						icon="x"
						label={t`Remove ${file.name}`}
						size="sm"
						variant="ghost"
						onPress={() => onChange(null)}
					/>
				</div>
			) : (
				<DropZone className="w-full" aria-labelledby={`${id}-label`}>
					<DropZone.Area onDrop={(event) => void drop(event)} className="min-h-0 flex-row gap-3 px-4 py-3 text-start">
						<DropZone.Icon>
							<Icon name="file-arrow-up" size={20} />
						</DropZone.Icon>
						<div className="grid min-w-0 gap-0.5">
							<DropZone.Label>
								<Trans>Drop your resume here</Trans>
							</DropZone.Label>
							<DropZone.Description>
								<Trans>PDF, Word, a LinkedIn export or a Rezumi file</Trans>
							</DropZone.Description>
						</div>
						<ChooseFileButton />
					</DropZone.Area>
					<DropZone.Input
						id={id}
						accept={IMPORT_ACCEPT}
						onSelect={(files) => {
							const chosen = files[0];
							if (chosen) onChange(chosen);
						}}
					/>
				</DropZone>
			)}
		</div>
	);
}

function ChooseFileButton() {
	const { openFilePicker } = useDropZonePickerContext();
	return (
		<Button size="sm" variant="secondary" className="ms-auto shrink-0" onPress={openFilePicker}>
			<Trans>Choose</Trans>
		</Button>
	);
}
