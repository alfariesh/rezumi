import type { ApplicationSummary } from "@/features/applications/types";
import type { LetterDraft } from "@/features/letters/store";
import type { CoverLetter } from "@rezumi/schema/cover-letter/data";
import type { IconName } from "@rezumi/ui/components/icon";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { NativeSelect, Widget } from "@heroui-pro/react";
import { Button, Chip, Description, Dropdown, Input, Label, Link, Separator, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { coverLetterTextToHtml, defaultCoverLetterSignOff, greetingName } from "@rezumi/resume/cover-letter";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { templates } from "@/dialogs/resume/template/data";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { getStageColor, getStageLabel } from "@/features/applications/stages";
import { useLetterWords } from "@/features/letters/compose";
import { countWords, LETTER_LENGTH, letterLength } from "@/features/letters/length";
import { discardLetterDraft, startLetterDraft, useLetterEditorStore } from "@/features/letters/store";
import { useLetterMode } from "@/features/letters/use-letter-mode";
import { ACCENTS, FONT_PAIRINGS, matchFontPairing, rgbaToHex } from "@/features/resume/editor/design/presets";
import { RichTextEditor } from "@/features/resume/editor/write/rich-text-editor";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

const BODY_ID = "letter-body-editor";

const focusBody = () => window.setTimeout(() => document.getElementById(BODY_ID)?.focus(), 50);

const failed = (error: unknown) =>
	toast.add({
		type: "error",
		description: getOrpcErrorMessage(error, { fallback: t`Couldn't save that change. Try again.` }),
	});

/** Saves what's typed, then changes the letter on the server (links, the application, the resume). */
const updateLetter = (changes: Omit<Parameters<typeof client.coverLetters.update>[0], "id" | "expectedRevision">) =>
	useLetterEditorStore.getState().change((letter) =>
		client.coverLetters.update({
			id: letter.id,
			expectedRevision: letter.revision,
			sessionId: useLetterEditorStore.getState().sessionId,
			...changes,
		}),
	);

type LetterWidgetProps = {
	/** The widget's id: the page scrolls to it (`letter-from`, `letter-body`). Its title takes `${id}-title`. */
	id: string;
	icon: IconName;
	title: ReactNode;
	/** Trailing header content: a count chip or a small ghost action. */
	aside?: ReactNode;
	contentClassName?: string;
	children: ReactNode;
};

/** One group of the letter panels: an icon and Title Case title over the group's elevated content. */
export function LetterWidget({ id, icon, title, aside, contentClassName, children }: LetterWidgetProps) {
	return (
		<Widget id={id} role="region" aria-labelledby={`${id}-title`} className="scroll-mt-3">
			<Widget.Header className="gap-3">
				<span className="flex min-w-0 items-center gap-2">
					<Icon name={icon} size={16} className="shrink-0 text-muted" />
					<Widget.Title id={`${id}-title`} role="heading" aria-level={2} className="truncate">
						{title}
					</Widget.Title>
				</span>
				{aside}
			</Widget.Header>
			<Widget.Content className={cn("grid min-w-0 gap-4", contentClassName)}>{children}</Widget.Content>
		</Widget>
	);
}

/**
 * Write: who the letter is for (the application), to (recipient, company, date) and from (the resume, live or
 * copied), then the body with its length guide and a note on the design. The page beside it updates as you type.
 */
export function LetterWritePanel() {
	const letter = useLetterEditorStore((state) => state.letter);
	const draft = useLetterEditorStore((state) => state.draft);
	const { data: applications } = useQuery(applicationsListQueryOptions());
	if (!letter) return null;

	const application = applications?.find((item) => item.id === letter.sourceApplicationId) ?? null;
	const disabled = letter.isLocked;

	return (
		<div className="grid gap-3 p-3">
			{letter.isLocked && <LetterLockedNote />}
			<ForSection letter={letter} application={application} applications={applications ?? []} disabled={disabled} />
			<ToSection letter={letter} application={application} disabled={disabled} />
			<FromSection letter={letter} disabled={disabled} />
			<BodySection letter={letter} application={application} disabled={disabled} />
			{/* While a draft shows, the length is the draft's. */}
			<LengthSection content={draft.phase === "streaming" || draft.phase === "ready" ? draft.text : letter.content} />
			<DesignNote letter={letter} />
		</div>
	);
}

/** Above the widgets, not in one: a locked letter says so once, in Write and in Design. */
export function LetterLockedNote() {
	return (
		<p className="flex items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2.5 text-sm text-muted">
			<Icon name="lock" size={18} className="shrink-0" />
			<Trans>This letter is locked. Unlock it from its menu to edit.</Trans>
		</p>
	);
}

type ForSectionProps = {
	letter: CoverLetter;
	application: ApplicationSummary | null;
	applications: ApplicationSummary[];
	disabled: boolean;
};

/** FOR: the application the letter is for. Linking one fills the recipient; without one, drafting uses the resume. */
function ForSection({ letter, application, applications, disabled }: ForSectionProps) {
	const choices = applications.filter((item) => item.status !== "closed" || item.id === application?.id);

	const choose = (next: ApplicationSummary | null) =>
		void updateLetter({
			applicationId: next?.id ?? null,
			// The recipient comes from the application: its company, and its first contact when it has one.
			...(next && letter.layout === "structured"
				? { recipientCompany: next.company, recipientName: next.contacts[0]?.name ?? "" }
				: {}),
		}).catch(failed);

	const menu = (trigger: ReactElement) => (
		<Dropdown>
			{trigger}
			<Dropdown.Popover placement="bottom end" className="max-h-80 w-72 overflow-y-auto">
				<Dropdown.Menu
					renderEmptyState={() => (
						<p className="px-2 py-1.5 text-sm text-muted">
							<Trans>No applications yet. Add one in Applications first.</Trans>
						</p>
					)}
				>
					{choices.map((item) => (
						<Dropdown.Item
							key={item.id}
							id={item.id}
							textValue={`${item.role} ${item.company}`}
							onAction={() => choose(item)}
						>
							<Icon name="briefcase" />
							<span className="grid min-w-0">
								<Label className="truncate">{item.role}</Label>
								<Description className="truncate">{item.company}</Description>
							</span>
						</Dropdown.Item>
					))}
					{application && <Separator />}
					{application && (
						<Dropdown.Item id="none" textValue={t`No application`} onAction={() => choose(null)}>
							<Icon name="link-simple-horizontal-break" />
							<Label>
								<Trans>No application</Trans>
							</Label>
						</Dropdown.Item>
					)}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);

	return (
		<LetterWidget
			id="letter-for"
			icon="briefcase"
			title={<Trans>For</Trans>}
			aside={
				application &&
				menu(
					<Button variant="ghost" size="sm" className="shrink-0" isDisabled={disabled}>
						<Trans>Change</Trans>
					</Button>,
				)
			}
		>
			{application ? (
				<div className="flex min-w-0 items-center gap-3">
					<span
						aria-hidden="true"
						className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-secondary font-semibold text-muted"
					>
						{application.company.charAt(0).toUpperCase()}
					</span>
					<span className="grid min-w-0 flex-1">
						<span className="truncate text-sm font-medium">{application.role}</span>
						<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
							<span className="truncate">{application.company}</span>
							<span aria-hidden="true">·</span>
							<span
								aria-hidden="true"
								className="size-1.5 shrink-0 rounded-sm"
								style={{ background: getStageColor(application.status) }}
							/>
							<span className="shrink-0">{getStageLabel(application.status)}</span>
						</span>
					</span>
				</div>
			) : (
				<>
					{menu(
						<Button variant="secondary" fullWidth isDisabled={disabled} className="justify-start gap-2">
							<Icon name="briefcase" />
							<Trans>Link an application</Trans>
							<Icon name="caret-down" className="ms-auto text-muted" />
						</Button>,
					)}
					<p className="text-xs text-muted">
						<Trans>Without one, you fill in the recipient yourself and drafting uses only your resume.</Trans>
					</p>
				</>
			)}
		</LetterWidget>
	);
}

type LetterSectionProps = { letter: CoverLetter; application: ApplicationSummary | null; disabled: boolean };

/** TO: name or team, company and date for structured letters; older (freeform) letters keep their recipient block. */
function ToSection({ letter, application, disabled }: LetterSectionProps) {
	const edit = useLetterEditorStore((state) => state.edit);

	if (letter.layout === "freeform") {
		return (
			<LetterWidget id="letter-to" icon="envelope-simple" title={<Trans>To</Trans>}>
				<RichTextEditor
					label={t`Recipient`}
					value={letter.recipient}
					disabled={disabled}
					heightClassName="min-h-[64px] max-h-[200px]"
					onChange={(recipient) => edit({ recipient })}
				/>
				<p className="text-xs text-muted">
					<Trans>This letter keeps its recipient as written.</Trans>
				</p>
			</LetterWidget>
		);
	}

	return (
		<LetterWidget id="letter-to" icon="envelope-simple" title={<Trans>To</Trans>} contentClassName="@container">
			{/* Company and date share a row once each half fits a whole date; in the 300px panel they stack. */}
			<div className="grid gap-4 @2xs:grid-cols-2">
				<TextField
					fullWidth
					variant="secondary"
					className="@2xs:col-span-2"
					value={letter.recipientName}
					maxLength={200}
					isDisabled={disabled}
					onChange={(recipientName) => edit({ recipientName })}
				>
					<Label>
						<Trans>Name or team</Trans>
					</Label>
					<Input placeholder={t`Hiring team`} />
					<Description>
						{application ? (
							<Trans>Filled from the application. The greeting follows the name.</Trans>
						) : (
							<Trans>The greeting follows the name.</Trans>
						)}
					</Description>
				</TextField>
				<TextField
					fullWidth
					variant="secondary"
					value={letter.recipientCompany}
					maxLength={200}
					isDisabled={disabled}
					onChange={(recipientCompany) => edit({ recipientCompany })}
				>
					<Label>
						<Trans>Company</Trans>
					</Label>
					<Input />
				</TextField>
				<TextField
					fullWidth
					variant="secondary"
					type="date"
					value={letter.letterDate ?? ""}
					isDisabled={disabled}
					onChange={(letterDate) => edit({ letterDate: letterDate || null })}
				>
					<Label>
						<Trans>Date</Trans>
					</Label>
					<Input />
				</TextField>
			</div>
		</LetterWidget>
	);
}

/** FROM: the resume the sender's details come from, and whether they stay live or are copied into the letter. */
function FromSection({ letter, disabled }: { letter: CoverLetter; disabled: boolean }) {
	const id = useId();
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: {} }));
	const resume = resumes?.find((item) => item.id === letter.sourceResumeId);

	const setResume = (resumeId: string | null) =>
		void updateLetter({
			resumeId,
			// A letter taking a resume for the first time takes its details and design with it.
			...(resumeId && !letter.sourceResumeId ? { senderLinked: true, designLinked: true } : {}),
		}).catch(failed);

	const setLinked = (senderLinked: boolean) =>
		void updateLetter({ senderLinked })
			.then(() =>
				toast.add({
					description: senderLinked ? t`Linked to the resume again` : t`Sender details copied into the letter`,
				}),
			)
			.catch(failed);

	return (
		<LetterWidget id="letter-from" icon="user-circle" title={<Trans>From</Trans>}>
			<NativeSelect fullWidth variant="secondary">
				<Label htmlFor={`${id}-resume`}>
					<Trans>Resume</Trans>
				</Label>
				<NativeSelect.Trigger
					id={`${id}-resume`}
					className="pointer-coarse:min-h-11"
					value={letter.sourceResumeId ?? ""}
					disabled={disabled}
					onChange={(event) => setResume(event.target.value || null)}
				>
					<NativeSelect.Option value="">{t`No resume`}</NativeSelect.Option>
					{resumes?.map((item) => (
						<NativeSelect.Option key={item.id} value={item.id}>
							{item.name}
						</NativeSelect.Option>
					))}
					<NativeSelect.Indicator />
				</NativeSelect.Trigger>
			</NativeSelect>
			{letter.sourceResumeId ? (
				<SwitchRow
					label={t`Use details from “${resume?.name ?? t`the resume`}”`}
					description={
						letter.senderLinked
							? t`Linked. Name, email, phone and city update when the resume does.`
							: t`Off. The letter keeps its own copy of your details.`
					}
					isSelected={letter.senderLinked}
					isDisabled={disabled}
					onChange={setLinked}
				/>
			) : (
				<p className="text-xs text-muted">
					<Trans>Your name and contact details come from a resume.</Trans>
				</p>
			)}
		</LetterWidget>
	);
}

/**
 * The body, edited here while the page updates. Empty, it offers a draft from the posting and the resume. A draft
 * shows on a green wash until it's kept: it never replaces typed text by itself.
 */
function BodySection({ letter, application, disabled }: LetterSectionProps) {
	const words = useLetterWords(letter.style.metadata.page.locale);
	const edit = useLetterEditorStore((state) => state.edit);
	const draft = useLetterEditorStore((state) => state.draft);
	const [writing, setWriting] = useState(false);
	const structured = letter.layout === "structured";
	const name = greetingName(letter.recipientName);
	const showEditor = writing || countWords(letter.content) > 0;

	return (
		<LetterWidget id="letter-body" icon="note-pencil" title={<Trans>Letter</Trans>}>
			{structured && (
				<LetterFramingField
					letter={letter}
					field="greeting"
					defaultValue={name ? words.greeting(name) : words.teamGreeting}
					disabled={disabled}
				/>
			)}

			{draft.phase !== "idle" ? (
				<DraftBox
					draft={draft}
					letter={letter}
					application={application}
					onKeep={(text) => {
						edit({ content: coverLetterTextToHtml(text) });
						discardLetterDraft();
						setWriting(true);
						toast.add({ description: t`Draft kept. Edit anything you like.` });
						focusBody();
					}}
				/>
			) : showEditor ? (
				<RichTextEditor
					id={BODY_ID}
					label={t`Letter body`}
					value={letter.content}
					disabled={disabled}
					heightClassName="min-h-[240px]"
					onChange={(content) => edit({ content })}
				/>
			) : (
				<EmptyBody
					letter={letter}
					application={application}
					disabled={disabled}
					onWrite={() => {
						setWriting(true);
						focusBody();
					}}
				/>
			)}

			{structured && (
				<>
					<LetterFramingField
						letter={letter}
						field="signOff"
						defaultValue={defaultCoverLetterSignOff(letter, words)}
						disabled={disabled}
					/>
					<p className="text-xs text-muted">
						<Trans>
							Clear the greeting or sign-off to omit it. Clearing the sign-off also removes the automatic signature.
						</Trans>
					</p>
				</>
			)}
		</LetterWidget>
	);
}

type LetterFramingFieldProps = {
	letter: CoverLetter;
	field: "greeting" | "signOff";
	defaultValue: string;
	disabled: boolean;
};

function LetterFramingField({ letter, field, defaultValue, disabled }: LetterFramingFieldProps) {
	const edit = useLetterEditorStore((state) => state.edit);
	return (
		<TextField
			fullWidth
			variant="secondary"
			value={letter[field] ?? defaultValue}
			maxLength={2_000}
			isDisabled={disabled}
			onChange={(value) => edit({ [field]: value })}
		>
			<div className="flex min-h-8 items-center justify-between gap-2">
				<Label>{field === "greeting" ? <Trans>Greeting</Trans> : <Trans>Sign-off</Trans>}</Label>
				{letter[field] !== null && (
					<Button variant="ghost" size="sm" isDisabled={disabled} onPress={() => edit({ [field]: null })}>
						<Trans>Use default</Trans>
					</Button>
				)}
			</div>
			<TextArea />
		</TextField>
	);
}

type EmptyBodyProps = {
	letter: CoverLetter;
	application: ApplicationSummary | null;
	disabled: boolean;
	onWrite: () => void;
};

function EmptyBody({ letter, application, disabled, onWrite }: EmptyBodyProps) {
	const providerState = useHasUsableAiProvider();
	const { hasUsableProvider } = providerState;
	const hasResume = Boolean(letter.sourceResumeId);
	const company = application?.company;
	const canDraft = hasResume || Boolean(application);
	const offerDraft = canDraft && hasUsableProvider;

	return (
		<div className="fields-on-card grid justify-items-start gap-3 rounded-xl bg-surface-secondary p-4">
			<p className="text-sm text-muted">
				{company && hasResume ? (
					<Trans>Start typing, or draft from what we know: the {company} posting and your resume.</Trans>
				) : company ? (
					<Trans>Start typing, or draft from what we know: the {company} posting.</Trans>
				) : hasResume ? (
					<Trans>Start typing, or draft from what we know: your resume.</Trans>
				) : (
					<Trans>Start typing. To draft one, link a resume or an application first.</Trans>
				)}
			</p>
			<div className="flex flex-wrap gap-2">
				{offerDraft && (
					<Button size="sm" isDisabled={disabled} onPress={() => void startLetterDraft("draft")}>
						<Icon name="sparkle" size={16} />
						{application ? <Trans>Draft from the posting</Trans> : <Trans>Draft from your resume</Trans>}
					</Button>
				)}
				{/* The draft is the one primary action; without it, writing is the way in. */}
				<Button size="sm" variant={offerDraft ? "ghost" : "secondary"} isDisabled={disabled} onPress={() => onWrite()}>
					<Trans>Write it myself</Trans>
				</Button>
			</div>
			{canDraft && <AiProviderLoadState state={providerState} />}
			{canDraft && !providerState.isUnavailable && !hasUsableProvider && (
				<p className="text-xs text-muted">
					<Trans>Drafting needs an AI provider.</Trans>{" "}
					<RouterLink to="/dashboard/settings/app" hash="ai-providers" className="link text-xs">
						<Trans>Open AI settings</Trans>
					</RouterLink>
				</p>
			)}
		</div>
	);
}

type DraftBoxProps = {
	draft: Exclude<LetterDraft, { phase: "idle" }>;
	letter: CoverLetter;
	application: ApplicationSummary | null;
	onKeep: (text: string) => void;
};

/** The draft on its accent wash, then its actions: Keep, Shorter, More personal, Discard. */
function DraftBox({ draft, letter, application, onKeep }: DraftBoxProps) {
	const reducedMotion = useReducedMotion();
	// Retrying repeats the last request.
	const last = useRef<{ variant: "draft" | "shorter" | "personal"; previous?: string }>({ variant: "draft" });
	const run = (variant: "draft" | "shorter" | "personal", previous?: string) => {
		last.current = previous ? { variant, previous } : { variant };
		void startLetterDraft(variant, previous);
	};

	if (draft.phase === "failed") {
		const gateway = draft.error instanceof ORPCError && draft.error.code === "BAD_GATEWAY";
		return (
			<div role="alert" className="grid gap-3 rounded-xl bg-danger-soft p-3 text-sm">
				<span className="flex gap-2 text-danger">
					<Icon name="warning-circle" size={18} className="shrink-0" />
					{gateway && draft.provider ? (
						<Trans>Drafting stopped: {draft.provider} didn't respond. Nothing on the page changed.</Trans>
					) : (
						<Trans>Drafting stopped. Nothing on the page changed.</Trans>
					)}
				</span>
				<div className="flex gap-2">
					<Button size="sm" variant="secondary" onPress={() => run(last.current.variant, last.current.previous)}>
						<Trans>Try again</Trans>
					</Button>
					<Button size="sm" variant="ghost" onPress={() => discardLetterDraft()}>
						<Trans>Dismiss</Trans>
					</Button>
				</div>
			</div>
		);
	}

	const streaming = draft.phase === "streaming";
	// Reduced motion shows the whole draft at once.
	const text = streaming && reducedMotion ? "" : draft.text;
	const sources =
		letter.sourceResumeId && application
			? t`Draft · uses only your resume and the posting`
			: application
				? t`Draft · uses only the posting`
				: t`Draft · uses only your resume`;

	return (
		<div className="grid gap-2">
			<div
				aria-live="polite"
				aria-busy={streaming}
				className={cn(
					"min-h-[120px] rounded-xl bg-accent-soft px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap outline-[1.5px] transition-[outline-color] duration-standard outline-solid",
					draft.phase === "ready" ? "outline-accent" : "outline-transparent",
				)}
			>
				{text}
				{streaming && (
					<span className="text-muted">
						{reducedMotion ? <Trans>Drafting…</Trans> : <span aria-hidden="true">▍</span>}
					</span>
				)}
			</div>
			{streaming && (
				<Button size="sm" variant="ghost" className="w-fit" onPress={() => discardLetterDraft()}>
					<Trans>Stop</Trans>
				</Button>
			)}
			{draft.phase === "ready" && (
				<div className={cn(ENTER_CLASS, "fields-on-card grid gap-2 rounded-xl bg-surface-secondary p-3")}>
					<span className="flex items-center gap-1.5 text-xs text-muted">
						<Icon name="sparkle" size={16} className="shrink-0 text-accent" />
						{sources}
					</span>
					<div className="flex flex-wrap items-center gap-2">
						<Button size="sm" onPress={() => onKeep(draft.text)}>
							<Trans>Keep</Trans>
						</Button>
						{(
							[
								["shorter", t`Shorter`],
								["personal", t`More personal`],
							] as const
						).map(([variant, label]) => (
							<Button key={variant} size="sm" variant="secondary" onPress={() => run(variant, draft.text)}>
								{label}
							</Button>
						))}
						<Button size="sm" variant="ghost" onPress={() => discardLetterDraft()}>
							<Trans>Discard</Trans>
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

/** Length: the word count against the 180 to 320 band most recruiters read, as a hint rather than a rule. */
function LengthSection({ content }: { content: string }) {
	const words = countWords(content);
	const length = letterLength(words);
	const color = length === "empty" ? "default" : length === "comfortable" ? "accent" : "warning";
	const fill = length === "empty" ? "bg-border" : length === "comfortable" ? "bg-accent" : "bg-warning";
	const percent = (value: number) => `${(value / LETTER_LENGTH.scale) * 100}%`;

	return (
		<LetterWidget
			id="letter-length"
			icon="hourglass"
			title={<Trans>Length</Trans>}
			aside={
				<Chip size="sm" variant="soft" color={color} className="shrink-0 tabular-nums">
					<Plural value={words} one="# word" other="# words" />
				</Chip>
			}
		>
			<div aria-hidden="true" className="relative h-1.5 overflow-hidden rounded-full bg-default">
				<span
					className="absolute inset-y-0 bg-border"
					style={{
						insetInlineStart: percent(LETTER_LENGTH.min),
						width: percent(LETTER_LENGTH.max - LETTER_LENGTH.min),
					}}
				/>
				<span
					className={cn(
						"absolute inset-y-0 start-0 w-full translate-x-(--fill) rounded-full transition-[translate] duration-quick ease-enter rtl:-translate-x-(--fill)",
						fill,
					)}
					style={
						{
							"--fill": `${(Math.min(words, LETTER_LENGTH.scale) / LETTER_LENGTH.scale) * 100 - 100}%`,
						} as CSSProperties
					}
				/>
			</div>
			<p className="text-xs text-muted">
				{length === "empty" ? (
					<Trans>Most recruiters read 180–320 words. The shaded band shows the range.</Trans>
				) : length === "short" ? (
					<Trans>Short and direct. Fine if the posting asks for brevity.</Trans>
				) : length === "comfortable" ? (
					<Trans>A comfortable length, and it fits on one page.</Trans>
				) : (
					<Trans>Getting long. Try “Shorter”, or cut the least specific paragraph.</Trans>
				)}
			</p>
		</LetterWidget>
	);
}

/** DESIGN: what the letter looks like, and where to change it. */
function DesignNote({ letter }: { letter: CoverLetter }) {
	const [, setMode] = useLetterMode();
	const { metadata } = letter.style;
	const pairing = FONT_PAIRINGS.find((option) => option.id === matchFontPairing(metadata))?.label;
	const accent = ACCENTS.find((option) => option.hex === rgbaToHex(metadata.design.colors.primary))?.label;
	const summary = [templates[metadata.template].name, pairing && t`${pairing} type`, accent].filter(Boolean).join(", ");

	return (
		<LetterWidget id="letter-design" icon="palette" title={<Trans>Design</Trans>}>
			<p className="text-sm text-muted">
				{letter.designLinked ? (
					<Trans>Matches the resume ({summary}).</Trans>
				) : (
					<Trans>Its own design ({summary}).</Trans>
				)}{" "}
				<Link className="text-sm" onPress={() => setMode("design")}>
					<Trans>Change it in Design.</Trans>
				</Link>
			</p>
		</LetterWidget>
	);
}
