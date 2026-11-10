import type { Application, ApplicationSummary } from "../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { Sheet, Widget } from "@heroui-pro/react";
import {
	Button,
	ButtonGroup,
	Checkbox,
	Chip,
	Dropdown,
	Input,
	Label,
	Modal,
	ScrollShadow,
	Separator,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { documentOptions } from "../document-options";
import { daysInStage } from "../next-step";
import { applicationDetailQueryOptions, getInitialApplicationDetail } from "../queries";
import { getClosedReasonLabel, getNextStage, getStageColor, getStageLabel } from "../stages";
import { useApplicationActions, useInvalidateApplications } from "../use-application-actions";
import { ApplicationNotes } from "./application-notes";
import { Activity } from "./detail/activity";
import { CloseDialog } from "./detail/close-dialog";
import { Contacts } from "./detail/contacts";
import { FIELD_CLASS, INPUT_CLASS } from "./detail/field-style";
import { NextStepCard } from "./detail/next-step-card";
import { SentDocuments } from "./detail/sent-documents";
import { StageStepper } from "./detail/stage-stepper";
import { InterviewDialog } from "./interview-dialog";
import { DatePickerField } from "@/components/input/date-time-fields";
import { SelectField } from "@/components/input/select-field";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { useClosingValue } from "@/hooks/use-closing-value";
import { useConfirm } from "@/hooks/use-confirm";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { isImeComposing } from "@/libs/keyboard";
import { orpc } from "@/libs/orpc/client";

type DetailSheetProps = {
	application: ApplicationSummary | null;
	onOpenChange: (open: boolean) => void;
	onEditDetails: (application: Application) => void;
};

/**
 * One application, 480px from the right (full screen on phones): the stage stepper with Move to next, the next
 * step, what was sent, the key facts, notes and activity. Close application… takes a reason; Delete is in ⋯.
 */
export function ApplicationDetailSheet({ application, onOpenChange, onEditDetails }: DetailSheetProps) {
	const phone = useBreakpoint() === "mobile";
	// Closing keeps the last application on screen until the sheet has slid away.
	const [shown, onOpenChangeComplete] = useClosingValue(application);
	const initialDetail = getInitialApplicationDetail(shown);
	const { data, isError, isFetching, isPending, refetch } = useQuery({
		...applicationDetailQueryOptions(shown?.id ?? ""),
		// Fetch only while open; while closing, the cached copy keeps showing.
		enabled: Boolean(application),
		initialData: initialDetail,
		initialDataUpdatedAt: 0,
	});
	const current = data;

	return (
		<Sheet
			isOpen={Boolean(application)}
			onOpenChange={onOpenChange}
			onAnimationEnd={onOpenChangeComplete}
			placement={phone ? "bottom" : "right"}
		>
			<Sheet.Backdrop>
				<Sheet.Content className={phone ? "h-svh" : "w-full sm:max-w-[480px]"}>
					<Sheet.Dialog className="bg-background">
						{phone && <Sheet.Handle />}
						<Sheet.CloseTrigger aria-label={t`Close`} />
						{current ? (
							<Detail
								key={current.id}
								variant="sheet"
								application={current}
								onEditDetails={onEditDetails}
								onDeleted={() => onOpenChange(false)}
							/>
						) : (
							<div className="grid gap-2 p-5">
								<Sheet.Heading>{shown?.role}</Sheet.Heading>
								<p className="text-sm text-muted" aria-live="polite">
									{isError ? t`Couldn't load this. Your saved data hasn't changed.` : t`Loading…`}
								</p>
								{isError && (
									<Button variant="secondary" isDisabled={isFetching || isPending} onPress={() => void refetch()}>
										<Trans>Try again</Trans>
									</Button>
								)}
							</div>
						)}
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}

type DetailPaneProps = {
	application: ApplicationSummary;
	onClose: () => void;
	onEditDetails: (application: Application) => void;
};

/**
 * The same detail as the sheet, as a pane beside the list on wide screens: it stays open while you move from row to
 * row, and the list stays usable. Its height is the window's under the navbar, and it scrolls inside.
 */
export function ApplicationDetailPane({ application, onClose, onEditDetails }: DetailPaneProps) {
	const { data, isError, isFetching, isPending, refetch } = useQuery({
		...applicationDetailQueryOptions(application.id),
		initialData: getInitialApplicationDetail(application),
		initialDataUpdatedAt: 0,
	});

	return (
		<section aria-label={t`Application details`} className={PANE_CLASS}>
			<IconButton icon="x" label={t`Close`} size="sm" className="absolute end-3 top-3 z-10" onPress={onClose} />
			{data ? (
				<Detail key={data.id} variant="pane" application={data} onEditDetails={onEditDetails} onDeleted={onClose} />
			) : (
				<div className="grid gap-2 p-5">
					<h2 className="pe-8 text-lg leading-6 font-semibold">{application.role}</h2>
					<p className="text-sm text-muted" aria-live="polite">
						{isError ? t`Couldn't load this. Your saved data hasn't changed.` : t`Loading…`}
					</p>
					{isError && (
						<Button variant="secondary" isDisabled={isFetching || isPending} onPress={() => void refetch()}>
							<Trans>Try again</Trans>
						</Button>
					)}
				</div>
			)}
		</section>
	);
}

/** The pane while no application is chosen: where the detail will appear, and how to get it there. */
export function ApplicationDetailPanePlaceholder() {
	return (
		<div className={cn(PANE_CLASS, "grid place-items-center p-6 text-center")}>
			<div className="grid max-w-64 justify-items-center gap-3">
				<span aria-hidden="true" className="grid size-12 place-items-center rounded-2xl bg-default text-muted">
					<Icon name="briefcase" size={22} />
				</span>
				<p className="text-sm text-pretty text-muted">
					<Trans>Choose an application to see its next step, what you sent and its activity here.</Trans>
				</p>
			</div>
		</div>
	);
}

/**
 * Sticky under the page's top margin (24px), as tall as the window under the 48px navbar less both margins. A
 * hairline instead of a shadow: it sits on the page, not above it.
 */
const PANE_CLASS =
	"sticky top-6 flex h-[calc(100svh-6rem)] min-h-96 flex-col overflow-hidden rounded-3xl border border-separator bg-background";

type DetailProps = {
	/** In the sheet, or in the pane beside the list (wide screens). */
	variant: "sheet" | "pane";
	application: Application;
	onEditDetails: (application: Application) => void;
	onDeleted: () => void;
};

function Detail({ variant, application, onEditDetails, onDeleted }: DetailProps) {
	const { i18n } = useLingui();
	const confirm = useConfirm();
	const { moveTo, close, remove } = useApplicationActions();
	const [interview, setInterview] = useState<{ open: boolean; entry: InterviewTimelineEntry | null }>({
		open: false,
		entry: null,
	});
	const [closing, setClosing] = useState(false);
	const [postingOpen, setPostingOpen] = useState(false);
	const [applying, setApplying] = useState(false);

	const next = getNextStage(application.status);
	const since = daysInStage(application);
	const closed = application.status === "closed";

	const onDelete = async () => {
		const confirmed = await confirm(t`Delete this application?`, {
			description: t`“${application.role} · ${application.company}” and its timeline are deleted permanently. This can't be undone.`,
			confirmText: t`Delete application`,
		});
		if (!confirmed) return;
		remove.mutate({ id: application.id }, { onSuccess: onDeleted });
	};

	// The scrolling part: in the sheet it is the sheet's body, in the pane a plain box.
	const body = (
		<ScrollShadow hideScrollBar className="h-full overflow-y-auto">
			<header className="grid gap-4 px-5 pt-5 pb-4">
				<div className="flex items-start gap-3 pe-8">
					<span
						aria-hidden="true"
						className="grid size-10 shrink-0 place-items-center rounded-xl bg-default font-semibold text-muted"
					>
						{application.company.slice(0, 1).toUpperCase()}
					</span>
					<div className="grid min-w-0 flex-1 gap-0.5">
						{variant === "sheet" ? (
							<Sheet.Heading>{application.role}</Sheet.Heading>
						) : (
							<h2 className="text-lg leading-6 font-semibold">{application.role}</h2>
						)}
						<div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
							<span>{[application.company, application.location].filter(Boolean).join(" · ")}</span>
							{(application.sourceUrl || application.jobDescription) && (
								<>
									<span aria-hidden="true">·</span>
									{application.sourceUrl && !application.jobDescription ? (
										<a
											href={application.sourceUrl}
											target="_blank"
											rel="noreferrer"
											className="font-medium text-accent-soft-foreground hover:underline"
										>
											<Trans>View posting</Trans>
										</a>
									) : (
										<button
											type="button"
											onClick={() => setPostingOpen(true)}
											className="font-medium text-accent-soft-foreground hover:underline"
										>
											<Trans>View posting</Trans>
										</button>
									)}
								</>
							)}
						</div>
					</div>
					<Dropdown>
						<IconButton icon="dots-three" size="sm" label={t`Application options`} />
						<Dropdown.Popover placement="bottom end">
							<Dropdown.Menu>
								<Dropdown.Item id="edit" textValue={t`Edit details…`} onAction={() => onEditDetails(application)}>
									<Icon name="pencil-simple" size={18} />
									<Label>
										<Trans>Edit details…</Trans>
									</Label>
								</Dropdown.Item>
								<Separator />
								<Dropdown.Item id="delete" textValue={t`Delete…`} variant="danger" onAction={onDelete}>
									<Icon name="trash" size={18} />
									<Label>
										<Trans>Delete…</Trans>
									</Label>
								</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
				</div>

				<div className="grid gap-2.5">
					<StageStepper
						application={application}
						onSelect={(stage) => {
							if (application.status === "saved" && stage === "applied") setApplying(true);
							else moveTo(application, stage);
						}}
					/>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="flex items-center gap-1.5 text-sm">
							<span
								aria-hidden="true"
								className="size-2 rounded-sm"
								style={{ background: getStageColor(application.status) }}
							/>
							<strong className="font-semibold">{getStageLabel(application.status)}</strong>
							<span className="text-muted">
								{closed && application.closedReason ? (
									<>· {getClosedReasonLabel(application.closedReason)}</>
								) : (
									<>
										· <Plural value={since} _0="since today" one="for # day" other="for # days" />
									</>
								)}
							</span>
						</span>
						{next && !closed && (
							<Button
								size="sm"
								variant="secondary"
								onPress={() => (application.status === "saved" ? setApplying(true) : moveTo(application, next))}
							>
								{application.status === "saved" ? (
									<Trans>Mark as applied</Trans>
								) : (
									<Trans>Move to {getStageLabel(next)}</Trans>
								)}
								<Icon name="arrow-right" size={16} />
							</Button>
						)}
					</div>
				</div>
			</header>

			<div className="grid gap-3 px-4 pb-4">
				<NextStepCard application={application} onScheduleInterview={(entry) => setInterview({ open: true, entry })} />
				<SentDocuments application={application} disabled={remove.isPending} />
				<Details application={application} locale={i18n.locale} />
				<ApplicationNotes application={application} />
				<Activity application={application} onOpenInterview={(entry) => setInterview({ open: true, entry })} />
			</div>
		</ScrollShadow>
	);

	return (
		<>
			{variant === "sheet" ? (
				<Sheet.Body className="min-h-0 flex-1 overflow-hidden p-0">{body}</Sheet.Body>
			) : (
				<div className="min-h-0 flex-1 overflow-hidden">{body}</div>
			)}

			<footer className="shrink-0 bg-background px-4 pt-2 pb-4">
				{!closed ? (
					<ButtonGroup variant="secondary" fullWidth>
						<Button isIconOnly aria-label={t`Close application…`} onPress={() => setClosing(true)}>
							<Icon name="prohibit" size={18} />
						</Button>
						{application.sourceUrl && (
							<Button
								isIconOnly
								aria-label={t`Open the posting`}
								onPress={() => window.open(application.sourceUrl ?? "", "_blank", "noopener,noreferrer")}
							>
								<ButtonGroup.Separator />
								<Icon name="arrow-square-out" size={18} />
							</Button>
						)}
						<OpenWorkspaceButton application={application} />
					</ButtonGroup>
				) : (
					<ButtonGroup variant="secondary" fullWidth>
						<Button className="min-w-0 flex-1 px-3" onPress={() => moveTo(application, "applied")}>
							<Icon name="arrow-counter-clockwise" size={16} />
							<Trans>Reopen</Trans>
						</Button>
					</ButtonGroup>
				)}
			</footer>

			<CloseDialog open={closing} onOpenChange={setClosing} onClose={(reason) => close(application, reason)} />
			<InterviewDialog
				application={application}
				interview={interview.entry}
				open={interview.open}
				onOpenChange={(open) => setInterview((currentValue) => ({ ...currentValue, open }))}
			/>
			<PostingDialog application={application} open={postingOpen} onOpenChange={setPostingOpen} />
			{applying && <MarkAppliedDialog application={application} onClose={() => setApplying(false)} />}
		</>
	);
}

/** Salary, Source, Applied, Contact and Tags. Each value looks like its input, so editing in place doesn't jump. */
function Details({ application, locale }: { application: Application; locale: string }) {
	const titleId = useId();
	const invalidate = useInvalidateApplications();
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save the change. Try again.` }),
	});
	const applied = new Date(application.appliedAt).toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading id={titleId} icon="list-bullets" title={<Trans>Details</Trans>} />
			<Widget.Content className="grid gap-4">
				<dl className="grid grid-cols-2 gap-x-3 gap-y-4">
					<InlineFact
						label={t`Salary`}
						placeholder={t`Add a salary`}
						value={application.salary}
						onSave={(salary) => update.mutate({ id: application.id, salary })}
					/>
					<InlineFact
						label={t`Source`}
						placeholder={t`Add a source`}
						value={application.source}
						onSave={(source) => update.mutate({ id: application.id, source })}
					/>
					<div className="grid gap-1.5">
						<dt className="text-xs font-semibold text-muted">
							<Trans>Applied</Trans>
						</dt>
						<dd className={cn(FIELD_CLASS, application.status === "saved" && "font-normal text-muted")}>
							{application.status === "saved" ? <Trans>Not applied yet</Trans> : applied}
						</dd>
					</div>
					<div className="grid gap-1.5">
						<dt className="text-xs font-semibold text-muted">
							<Trans>Contact</Trans>
						</dt>
						<dd className="min-w-0">
							<Contacts
								contacts={application.contacts}
								disabled={update.isPending}
								onChange={(contacts) => update.mutate({ id: application.id, contacts })}
							/>
						</dd>
					</div>
				</dl>
				<Tags application={application} />
			</Widget.Content>
		</Widget>
	);
}

type InlineFactProps = {
	label: string;
	placeholder: string;
	value: string | null;
	onSave: (value: string | null) => void;
};

/** A fact that edits in place: click to type, Enter or leaving saves, Esc cancels. */
function InlineFact({ label, placeholder, value, onSave }: InlineFactProps) {
	const id = useId();
	const [draft, setDraft] = useState<string | null>(null);

	const commit = () => {
		if (draft === null) return;
		const next = draft.trim() || null;
		if (next !== (value ?? null)) onSave(next);
		setDraft(null);
	};

	return (
		<div className="grid gap-1.5">
			<dt className="text-xs font-semibold text-muted">
				<label htmlFor={id}>{label}</label>
			</dt>
			<dd>
				{draft === null ? (
					<button
						id={id}
						type="button"
						onClick={() => setDraft(value ?? "")}
						className={cn(
							FIELD_CLASS,
							"cursor-text transition-colors hover:bg-default",
							!value && "font-normal text-muted",
						)}
					>
						<span className="truncate">{value || placeholder}</span>
					</button>
				) : (
					<Input
						fullWidth
						id={id}
						variant="secondary"
						autoFocus
						value={draft}
						placeholder={placeholder}
						className={cn(INPUT_CLASS, "font-medium")}
						onChange={(event) => setDraft(event.target.value)}
						onBlur={commit}
						onKeyDown={(event) => {
							if (isImeComposing(event)) return;
							if (event.key === "Enter") commit();
							if (event.key === "Escape") {
								event.stopPropagation();
								setDraft(null);
							}
						}}
					/>
				)}
			</dd>
		</div>
	);
}

function Tags({ application }: { application: Application }) {
	const invalidate = useInvalidateApplications();
	const [tag, setTag] = useState("");
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(application.id),
		onError: () => toast.add({ type: "error", description: t`Couldn't save the tags. Try again.` }),
	});
	const save = (tags: string[]) => update.mutate({ id: application.id, tags });

	return (
		<section aria-labelledby="application-tags" className="grid gap-1.5">
			<h3 id="application-tags" className="text-xs font-semibold text-muted">
				<Trans>Tags</Trans>
			</h3>
			<div className="flex flex-wrap items-center gap-1.5">
				{application.tags.map((value) => (
					<Chip key={value} size="lg" variant="soft" className="gap-0.5 pe-0.5">
						{value}
						<button
							type="button"
							aria-label={t`Remove ${value}`}
							onClick={() => save(application.tags.filter((item) => item !== value))}
							className="grid size-6 place-items-center rounded-full text-muted hover:text-foreground"
						>
							<Icon name="x" size={14} />
						</button>
					</Chip>
				))}
				<form
					className="min-w-28 flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						const value = tag.trim();
						if (!value || application.tags.includes(value)) return setTag("");
						save([...application.tags, value]);
						setTag("");
					}}
				>
					<Input
						fullWidth
						variant="secondary"
						aria-label={t`Add a tag`}
						placeholder={application.tags.length === 0 ? t`Add a tag, then Enter` : t`Add a tag`}
						value={tag}
						className={INPUT_CLASS}
						onChange={(event) => setTag(event.target.value)}
					/>
				</form>
			</div>
		</section>
	);
}

type PostingDialogProps = { application: Application; open: boolean; onOpenChange: (open: boolean) => void };

type MarkAppliedDialogProps = { application: Application; onClose: () => void };

function MarkAppliedDialog({ application, onClose }: MarkAppliedDialogProps) {
	const id = useId();
	const invalidate = useInvalidateApplications();
	const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
	const [resumeId, setResumeId] = useState(application.resumeId ?? "");
	const [coverLetterId, setCoverLetterId] = useState(application.coverLetterId ?? "");
	const [resumeFileSent, setResumeFileSent] = useState(true);
	const [letterFileSent, setLetterFileSent] = useState(true);
	const { data: documents } = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => {
			invalidate(application.id);
			onClose();
		},
	});
	return (
		<Modal.Backdrop
			isOpen
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<Modal.Container size="md">
				<Modal.Dialog aria-describedby={`${id}-description`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<form
						className="contents"
						onSubmit={(event) => {
							event.preventDefault();
							update.mutate({
								id: application.id,
								status: "applied",
								stageEnteredAt: date,
								resumeId: resumeId || null,
								coverLetterId: coverLetterId || null,
								...(!resumeFileSent ? { resumeFileUrl: null, resumeFileName: null } : {}),
								...(!letterFileSent ? { coverLetterUrl: null, coverLetterName: null } : {}),
							});
						}}
					>
						<Modal.Header>
							<Modal.Heading>
								<Trans>Mark as applied</Trans>
							</Modal.Heading>
							<p id={`${id}-description`} className="text-sm text-muted">
								<Trans>
									Confirm submission and choose the documents you actually sent. Their current versions will be saved.
								</Trans>
							</p>
						</Modal.Header>
						<Modal.Body className="grid gap-4 p-1">
							<DatePickerField label={<Trans>Application date</Trans>} isRequired value={date} onChange={setDate} />
							<SelectField
								label={<Trans>Resume submitted (optional)</Trans>}
								value={resumeId}
								onChange={setResumeId}
								options={documentOptions(documents, "resume")}
							/>
							<SelectField
								label={<Trans>Cover letter submitted (optional)</Trans>}
								value={coverLetterId}
								onChange={setCoverLetterId}
								options={documentOptions(documents, "letter")}
							/>
							{application.resumeFileUrl && (
								<Checkbox isSelected={resumeFileSent} onChange={setResumeFileSent} className="text-sm">
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Trans>Submitted attached resume: {application.resumeFileName ?? "PDF"}</Trans>
									</Checkbox.Content>
								</Checkbox>
							)}
							{application.coverLetterUrl && (
								<Checkbox isSelected={letterFileSent} onChange={setLetterFileSent} className="text-sm">
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Trans>Submitted attached cover letter: {application.coverLetterName ?? "PDF"}</Trans>
									</Checkbox.Content>
								</Checkbox>
							)}
							{update.error && (
								<p role="alert" className="text-sm text-danger-soft-foreground">
									{getOrpcErrorMessage(update.error, { fallback: t`Couldn't record submission. Try again.` })}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button type="submit" isDisabled={!date || update.isPending}>
								<Trans>Confirm applied</Trans>
							</Button>
						</Modal.Footer>
					</form>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

/** The saved posting: its link, what it asks for, and its text. */
function PostingDialog({ application, open, onOpenChange }: PostingDialogProps) {
	const descriptionId = useId();
	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size="lg">
				<Modal.Dialog aria-describedby={descriptionId}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							{application.role} · {application.company}
						</Modal.Heading>
						<div id={descriptionId} className="text-sm text-muted">
							{application.sourceUrl ? (
								<a
									href={application.sourceUrl}
									target="_blank"
									rel="noreferrer"
									className="text-accent-soft-foreground hover:underline"
								>
									{application.sourceUrl}
								</a>
							) : (
								<Trans>The posting saved with this application.</Trans>
							)}
						</div>
					</Modal.Header>
					<Modal.Body className="grid gap-4 p-1">
						{application.postingSource && (
							<p className="text-xs text-muted">
								{application.postingSource.method === "paste" ? (
									<Trans>Pasted description</Trans>
								) : (
									<Trans>
										Retrieved {application.postingSource.retrievedAt} using {application.postingSource.method}.
										Retrieval time does not establish origin freshness.
									</Trans>
								)}
							</p>
						)}
						{(application.postingSource?.truncated || application.postingSource?.completeness === "incomplete") && (
							<p className="text-xs text-warning-soft-foreground" role="alert">
								<Trans>This saved description is clipped or incomplete. Review before preparing documents.</Trans>
							</p>
						)}
						{application.requirements.length > 0 && (
							<section aria-labelledby="posting-requirements" className="grid gap-2">
								<h3 id="posting-requirements" className="text-xs font-semibold text-muted">
									<Trans>What it asks for</Trans>
								</h3>
								<ul className="flex flex-wrap gap-1.5">
									{application.requirements.map((requirement) => (
										<li key={requirement}>
											<Chip size="sm" variant="soft">
												{requirement}
											</Chip>
										</li>
									))}
								</ul>
							</section>
						)}
						{application.jobDescription && (
							<p className="text-sm leading-6 whitespace-pre-wrap text-muted">{application.jobDescription}</p>
						)}
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

/** Opens the application's workspace on the tab for its stage. */
function OpenWorkspaceButton({ application }: { application: Application }) {
	const navigate = useNavigate();
	return (
		<Button
			variant="primary"
			className="min-w-0 flex-1 px-3"
			onPress={() =>
				void navigate({
					to: "/dashboard/applications/$applicationId/{-$tab}",
					params: { applicationId: application.id },
				})
			}
		>
			<ButtonGroup.Separator />
			<Icon name="arrow-right" size={16} />
			<Trans>Open workspace</Trans>
		</Button>
	);
}
