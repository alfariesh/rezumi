import type { RouterOutput } from "./api";
import type { Draft, DraftValues, SaveStatus } from "./draft";
import type { PageReading, ReadingSummary } from "./reading";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
	Alert,
	Button,
	buttonVariants,
	Checkbox,
	Disclosure,
	Input,
	Spinner,
	ToggleButton,
	ToggleButtonGroup,
} from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { suggestContacts } from "@rezumi/job-sites/contacts";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { deadlineDay, defaultFollowUpDay, localDay } from "../shared/follow-ups";
import { draftKey, tabSelectionKey } from "../shared/storage";
import { aiFields } from "./ai";
import { AiScore, AiSourcePicker, ReadWithAiSwitch } from "./ai-parts";
import { askWorker, orpc } from "./api";
import {
	canSave,
	contactId,
	createInput,
	draftFromReading,
	editDraft,
	postingIdentity,
	readDraft,
	withCapture,
} from "./draft";
import { errorKind } from "./errors";
import { SelectField, TextField } from "./fields";
import { ReminderEditor, ReminderFields } from "./follow-up";
import { MatchSection, useMatchResume } from "./match-section";
import { PrepareSection } from "./prepare";
import { SaveError } from "./save-error";
import { useStatusLabels } from "./status";
import { useSettings, useSavedPosting } from "./stores";
import { useAiChoice } from "./use-ai";

type PostingScreenProps = {
	tabId: number;
	reading: PageReading;
	summary: ReadingSummary;
};

/**
 * A posting the panel read (01-desain.md §3.3, §3.4): the save form, or the application already saved for it
 * (aturan turunan #4: shown instead of saving twice, with "Save as a new application").
 */
export function PostingScreen({ tabId, reading, summary }: PostingScreenProps) {
	const identity = postingIdentity(reading);
	const savedLocally = useSavedPosting(reading.key);
	const [settings] = useSettings();
	const ai = useAiChoice();
	// Aturan turunan #3 keeps the switch's last position; it only runs when some AI can (ai.ts).
	const readWithAi = (settings?.readWithAi ?? false) && Boolean(ai.source);
	// One key per AI reading on this panel, so a retry of the same reading takes Rezumi AI's credit once. Turning the
	// switch on again is a new reading (after buying credits, say), with a new key and no cached failure.
	const [panelKey] = useState(() => crypto.randomUUID());
	const [aiAttempt, setAiAttempt] = useState(0);
	const selection = useContextMenuSelection(tabId, reading.url);
	const withSelection = useMemo(
		() => (selection && !reading.selection ? { ...reading, selection } : reading),
		[reading, selection],
	);

	// The server's reading (fields, existing and similar applications), once per posting the person opened. Never per
	// page visited: the panel is open and showing this posting (02-teknis.md §9, §19.3).
	const capture = useQuery({
		...orpc.applications.readCapture.queryOptions({
			input: {
				url: withSelection.url,
				canonicalUrl: withSelection.canonicalUrl,
				site: withSelection.site,
				pageTitle: withSelection.pageTitle,
				jsonLd: withSelection.jsonLd,
				text: withSelection.text,
				...(withSelection.selection ? { selection: withSelection.selection } : {}),
				fields: withSelection.fields,
				useAi: readWithAi,
				...(readWithAi ? aiFields(ai, `${panelKey}:${aiAttempt}:${identity}`.slice(0, 100)) : {}),
			},
		}),
		// With AI on, wait for the account's choice so the reading runs once, on the right AI.
		enabled: settings !== undefined && (!settings.readWithAi || !ai.loading),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

	const [savedHere, setSavedHere] = useState<{ identity: string; id: string } | null>(null);
	const [asNew, setAsNew] = useState<string | null>(null);
	const existingId = savedLocally?.id ?? capture.data?.existing?.id ?? null;
	const savedId = savedHere?.identity === identity ? savedHere.id : asNew === identity ? null : (existingId ?? null);

	// The local marks load in a moment; waiting avoids showing the form for a posting that is already saved.
	if (savedLocally === undefined)
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-muted">
				<Spinner size="sm" color="current" aria-hidden />
				<Trans comment="Browser extension status while it reads the open web page">Reading this page…</Trans>
			</p>
		);
	if (savedId)
		return (
			<SavedView
				id={savedId}
				postingKey={reading.key}
				justSaved={savedHere?.identity === identity}
				onSaveAsNew={() => {
					setSavedHere(null);
					setAsNew(identity);
				}}
			/>
		);

	return (
		<SaveForm
			tabId={tabId}
			identity={identity}
			reading={withSelection}
			summary={summary}
			capture={capture}
			readWithAi={readWithAi}
			ai={ai}
			onAiTurnedOn={() => setAiAttempt((attempt) => attempt + 1)}
			duplicate={asNew === identity}
			onSaved={(id) => setSavedHere({ identity, id })}
		/>
	);
}

/** Text the person saved through the context menu on this page of this tab (another page's selection is ignored). */
function useContextMenuSelection(tabId: number, url: string): string | null {
	const [text, setText] = useState<string | null>(null);
	useEffect(() => {
		const key = tabSelectionKey(tabId);
		let active = true;
		const read = (value: unknown) => {
			const stored = value as { text?: unknown; url?: unknown } | undefined;
			const samePage = typeof stored?.url !== "string" || stored.url === url;
			setText(samePage && typeof stored?.text === "string" && stored.text.trim() ? stored.text.trim() : null);
		};
		void chrome.storage.session.get(key).then((stored) => {
			if (active) read(stored[key]);
		});
		const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
			if (area === "session" && key in changes) read(changes[key]?.newValue);
		};
		chrome.storage.onChanged.addListener(listener);
		return () => {
			active = false;
			chrome.storage.onChanged.removeListener(listener);
		};
	}, [tabId, url]);
	return text;
}

type CaptureQuery = UseQueryResult<RouterOutput["applications"]["readCapture"]>;

type SaveFormProps = {
	tabId: number;
	identity: string;
	reading: PageReading;
	summary: ReadingSummary;
	capture: CaptureQuery;
	readWithAi: boolean;
	ai: ReturnType<typeof useAiChoice>;
	onAiTurnedOn: () => void;
	/** The person chose "Save as a new application" for a posting already saved. */
	duplicate: boolean;
	onSaved: (id: string) => void;
};

/** The draft for this tab's posting, kept in session storage as the person types. */
function useDraft(tabId: number, identity: string, summary: ReadingSummary) {
	const [draft, setDraft] = useState<Draft | null>(null);
	// A stored draft for this posting wins (the person's own edits); otherwise each new reading starts it afresh.
	useEffect(() => {
		let active = true;
		void chrome.storage.session.get(draftKey(tabId)).then((stored) => {
			if (!active) return;
			setDraft(readDraft(stored[draftKey(tabId)], identity) ?? draftFromReading(identity, summary));
		});
		return () => {
			active = false;
		};
	}, [tabId, identity, summary]);

	const update = useCallback(
		(next: Draft) => {
			setDraft(next);
			void chrome.storage.session.set({ [draftKey(tabId)]: next });
		},
		[tabId],
	);
	const clear = useCallback(() => void chrome.storage.session.remove(draftKey(tabId)), [tabId]);
	return { draft, update, clear };
}

function SaveForm({
	tabId,
	identity,
	reading,
	summary,
	capture,
	readWithAi,
	ai,
	onAiTurnedOn,
	duplicate,
	onSaved,
}: SaveFormProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const { draft, update, clear } = useDraft(tabId, identity, summary);
	const [, updateSettings] = useSettings();
	const resumes = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
	const knownTags = useQuery(orpc.applications.tags.queryOptions());
	const create = useMutation(orpc.applications.create.mutationOptions());
	const saveLogo = useMutation(orpc.applications.saveLogo.mutationOptions());
	const startedAt = useRef(0);

	// The server's reading fills what the page left empty and the person has not changed.
	const captured = capture.data;
	const appliedCapture = useRef<unknown>(null);
	useEffect(() => {
		if (!draft || draft.identity !== identity || !captured || appliedCapture.current === captured) return;
		appliedCapture.current = captured;
		update(withCapture(draft, captured));
	}, [captured, draft, identity, update]);

	const suggestions = useMemo(() => suggestContacts(draft?.values.description ?? ""), [draft?.values.description]);

	if (!draft)
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-muted">
				<Spinner size="sm" color="current" aria-hidden />
				<Trans comment="Browser extension status while it reads the open web page">Reading this page…</Trans>
			</p>
		);

	const set = (patch: Partial<DraftValues>) => update(editDraft(draft, patch));
	const save = () => {
		if (!canSave(draft) || create.isPending) return;
		startedAt.current = performance.now();
		const input = createInput(draft, {
			site: reading.site,
			sourceUrl: captured?.sourceUrl ?? reading.canonicalUrl,
			postingSource: captured?.postingSource ?? {
				method: "extension",
				format: "text",
				requestedUrl: reading.url,
				resolvedUrl: reading.canonicalUrl,
				retrievedAt: new Date().toISOString(),
				truncated: false,
				completeness: "unknown",
			},
			requirements: captured?.requirements ?? [],
			suggestions,
		});
		create.mutate(input, {
			onSuccess: (id) => {
				if (__DEV__) console.info(`[Rezumi] saved in ${Math.round(performance.now() - startedAt.current)} ms`);
				clear();
				void askWorker({ type: "saved", key: reading.key, id, status: draft.values.status });
				if (input.followUpAt) void askWorker({ type: "follow-ups" });
				if (captured?.companyLogoUrl) saveLogo.mutate({ id, logoUrl: captured.companyLogoUrl });
				void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
				onSaved(id);
			},
		});
	};

	const tagOptions = [...new Set([...(knownTags.data ?? []), ...draft.values.tags])].slice(0, 30);
	// Says why the reminder starts where it does while it is still the closing date's default (aturan turunan #6).
	const deadline = deadlineDay(captured?.validThrough);
	const reminderHint =
		deadline &&
		!draft.edited.includes("followUpOn") &&
		draft.values.followUpOn &&
		draft.values.followUpOn === defaultFollowUpDay(captured?.validThrough, localDay())
			? t({
					message: `The posting closes on ${new Date(`${deadline}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })}.`,
					comment: "Browser extension: why the reminder date was filled in",
				})
			: null;
	const similar = captured?.similar ?? [];
	const values = draft.values;

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				save();
			}}
		>
			{duplicate ? (
				<p className="text-sm text-muted">
					<Trans comment="Browser extension: the person is saving a posting already saved as a second application">
						Saving this posting again as a new application.
					</Trans>
				</p>
			) : null}

			{similar.length > 0 ? <SimilarWarning similar={similar} /> : null}

			<section
				aria-labelledby="posting-heading"
				className="flex flex-col gap-3 rounded-2xl border border-separator p-4"
			>
				<h2 id="posting-heading" className="sr-only">
					<Trans>Job posting</Trans>
				</h2>
				<TextField
					label={t`Role`}
					value={values.role}
					maxLength={300}
					isRequired
					isInvalid={!values.role.trim()}
					onChange={(role) => set({ role })}
				/>
				<TextField
					label={t`Company`}
					value={values.company}
					maxLength={300}
					isRequired
					isInvalid={!values.company.trim()}
					onChange={(company) => set({ company })}
				/>
				<TextField
					label={t`Location`}
					value={values.location}
					maxLength={300}
					onChange={(location) => set({ location })}
				/>
				<TextField label={t`Salary`} value={values.salary} maxLength={300} onChange={(salary) => set({ salary })} />
				<TextField
					label={t`Employment type`}
					value={values.employmentType}
					maxLength={100}
					onChange={(employmentType) => set({ employmentType })}
				/>
				{capture.isFetching ? (
					<p role="status" className="flex items-center gap-2 text-xs text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						{readWithAi ? t`Reading with AI…` : t`Checking your applications…`}
					</p>
				) : captured?.enrichmentWarning === "ai-unavailable" ? (
					<p className="text-xs text-muted">{t`AI couldn't read this posting; the fields come from the page.`}</p>
				) : null}
			</section>

			<Disclosure>
				<Disclosure.Heading>
					<Disclosure.Trigger className="flex w-full items-center justify-between text-sm font-medium">
						<Trans>Description</Trans>
						<Disclosure.Indicator />
					</Disclosure.Trigger>
				</Disclosure.Heading>
				<Disclosure.Content>
					<Disclosure.Body className="pt-2">
						<TextField
							label={t`Job description`}
							value={values.description}
							maxLength={20_000}
							multiline
							rows={8}
							onChange={(description) => set({ description })}
						/>
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>

			<MatchSection description={values.description} />

			<section aria-labelledby="save-heading" className="flex flex-col gap-4">
				<h2 id="save-heading" className="sr-only">
					<Trans>Save options</Trans>
				</h2>
				<StatusChoice value={values.status} onChange={(status) => set({ status })} />
				{values.status === "applied" ? (
					<TextField
						label={t`Applied on`}
						type="date"
						value={values.appliedOn}
						maxLength={10}
						onChange={(appliedOn) => set({ appliedOn })}
					/>
				) : null}
				<SelectField
					label={t`Resume`}
					value={values.resumeId}
					isDisabled={!resumes.data}
					options={[
						{ value: "", label: t`No resume` },
						...(resumes.data ?? []).map((resume) => ({ value: resume.id, label: resume.name })),
					]}
					onChange={(resumeId) => set({ resumeId })}
				/>
				<TagPicker selected={values.tags} options={tagOptions} onChange={(tags) => set({ tags })} />
				<ReminderFields
					day={values.followUpOn}
					note={values.followUpNote}
					hint={reminderHint}
					onChange={(patch) => set(patch)}
				/>
				{suggestions.length > 0 ? (
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-1 text-sm font-medium">
							<Trans comment="Browser extension: contact details found in the job posting's text">
								Contacts in the posting
							</Trans>
						</legend>
						<p className="text-xs text-muted">
							<Trans>Tick the ones to keep with this application.</Trans>
						</p>
						{suggestions.map((contact) => {
							const id = contactId(contact);
							return (
								<Checkbox
									key={id}
									isSelected={values.contacts.includes(id)}
									onChange={(on) =>
										set({ contacts: on ? [...values.contacts, id] : values.contacts.filter((item) => item !== id) })
									}
								>
									<Checkbox.Content className="flex items-center gap-2 text-sm">
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Icon name={contact.type === "email" ? "envelope-simple" : "phone"} size={14} aria-hidden />
										<span className="break-all">{contact.value}</span>
									</Checkbox.Content>
								</Checkbox>
							);
						})}
					</fieldset>
				) : null}
				<ReadWithAiSwitch
					choice={ai}
					isSelected={readWithAi}
					onChange={(on) => {
						if (on) onAiTurnedOn();
						void updateSettings({ readWithAi: on });
					}}
				/>
				{readWithAi ? <AiSourcePicker choice={ai} /> : null}
			</section>

			<div aria-live="polite" className="flex flex-col gap-3">
				{create.isError ? (
					<SaveError
						kind={errorKind(create.error)}
						onRetry={save}
						onWithoutAi={() => void updateSettings({ readWithAi: false })}
					/>
				) : null}
				{capture.isError && readWithAi ? (
					<SaveError
						kind={errorKind(capture.error)}
						onRetry={() => void capture.refetch()}
						onWithoutAi={() => void updateSettings({ readWithAi: false })}
					/>
				) : null}
			</div>

			<Button type="submit" fullWidth isPending={create.isPending} isDisabled={!canSave(draft)}>
				{create.isPending ? <Trans>Saving…</Trans> : <Trans>Save to Rezumi</Trans>}
			</Button>
		</form>
	);
}

type StatusChoiceProps = { value: SaveStatus; onChange: (value: SaveStatus) => void };

/** 01-desain.md §3.3: Saved / Applied (aturan turunan #2). */
function StatusChoice({ value, onChange }: StatusChoiceProps) {
	const { t } = useLingui();
	return (
		<div className="grid gap-1.5">
			<span id="status-label" className="text-sm font-medium">
				<Trans>Status</Trans>
			</span>
			<ToggleButtonGroup
				aria-labelledby="status-label"
				selectionMode="single"
				disallowEmptySelection
				selectedKeys={new Set([value])}
				onSelectionChange={(keys) => {
					const [next] = keys;
					if (next === "saved" || next === "applied") onChange(next);
				}}
				fullWidth
			>
				<ToggleButton id="saved" className="flex-1">
					{t({ message: "Saved", comment: "Status choice when saving a job: not applied yet" })}
				</ToggleButton>
				<ToggleButton id="applied" className="flex-1">
					<ToggleButtonGroup.Separator />
					{t({ message: "Already applied", comment: "Status choice when saving a job the person applied to" })}
				</ToggleButton>
			</ToggleButtonGroup>
		</div>
	);
}

type TagPickerProps = { selected: string[]; options: string[]; onChange: (tags: string[]) => void };

/** The account's tags as toggles, plus a field for a new one. */
function TagPicker({ selected, options, onChange }: TagPickerProps) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const add = () => {
		const tag = text.trim().slice(0, 50);
		if (tag && !selected.includes(tag)) onChange([...selected, tag]);
		setText("");
	};
	return (
		<div className="grid gap-1.5">
			<span id="tags-label" className="text-sm font-medium">
				<Trans>Tags</Trans>
			</span>
			{options.length > 0 ? (
				<ul aria-labelledby="tags-label" className="flex flex-wrap gap-1.5">
					{options.map((tag) => {
						const on = selected.includes(tag);
						return (
							<li key={tag}>
								<button
									type="button"
									aria-pressed={on}
									onClick={() => onChange(on ? selected.filter((item) => item !== tag) : [...selected, tag])}
									className={buttonVariants({
										size: "sm",
										variant: on ? "primary" : "tertiary",
										className: "h-7 px-2.5",
									})}
								>
									{on ? <Icon name="check" size={12} aria-hidden /> : null}
									{tag}
								</button>
							</li>
						);
					})}
				</ul>
			) : null}
			<div className="flex gap-2">
				<Input
					aria-label={t`New tag`}
					variant="primary"
					value={text}
					maxLength={50}
					placeholder={t`Add a tag`}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							add();
						}
					}}
					className="min-w-0 flex-1"
				/>
				<Button type="button" size="sm" variant="secondary" isDisabled={!text.trim()} onPress={add}>
					<Trans>Add</Trans>
				</Button>
			</div>
		</div>
	);
}

type SimilarWarningProps = { similar: { id: string; role: string; company: string; sourceUrl: string | null }[] };

/** 02-teknis.md §19.3: the same job saved from another site. A notice, never a block. */
function SimilarWarning({ similar }: SimilarWarningProps) {
	const host = (url: string | null) => {
		try {
			return url ? new URL(url).hostname.replace(/^www\./, "") : null;
		} catch {
			return null;
		}
	};
	return (
		<Alert status="warning">
			<Alert.Indicator>
				<Icon name="copy" />
			</Alert.Indicator>
			<Alert.Content className="gap-1.5">
				<Alert.Description>
					<Trans comment="Browser extension: the same role at the same company is already saved from another job site">
						You already saved a similar job:
					</Trans>
				</Alert.Description>
				<ul className="flex flex-col gap-1 text-sm">
					{similar.map((item) => {
						const site = host(item.sourceUrl);
						return (
							<li key={item.id}>
								<ExternalLink href={rezumiLink(`/dashboard/applications/${item.id}`)}>
									{item.role} · {item.company}
									{site ? ` (${site})` : ""}
								</ExternalLink>
							</li>
						);
					})}
				</ul>
			</Alert.Content>
		</Alert>
	);
}

type SavedViewProps = {
	id: string;
	postingKey: string | null;
	justSaved: boolean;
	onSaveAsNew: () => void;
};

/** 01-desain.md §3.4: saved. Status changes save at once; notes add to the application's timeline. */
function SavedView({ id, postingKey, justSaved, onSaveAsNew }: SavedViewProps) {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const labels = useStatusLabels();
	const application = useQuery(orpc.applications.getById.queryOptions({ input: { id } }));
	const update = useMutation(orpc.applications.update.mutationOptions());
	const ai = useAiChoice();
	const matchResume = useMatchResume();
	const addNote = useMutation(orpc.applications.addNote.mutationOptions());
	const [note, setNote] = useState("");

	if (application.isPending)
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-muted">
				<Spinner size="sm" color="current" aria-hidden />
				<Trans>Loading the application…</Trans>
			</p>
		);
	if (application.isError) {
		// Deleted on the web meanwhile: the local mark is stale; offer saving again.
		if (errorKind(application.error) === "invalid")
			return (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-muted">
						<Trans>This application is no longer in Rezumi.</Trans>
					</p>
					<Button onPress={onSaveAsNew}>
						<Trans>Save to Rezumi</Trans>
					</Button>
				</div>
			);
		return <SaveError kind={errorKind(application.error)} onRetry={() => void application.refetch()} />;
	}

	const data = application.data;
	const savedAgo = relativeDay(data.createdAt, i18n.locale);
	const changeStatus = (status: string) => {
		const next = status as typeof data.status;
		if (next === data.status) return;
		update.mutate(
			{ id, status: next },
			{
				onSuccess: () => {
					void askWorker({ type: "saved", key: postingKey, id, status: next });
					void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
				},
			},
		);
	};

	return (
		<div className="flex flex-col gap-5">
			<section aria-labelledby="saved-heading" className="flex flex-col gap-3 rounded-2xl border border-separator p-4">
				<p role="status" className="flex items-center gap-2 text-sm font-medium">
					<Icon name="check-circle" size={16} className="text-success" aria-hidden />
					{justSaved ? t`Saved to Rezumi` : t`Saved to Rezumi · ${savedAgo}`}
				</p>
				<h2 id="saved-heading" className="text-base font-semibold text-balance">
					{data.role}
				</h2>
				<p className="text-sm text-muted">{[data.company, data.location].filter(Boolean).join(" · ")}</p>
				<SelectField
					label={t`Status`}
					value={data.status}
					isDisabled={update.isPending}
					options={Object.entries(labels).map(([value, label]) => ({ value, label }))}
					onChange={changeStatus}
				/>
				{update.isError ? <SaveError kind={errorKind(update.error)} onRetry={() => update.reset()} /> : null}
			</section>

			{data.jobDescription?.trim() ? <MatchSection description={data.jobDescription} /> : null}
			<AiScore application={data} resumeId={matchResume.id} choice={ai} />
			<PrepareSection application={data} matchResumeId={matchResume.id} />
			<ReminderEditor key={`${data.id}:${data.followUpAt ? String(data.followUpAt) : ""}`} application={data} />

			<form
				className="flex flex-col gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					const text = note.trim();
					if (!text) return;
					addNote.mutate(
						{ id, text },
						{
							onSuccess: () => {
								setNote("");
								void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
							},
						},
					);
				}}
			>
				<TextField label={t`Add a note`} value={note} maxLength={5_000} multiline rows={3} onChange={setNote} />
				<div aria-live="polite">
					{addNote.isSuccess ? (
						<p className="text-xs text-success">
							<Trans>Note added.</Trans>
						</p>
					) : addNote.isError ? (
						<SaveError kind={errorKind(addNote.error)} onRetry={() => addNote.reset()} />
					) : null}
				</div>
				<Button type="submit" size="sm" variant="secondary" isPending={addNote.isPending} isDisabled={!note.trim()}>
					<Trans>Add note</Trans>
				</Button>
			</form>

			<button
				type="button"
				onClick={onSaveAsNew}
				className="self-start text-xs text-muted underline underline-offset-2 hover:text-foreground"
			>
				<Trans comment="Browser extension: save the same posting again as a second application">
					Save as a new application
				</Trans>
			</button>
		</div>
	);
}

/** "today", "yesterday", "3 days ago" in the panel's language. */
function relativeDay(date: Date, locale: string): string {
	const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
	return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}

type LinkProps = { href: string; children: ReactNode };

function ExternalLink({ href, children }: LinkProps) {
	return (
		<a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
			{children}
		</a>
	);
}

/** A link styled as a secondary button that opens Rezumi on the web in a new tab. */
export function ExternalButton({ href, children }: LinkProps) {
	return (
		<a href={href} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
			{children}
			<Icon name="arrow-square-out" size={14} aria-hidden />
		</a>
	);
}
