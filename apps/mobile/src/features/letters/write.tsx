// Write for letters (plans/mobile Phase 08): who the letter is for (the application), to (recipient, company, date),
// from (the Profile, a resume, or this letter's own details), then the body with its AI draft, the length guide and a
// note on the design. Mirrors web's `routes/builder/letter/-components/write-panel.tsx`.
import type { RelinkResult } from "./save";
import type { LetterDocument } from "@/draft/types";
import type { ApplicationSummary as Application } from "@/features/applications/types";
import type { WritableDraft } from "immer";
import type { ReactNode } from "react";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, View } from "react-native";
import { coverLetterTextToHtml, defaultCoverLetterSignOff, greetingName } from "@rezumi/resume/cover-letter";
import { ACCENTS, matchFontPairing, rgbaToHex, templateName } from "@rezumi/resume/design-presets";
import { profileHasCareer } from "@rezumi/resume/profile";
import { useLetterWords } from "./compose";
import { discardLetterDraft, startLetterDraft, useLetterDrafting } from "./drafting";
import { LETTER_LENGTH, countWords, letterLength } from "./length";
import { useResumes } from "./queries";
import { relinkLetter } from "./save";
import { useSession } from "@/auth/session";
import { letterFieldFocus, useLetterStore } from "@/draft";
import { AIProviderSetupSheet, useHasAIProvider } from "@/features/ai/providers";
import { ReportAiContent } from "@/features/ai/report-content";
import { useApplications } from "@/features/applications/queries";
import { getStageLabel } from "@/features/applications/stages";
import { ACCENT_NAMES, PAIRING_NAMES } from "@/features/design/preset-names";
import { RichTextField, RichTextToolbar } from "@/features/entries/rich-text-field";
import { profileQuery } from "@/features/onboarding/queries";
import { routes } from "@/routes";
import {
	Alert,
	Button,
	Card,
	DatePicker,
	EmptyState,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	Screen,
	SearchField,
	Sheet,
	Skeleton,
	StageLabel,
	Text,
	TextArea,
	TextField,
	Typography,
	cx,
	showToast,
	useReducedMotion,
} from "@/ui";

type Recipe = (letter: WritableDraft<LetterDocument>) => void;

/** Typing: one undo step per field while typing pauses under a second. */
const edit = (key: string, recipe: Recipe) => useLetterStore.getState().update(recipe, { coalesceKey: key });

/** Tells the person how a link change went: confirmed, waiting for a connection, or refused over unsaved edits. */
export function relinked(result: RelinkResult, done?: string) {
	if (result === "unsaved")
		showToast({ title: t`Couldn't save your changes. Try again before continuing.`, variant: "danger" });
	else if (result === "linked" && done) showToast({ title: done });
}

type SectionProps = { title: string; aside?: ReactNode; children: ReactNode; testID?: string | undefined };

function Section({ title, aside, children, testID }: SectionProps) {
	return (
		<Card testID={testID}>
			<Card.Body className="gap-3">
				<View className="flex-row items-center gap-3">
					<Typography.Heading type="h6" className="flex-1" accessibilityRole="header">
						{title}
					</Typography.Heading>
					{aside}
				</View>
				{children}
			</Card.Body>
		</Card>
	);
}

function Notice({ status, message }: { status: "accent" | "warning" | "danger"; message: string }) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

export function LetterWrite({ id }: { id: string }) {
	const { t } = useLingui();
	const letter = useLetterStore((state) => (state.document?.id === id ? state.document : null));
	const status = useLetterStore((state) => state.status);
	const draft = useLetterDrafting((state) => state.draft);
	const applications = useApplications();

	if (!letter) {
		return status === "error" ? (
			<Screen>
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load the cover letter`}
					description={t`Check your connection and try again.`}
					action={{
						label: t`Retry`,
						onPress: () =>
							void useLetterStore
								.getState()
								.open(id)
								.catch(() => undefined),
					}}
				/>
			</Screen>
		) : (
			<Screen>
				<Skeleton variant="none" className="h-28 rounded-3xl" />
				<Skeleton variant="none" className="h-48 rounded-3xl" />
			</Screen>
		);
	}

	const application = applications.data?.find((item) => item.id === letter.sourceApplicationId) ?? null;
	const disabled = letter.isLocked;

	return (
		<View className="flex-1">
			<Screen testID="letter-write">
				{disabled ? (
					<Notice status="accent" message={t`This letter is locked. Unlock it in Documents to edit.`} />
				) : null}
				<ForSection application={application} applications={applications.data ?? []} disabled={disabled} />
				<ToSection letter={letter} application={application} disabled={disabled} />
				<FromSection letter={letter} disabled={disabled} />
				<BodySection letter={letter} application={application} disabled={disabled} />
				{/* While a draft shows, the length is the draft's. */}
				<LengthSection
					words={countWords(draft.phase === "streaming" || draft.phase === "ready" ? draft.text : letter.content)}
				/>
				<DesignNote letter={letter} />
			</Screen>
			<RichTextToolbar />
		</View>
	);
}

type ForSectionProps = { application: Application | null; applications: Application[]; disabled: boolean };

/** FOR: the application the letter is for. Linking one fills the recipient; without one, drafting uses the resume. */
function ForSection({ application, applications, disabled }: ForSectionProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const search = query.trim().toLocaleLowerCase();
	const choices = applications
		.filter((item) => item.status !== "closed" || item.id === application?.id)
		.filter((item) => !search || `${item.role} ${item.company}`.toLocaleLowerCase().includes(search));

	const close = () => {
		setOpen(false);
		setQuery("");
	};
	const choose = (next: Application | null) => {
		close();
		void relinkLetter((draft) => {
			draft.sourceApplicationId = next?.id ?? null;
			// The recipient comes from the application: its company, and its first contact when it has one.
			if (next && draft.layout === "structured") {
				draft.recipientCompany = next.company;
				draft.recipientName = next.contacts[0]?.name ?? "";
			}
		}).then((result) => relinked(result));
	};

	return (
		<Section title={t`For`}>
			{application ? (
				<View className="flex-row items-center gap-3 rounded-2xl bg-surface-secondary p-3">
					<View className="size-10 items-center justify-center rounded-xl bg-surface">
						<Text weight="semibold" tone="muted">
							{application.company.charAt(0).toLocaleUpperCase()}
						</Text>
					</View>
					<View className="min-w-0 flex-1 gap-0.5">
						<Text weight="medium" numberOfLines={2}>
							{application.role}
						</Text>
						<Text size="xs" tone="muted" numberOfLines={1}>
							{application.company}
						</Text>
						<StageLabel stage={application.status} label={getStageLabel(application.status)} size="xs" tone="muted" />
					</View>
					<Button size="sm" variant="secondary" isDisabled={disabled} onPress={() => setOpen(true)}>
						{t`Change`}
					</Button>
				</View>
			) : (
				<>
					<Button
						variant="secondary"
						isDisabled={disabled}
						onPress={() => setOpen(true)}
						testID="letter-link-application"
					>
						<Icon name="briefcase" size={16} />
						<Button.Label>{t`Link an application`}</Button.Label>
					</Button>
					<Text size="xs" tone="muted" className="leading-5">
						{t`Without one, you fill in the recipient yourself and drafting uses only your resume.`}
					</Text>
				</>
			)}
			<Sheet
				isOpen={open}
				onOpenChange={(next) => !next && close()}
				title={t`Application`}
				closeLabel={t`Close`}
				detents={[0.6, 0.95]}
			>
				{applications.length === 0 ? (
					<EmptyState
						kind="page"
						icon="briefcase"
						title={t`No applications yet`}
						description={t`Add one in Applications first.`}
					/>
				) : (
					<View className="gap-3">
						<SearchField value={query} onChange={setQuery}>
							<SearchField.Group>
								<SearchField.SearchIcon />
								<SearchField.Input placeholder={t`Search applications`} accessibilityLabel={t`Search applications`} />
								<SearchField.ClearButton />
							</SearchField.Group>
						</SearchField>
						<ListSection>
							{[
								...(application
									? [
											<ListRow
												key="none"
												icon="link-break"
												title={t`No application`}
												chevron={false}
												onPress={() => choose(null)}
											/>,
										]
									: []),
								...choices.map((item) => (
									<ListRow
										key={item.id}
										icon="briefcase"
										title={item.role}
										description={`${item.company} · ${getStageLabel(item.status)}`}
										chevron={false}
										isSelected={item.id === application?.id}
										onPress={() => choose(item)}
									/>
								)),
							]}
						</ListSection>
					</View>
				)}
			</Sheet>
		</Section>
	);
}

type LetterSectionProps = { letter: LetterDocument; application: Application | null; disabled: boolean };

/** TO: name or team, company and date for structured letters; older (freeform) letters keep their recipient block. */
function ToSection({ letter, application, disabled }: LetterSectionProps) {
	const { t, i18n } = useLingui();

	if (letter.layout === "freeform") {
		return (
			<Section title={t`To`}>
				<RichTextField
					tools="letter"
					focus={letterFieldFocus}
					key={letter.id}
					label={t`Recipient`}
					value={letter.recipient}
					disabled={disabled}
					minLines={3}
					onChange={(recipient) => edit("recipient", (draft) => void (draft.recipient = recipient))}
				/>
				<Text size="xs" tone="muted">{t`This letter keeps its recipient as written.`}</Text>
			</Section>
		);
	}

	return (
		<Section title={t`To`}>
			<TextField isDisabled={disabled}>
				<Label>{t`Name or team`}</Label>
				<Input
					variant="secondary"
					value={letter.recipientName}
					maxLength={200}
					placeholder={t`Hiring team`}
					returnKeyType="next"
					accessibilityLabel={t`Name or team`}
					{...letterFieldFocus}
					onChangeText={(value) => edit("recipientName", (draft) => void (draft.recipientName = value))}
				/>
			</TextField>
			<TextField isDisabled={disabled}>
				<Label>{t`Company`}</Label>
				<Input
					variant="secondary"
					value={letter.recipientCompany}
					maxLength={200}
					accessibilityLabel={t`Company`}
					{...letterFieldFocus}
					onChangeText={(value) => edit("recipientCompany", (draft) => void (draft.recipientCompany = value))}
				/>
			</TextField>
			<DatePicker
				variant="secondary"
				label={t`Date`}
				value={letter.letterDate}
				placeholder={t`No date`}
				clearLabel={t`No date`}
				locale={i18n.locale}
				isDisabled={disabled}
				onChange={(value) => edit("letterDate", (draft) => void (draft.letterDate = value))}
			/>
			<Text size="xs" tone="muted">
				{application
					? t`Filled from the application. The greeting follows the name.`
					: t`The greeting follows the name.`}
			</Text>
		</Section>
	);
}

// The From choices that aren't a resume id. Resume ids are UUIDs, so they can't clash.
const FROM_PROFILE = "profile";
const FROM_OWN = "own";

/** Which From choice a letter is on: its own copy, a linked resume, or (linked without a resume) the Profile. */
const fromChoice = (letter: Pick<LetterDocument, "senderLinked" | "sourceResumeId">) =>
	!letter.senderLinked ? FROM_OWN : (letter.sourceResumeId ?? FROM_PROFILE);

/**
 * FROM: where the sender's details come from. The Profile (the default) and a resume stay live; "this letter only" is a
 * copy, edited here. Picking the Profile lets go of the letter's resume, whose design link ends with it.
 */
function FromSection({ letter, disabled }: { letter: LetterDocument; disabled: boolean }) {
	const { t } = useLingui();
	const resumes = useResumes();
	const [open, setOpen] = useState(false);
	const value = fromChoice(letter);
	const resumeName = resumes.data?.find((item) => item.id === letter.sourceResumeId)?.name;
	const label =
		value === FROM_OWN ? t`This letter only` : value === FROM_PROFILE ? t`Your Profile` : (resumeName ?? t`A resume`);

	const choose = (next: string) => {
		setOpen(false);
		if (next === value) return;
		void relinkLetter((draft) => {
			if (next === FROM_OWN) {
				draft.senderLinked = false;
			} else if (next === FROM_PROFILE) {
				draft.sourceResumeId = null;
				draft.senderLinked = true;
				draft.designLinked = false;
			} else {
				// A letter taking a resume for the first time takes its design with it.
				if (!draft.sourceResumeId) draft.designLinked = true;
				draft.sourceResumeId = next;
				draft.senderLinked = true;
			}
		}).then((result) =>
			relinked(result, next === FROM_OWN ? t`Your details were copied into the letter. Edit them here.` : undefined),
		);
	};

	const options = [
		{ value: FROM_PROFILE, title: t`Your Profile`, icon: "user-circle" as const },
		...(resumes.data ?? []).map((item) => ({ value: item.id, title: item.name, icon: "file-text" as const })),
		{ value: FROM_OWN, title: t`This letter only`, icon: "pencil-simple" as const },
	];

	return (
		<Section title={t`From`} testID="letter-from">
			<ListSection>
				<ListRow
					icon="user-circle"
					title={t`Your details from`}
					value={label}
					isDisabled={disabled}
					onPress={() => setOpen(true)}
					testID="letter-from-choice"
				/>
			</ListSection>
			{resumes.isError ? (
				<View className="gap-2">
					<Notice status="warning" message={t`Couldn't load your resumes.`} />
					<Button size="sm" variant="secondary" className="self-start" onPress={() => void resumes.refetch()}>
						{t`Retry`}
					</Button>
				</View>
			) : null}
			{value === FROM_OWN ? (
				<SenderFields letter={letter} disabled={disabled} />
			) : (
				<Text size="xs" tone="muted" className="leading-5">
					{value === FROM_PROFILE
						? t`Your name and contact details follow your Profile.`
						: t`Your name and contact details follow “${resumeName ?? t`the resume`}”.`}
				</Text>
			)}
			<Sheet
				isOpen={open}
				onOpenChange={(next) => !next && setOpen(false)}
				title={t`Your details from`}
				closeLabel={t`Close`}
				detents={["auto", 0.9]}
			>
				<ListSection>
					{options.map((option) => (
						<ListRow
							key={option.value}
							icon={option.icon}
							title={option.title}
							chevron={false}
							isSelected={option.value === value}
							onPress={() => choose(option.value)}
							testID={`letter-from-${option.value === FROM_PROFILE || option.value === FROM_OWN ? option.value : "resume"}`}
						/>
					))}
				</ListSection>
			</Sheet>
		</Section>
	);
}

type SenderField = "name" | "headline" | "email" | "phone" | "location";

/** The letter's own sender details: saved with the letter (`coverLetters.update` with `basics`), nowhere else. */
function SenderFields({ letter, disabled }: { letter: LetterDocument; disabled: boolean }) {
	const { t } = useLingui();
	const basics = letter.style.basics;
	const fields: { key: SenderField; label: string; keyboard?: "email-address" | "phone-pad" }[] = [
		{ key: "name", label: t`Name` },
		{ key: "headline", label: t`Headline` },
		{ key: "email", label: t`Email`, keyboard: "email-address" },
		{ key: "phone", label: t`Phone`, keyboard: "phone-pad" },
		{ key: "location", label: t`Location` },
	];

	return (
		<View className="gap-3" testID="letter-sender-fields">
			{fields.map((field) => (
				<TextField key={field.key} isDisabled={disabled}>
					<Label>{field.label}</Label>
					<Input
						variant="secondary"
						value={basics[field.key]}
						maxLength={200}
						autoCapitalize={field.keyboard ? "none" : "sentences"}
						keyboardType={field.keyboard ?? "default"}
						accessibilityLabel={field.label}
						{...letterFieldFocus}
						onChangeText={(value) =>
							edit(`basics.${field.key}`, (draft) => void (draft.style.basics[field.key] = value))
						}
					/>
				</TextField>
			))}
			<TextField isDisabled={disabled}>
				<Label>{t`Website`}</Label>
				<Input
					variant="secondary"
					value={basics.website.url}
					maxLength={200}
					autoCapitalize="none"
					keyboardType="url"
					accessibilityLabel={t`Website`}
					{...letterFieldFocus}
					onChangeText={(url) => edit("basics.website", (draft) => void (draft.style.basics.website.url = url))}
				/>
			</TextField>
		</View>
	);
}

/**
 * The body. Empty, it offers a draft from the posting and the resume. A draft shows on a tinted block until it's kept:
 * it never replaces typed text by itself.
 */
function BodySection({ letter, application, disabled }: LetterSectionProps) {
	const { t } = useLingui();
	const words = useLetterWords(letter.style.metadata.page.locale);
	const draft = useLetterDrafting((state) => state.draft);
	// Once the editor shows it stays, so clearing the text while typing never swaps it for the draft offer.
	const [writing, setWriting] = useState(() => countWords(letter.content) > 0);
	const structured = letter.layout === "structured";
	const name = greetingName(letter.recipientName);
	const showEditor = writing || countWords(letter.content) > 0;

	const body =
		draft.phase !== "idle" ? (
			<DraftBox
				letter={letter}
				application={application}
				onKeep={(text) => {
					useLetterStore.getState().update((value) => void (value.content = coverLetterTextToHtml(text)), {
						newStep: true,
					});
					discardLetterDraft();
					setWriting(true);
					showToast({ title: t`Draft kept. Edit anything you like.`, variant: "success" });
				}}
			/>
		) : showEditor ? (
			<RichTextField
				tools="letter"
				focus={letterFieldFocus}
				key={letter.id}
				label={t`Letter body`}
				value={letter.content}
				disabled={disabled}
				autoFocus={writing && countWords(letter.content) === 0}
				onChange={(content) => edit("content", (value) => void (value.content = content))}
				testID="letter-body"
			/>
		) : (
			<EmptyBody letter={letter} application={application} disabled={disabled} onWrite={() => setWriting(true)} />
		);

	return (
		<Section title={t`Letter`}>
			{structured && words ? (
				<FramingField
					letter={letter}
					field="greeting"
					defaultValue={name ? words.greeting(name) : words.teamGreeting}
					disabled={disabled}
				/>
			) : null}
			{body}
			{structured && words ? (
				<>
					<FramingField
						letter={letter}
						field="signOff"
						defaultValue={defaultCoverLetterSignOff(letter, words)}
						disabled={disabled}
					/>
					<Text size="xs" tone="muted" className="leading-5">
						{t`Clear the greeting or sign-off to omit it. Clearing the sign-off also removes the automatic signature.`}
					</Text>
				</>
			) : null}
		</Section>
	);
}

type FramingFieldProps = {
	letter: LetterDocument;
	field: "greeting" | "signOff";
	defaultValue: string;
	disabled: boolean;
};

/** Greeting and sign-off: plain text that follows the recipient and locale until edited. */
function FramingField({ letter, field, defaultValue, disabled }: FramingFieldProps) {
	const { t } = useLingui();
	const label = field === "greeting" ? t`Greeting` : t`Sign-off`;
	return (
		<View className="gap-1">
			<TextField isDisabled={disabled}>
				<Label>{label}</Label>
				<TextArea
					variant="secondary"
					value={letter[field] ?? defaultValue}
					maxLength={2_000}
					numberOfLines={field === "greeting" ? 1 : 2}
					accessibilityLabel={label}
					{...letterFieldFocus}
					onChangeText={(value) => edit(field, (draft) => void (draft[field] = value))}
				/>
			</TextField>
			{letter[field] !== null && !disabled ? (
				<Button
					size="sm"
					variant="ghost"
					className="self-start"
					onPress={() => useLetterStore.getState().update((draft) => void (draft[field] = null), { newStep: true })}
				>
					{t`Use default`}
				</Button>
			) : null}
		</View>
	);
}

type EmptyBodyProps = {
	letter: LetterDocument;
	application: Application | null;
	disabled: boolean;
	onWrite: () => void;
};

function EmptyBody({ letter, application, disabled, onWrite }: EmptyBodyProps) {
	const { t } = useLingui();
	const session = useSession();
	const ai = useHasAIProvider();
	const [setup, setSetup] = useState(false);
	const hasResume = !!letter.sourceResumeId;
	// Without a resume, a draft reads the Profile.
	const profile = useQuery({
		...profileQuery(session.server),
		enabled: !hasResume && session.status === "signed-in",
	});
	const hasProfile = !hasResume && !!profile.data && profileHasCareer(profile.data.data);
	const company = application?.company;
	const canDraft = hasResume || hasProfile || !!application;
	const offerDraft = canDraft && ai.hasAIProvider;

	return (
		<View className="gap-3 rounded-2xl border border-dashed border-border p-4">
			<Text tone="muted" className="leading-5">
				{company && hasResume
					? t`Start typing, or draft from what we know: the ${company} posting and your resume.`
					: company && hasProfile
						? t`Start typing, or draft from what we know: the ${company} posting and your Profile.`
						: company
							? t`Start typing, or draft from what we know: the ${company} posting.`
							: hasResume
								? t`Start typing, or draft from what we know: your resume.`
								: hasProfile
									? t`Start typing, or draft from what we know: your Profile.`
									: t`Start typing. To draft one, fill in your Profile, or link a resume or an application.`}
			</Text>
			<View className="flex-row flex-wrap gap-2">
				{offerDraft ? (
					<Button
						size="sm"
						isDisabled={disabled}
						onPress={() => {
							Keyboard.dismiss();
							void startLetterDraft("draft");
						}}
						testID="letter-draft"
					>
						<Icon name="sparkle" size={16} tone="accent-foreground" />
						<Button.Label>
							{application
								? t`Draft from the posting`
								: hasResume
									? t`Draft from your resume`
									: t`Draft from your Profile`}
						</Button.Label>
					</Button>
				) : null}
				{/* The draft is the one primary action; without it, writing is the way in. */}
				<Button size="sm" variant={offerDraft ? "ghost" : "secondary"} isDisabled={disabled} onPress={onWrite}>
					{t`Write it myself`}
				</Button>
			</View>
			{canDraft && ai.error ? (
				<View className="gap-2">
					<Notice status="warning" message={t`Couldn't check your AI providers.`} />
					<Button size="sm" variant="secondary" className="self-start" onPress={ai.retry}>
						{t`Retry`}
					</Button>
				</View>
			) : null}
			{canDraft && !ai.isUnavailable && !ai.hasAIProvider ? (
				<View className="gap-1">
					<Text size="xs" tone="muted">{t`Drafting needs an AI provider.`}</Text>
					<Button size="sm" variant="ghost" className="self-start" onPress={() => setSetup(true)}>
						{t`Open AI settings`}
					</Button>
				</View>
			) : null}
			<AIProviderSetupSheet open={setup} onClose={() => setSetup(false)} />
		</View>
	);
}

type DraftBoxProps = { letter: LetterDocument; application: Application | null; onKeep: (text: string) => void };

/** The draft on its tinted block, then Keep, Shorter, More personal or Discard. */
function DraftBox({ letter, application, onKeep }: DraftBoxProps) {
	const { t } = useLingui();
	const reducedMotion = useReducedMotion();
	const draft = useLetterDrafting((state) => state.draft);
	const last = useLetterDrafting((state) => state.last);

	if (draft.phase === "idle") return null;
	if (draft.phase === "unsaved" || draft.phase === "failed") {
		const gateway = draft.phase === "failed" && draft.error instanceof ORPCError && draft.error.code === "BAD_GATEWAY";
		const provider = draft.phase === "failed" ? draft.provider : null;
		return (
			<View className="gap-2">
				<Notice
					status="danger"
					message={
						draft.phase === "unsaved"
							? t`Couldn't save your changes, so drafting didn't start. Nothing on the page changed.`
							: gateway && provider
								? t`Drafting stopped: ${provider} didn't respond. Nothing on the page changed.`
								: t`Drafting stopped. Nothing on the page changed.`
					}
				/>
				<View className="flex-row gap-2">
					<Button size="sm" variant="secondary" onPress={() => void startLetterDraft(last.variant, last.previous)}>
						{t`Try again`}
					</Button>
					<Button size="sm" variant="ghost" onPress={discardLetterDraft}>
						{t`Dismiss`}
					</Button>
				</View>
			</View>
		);
	}

	const streaming = draft.phase === "streaming";
	const sources =
		letter.sourceResumeId && application
			? t`Draft · uses only your resume and the posting`
			: application
				? t`Draft · uses only the posting`
				: letter.sourceResumeId
					? t`Draft · uses only your resume`
					: t`Draft · uses only your Profile`;

	return (
		<View className="gap-2" testID="letter-draft-box">
			<Text size="xs" tone="muted">
				{sources}
			</Text>
			<View
				accessibilityLiveRegion="polite"
				className={cx(
					"min-h-32 rounded-2xl border bg-accent-soft p-3",
					draft.phase === "ready" ? "border-accent" : "border-transparent",
				)}
			>
				<Typography type="body-sm" className="text-accent-soft-foreground">
					{/* Reduced motion shows the whole draft at once. */}
					{streaming && reducedMotion ? t`Drafting…` : draft.text}
					{streaming && !reducedMotion ? "▍" : ""}
				</Typography>
			</View>
			{streaming ? (
				<Button size="sm" variant="secondary" className="self-start" onPress={discardLetterDraft}>
					<Icon name="stop" size={16} />
					<Button.Label>{t`Stop`}</Button.Label>
				</Button>
			) : (
				<View className="flex-row flex-wrap gap-2">
					<Button size="sm" onPress={() => onKeep(draft.text)} testID="letter-draft-keep">
						{t`Keep`}
					</Button>
					<Button size="sm" variant="secondary" onPress={() => void startLetterDraft("shorter", draft.text)}>
						{t`Shorter`}
					</Button>
					<Button size="sm" variant="secondary" onPress={() => void startLetterDraft("personal", draft.text)}>
						{t`More personal`}
					</Button>
					<Button size="sm" variant="danger-soft" onPress={discardLetterDraft}>
						{t`Discard`}
					</Button>
					<ReportAiContent source="letter" text={draft.text} />
				</View>
			)}
		</View>
	);
}

/** Length: the word count against the 180 to 320 band most recruiters read, as a hint rather than a rule. */
function LengthSection({ words }: { words: number }) {
	const { t } = useLingui();
	const length = letterLength(words);
	const fraction = (value: number) => `${(value / LETTER_LENGTH.scale) * 100}%` as const;
	const band = { start: fraction(LETTER_LENGTH.min), width: fraction(LETTER_LENGTH.max - LETTER_LENGTH.min) };
	const fill = { width: fraction(Math.min(words, LETTER_LENGTH.scale)) };

	return (
		<Section
			title={t`Length`}
			aside={
				<Text mono tabular tone={length === "comfortable" ? "accent" : length === "empty" ? "muted" : "warning"}>
					{plural(words, { one: "# word", other: "# words" })}
				</Text>
			}
		>
			<View
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				className="h-1.5 overflow-hidden rounded-full bg-default"
			>
				<View className="absolute inset-y-0 bg-border" style={[band]} />
				<View
					className={cx(
						"h-full rounded-full",
						length === "empty" ? "bg-border" : length === "comfortable" ? "bg-accent" : "bg-warning",
					)}
					style={[fill]}
				/>
			</View>
			<Text size="xs" tone={length === "long" ? "warning" : "muted"} className="leading-5">
				{length === "empty"
					? t`Most recruiters read 180–320 words. The shaded band shows the range.`
					: length === "short"
						? t`Short and direct. Fine if the posting asks for brevity.`
						: length === "comfortable"
							? t`A comfortable length, and it fits on one page.`
							: t`Getting long. Try “Shorter”, or cut the least specific paragraph.`}
			</Text>
		</Section>
	);
}

/** DESIGN: what the letter looks like, and where to change it. */
function DesignNote({ letter }: { letter: LetterDocument }) {
	const router = useRouter();
	const { t, i18n } = useLingui();
	const metadata = letter.style.metadata;
	const pairing = matchFontPairing(metadata);
	const accent = ACCENTS.find((option) => option.hex === rgbaToHex(metadata.design.colors.primary));
	const pairingName = pairing ? i18n._(PAIRING_NAMES[pairing]) : null;
	const summary = [
		templateName(metadata.template),
		pairingName && t`${pairingName} type`,
		accent && i18n._(ACCENT_NAMES[accent.label]),
	]
		.filter(Boolean)
		.join(", ");
	return (
		<Section title={t`Design`}>
			<Text tone="muted">
				{letter.designLinked ? t`Matches the resume (${summary}).` : t`Its own design (${summary}).`}
			</Text>
			<Button
				size="sm"
				variant="ghost"
				className="self-start"
				onPress={() => router.replace(routes.letter(letter.id, "design"))}
			>
				{t`Change it in Design`}
			</Button>
		</Section>
	);
}
