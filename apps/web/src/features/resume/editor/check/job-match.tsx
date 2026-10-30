import type { Key, Selection } from "@heroui/react";
import type { JdTermMatch } from "@rezumi/resume/ats-pdf";
import type { ResumeData, SkillItem } from "@rezumi/schema/resume/data";
import { NativeSelect, Widget } from "@heroui-pro/react";
import {
	Avatar,
	Button,
	Input,
	Label,
	ProgressBar,
	Separator,
	Tag,
	TagGroup,
	TextArea,
	TextField,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { formatList } from "@rezumi/utils/locale";
import { generateId } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { checkStateOf, editWithUndo } from "./actions";
import { CheckWidget } from "./check-widget";
import { applicationsListQueryKey, applicationsListQueryOptions } from "@/features/applications/queries";
import { openAssistantFrom } from "@/features/assistant/open";
import { useCurrentBuilderResumeSelector, useIsResumeLocked, usePatchResume } from "@/features/resume/builder/draft";
import { toastError } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { orpc } from "@/libs/orpc/client";

/** Matches the applications feature's cap on a saved posting. */
const MAX_POSTING_CHARS = 20_000;

/** A posting term, with `label` as the posting writes it ("C#" rather than the matcher's "csharp"). */
type MatchedTerm = JdTermMatch & { label: string };

type JobMatchResult = { found: MatchedTerm[]; missing: MatchedTerm[]; total: number };

export type JobMatch = {
	/** The application the resume was made for, once the list has loaded. */
	application: { id: string; company: string; role: string; jobDescription: string | null } | null;
	/** The linked application's posting, or the one pasted this visit when none is linked. */
	posting: string;
	result: JobMatchResult | null;
	hiddenTerms: readonly string[];
};

const loadAtsPdf = () => import("@rezumi/resume/ats-pdf");

/**
 * Job match reads the posting of the application the resume is linked to, or one pasted for this visit, and sorts
 * its terms into found and missing. Terms hidden as "not true for me" are left out. It isn't part of the score.
 */
export function useJobMatch(data: ResumeData | undefined): JobMatch {
	const applicationId = useCurrentBuilderResumeSelector((resume) => resume.applicationId ?? null);
	const pasted = useEditorStore((state) => state.pastedPosting);
	const { data: application } = useQuery({
		...orpc.applications.getById.queryOptions({ input: { id: applicationId ?? "" } }),
		enabled: Boolean(applicationId),
	});
	const selectedApplication = application ?? null;
	const posting = selectedApplication ? (selectedApplication.jobDescription ?? "").trim() : pasted.trim();

	// The matcher (stemmer and skill aliases) loads only once there's a posting to match.
	const { data: engine } = useQuery({
		queryKey: ["ats-pdf-engine"],
		queryFn: loadAtsPdf,
		staleTime: Number.POSITIVE_INFINITY,
		enabled: posting.length > 0,
	});

	const hiddenTerms = data?.metadata.check?.hiddenTerms;
	const resumeText = useMemo(() => (data ? buildMarkdown(data) : ""), [data]);

	const result = useMemo(() => {
		if (!engine || !posting) return null;
		const hidden = new Set(hiddenTerms ?? []);
		const terms = engine
			.matchJobDescription({ jobDescription: posting, resumeText })
			.terms.filter((term) => !hidden.has(term.term))
			.map((term) => ({ ...term, label: termAsWritten(engine.surfaceFormsOf(term.term), posting) ?? term.term }));

		return {
			found: terms.filter((term) => term.resumeCount > 0),
			missing: terms.filter((term) => term.resumeCount === 0),
			total: terms.length,
		};
	}, [engine, posting, resumeText, hiddenTerms]);

	return { application: selectedApplication, posting, result, hiddenTerms: hiddenTerms ?? [] };
}

/** The first spelling of a term the posting uses, as it writes it ("Figma", not "figma"). */
function termAsWritten(forms: readonly string[], posting: string): string | undefined {
	for (const form of forms) {
		const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const found = posting.match(new RegExp(escaped, "i"))?.[0];
		if (found) return found;
	}
}

type JobMatchTabProps = { match: JobMatch; data: ResumeData };

export function JobMatchTab({ match }: JobMatchTabProps) {
	const { application, posting, result, hiddenTerms } = match;
	const [openTerm, setOpenTerm] = useState<string | null>(null);
	const highlightTerm = useEditorStore((state) => state.highlightTerm);
	const locked = useIsResumeLocked();
	const { i18n } = useLingui();
	const hiddenList = formatList(i18n.locale, hiddenTerms);

	if (!posting) return <NoPosting application={application} />;

	const open = result?.missing.find((term) => term.term === openTerm);

	const addToSkills = (term: MatchedTerm) => {
		const written = term.label;
		editWithUndo(
			(draft) => {
				draft.sections.skills.items.push(newSkill(written));
			},
			t`“${written}” added to Skills`,
		);
		setOpenTerm(null);
		useEditorStore.setState({ highlightTerm: term.term });
	};

	const hideTerm = (term: MatchedTerm) => {
		editWithUndo(
			(draft) => {
				const state = checkStateOf(draft);
				if (!state.hiddenTerms.includes(term.term)) state.hiddenTerms.push(term.term);
			},
			t`“${term.label}” hidden`,
		);
		setOpenTerm(null);
	};

	return (
		<div className="grid gap-3">
			<PostingSource application={application} />

			<CheckWidget
				icon="list-magnifying-glass"
				title={<Trans>Posting terms</Trans>}
				trailing={
					<Widget.Description className="shrink-0">
						<Trans>not scored</Trans>
					</Widget.Description>
				}
				contentClassName="gap-5"
			>
				{!result ? (
					<p className="text-sm text-muted">
						<Trans>Reading the posting…</Trans>
					</p>
				) : result.total === 0 ? (
					<p className="text-sm text-muted">
						<Trans>No terms stood out in this posting.</Trans>
					</p>
				) : (
					<>
						<div className="grid gap-2">
							<strong className="text-sm font-semibold tabular-nums">
								<Trans>
									{result.found.length} of {result.total} posting terms appear
								</Trans>
							</strong>
							<ProgressBar
								aria-label={t`Posting terms in your resume`}
								size="sm"
								value={result.found.length}
								maxValue={result.total}
							>
								<ProgressBar.Track>
									<ProgressBar.Fill />
								</ProgressBar.Track>
							</ProgressBar>
						</div>

						{result.missing.length > 0 && (
							<section aria-labelledby="match-missing" className="grid gap-2">
								<h3 id="match-missing" className="text-sm font-semibold">
									<Trans>Not in your resume · add only if true</Trans>
								</h3>
								{/* Picking a term opens what to do with it below; picking it again closes it. */}
								<TagGroup
									aria-labelledby="match-missing"
									selectionMode="single"
									selectedKeys={keySet(openTerm)}
									onSelectionChange={(keys) => setOpenTerm(firstKey(keys))}
								>
									<TagGroup.List>
										{result.missing.map((term) => (
											<Tag key={term.term} id={term.term} textValue={term.label}>
												<Icon name="plus" />
												{term.label}
											</Tag>
										))}
									</TagGroup.List>
								</TagGroup>

								{open && (
									<section
										key={open.term}
										aria-label={t`Add “${open.label}”`}
										className={cn(ENTER_CLASS, "grid gap-3 rounded-xl bg-surface-secondary p-4 fields-on-card")}
									>
										<p className="text-sm text-muted">
											<Plural
												value={open.jdCount}
												one={`“${open.label}” appears once in the posting.`}
												other={`“${open.label}” appears #× in the posting.`}
											/>{" "}
											<Trans>If it's part of your experience, add it where it belongs.</Trans>
										</p>
										<div className="grid justify-items-start gap-1">
											<Button size="sm" isDisabled={locked} onPress={() => addToSkills(open)}>
												<Icon name="plus" size={16} />
												<Trans>Add to Skills</Trans>
											</Button>
											<Button
												size="sm"
												variant="secondary"
												isDisabled={locked}
												onPress={() => askAssistant(open.label)}
											>
												<Icon name="sparkle" size={16} />
												<Trans>Ask the assistant to work it in</Trans>
											</Button>
											<Button size="sm" variant="ghost" isDisabled={locked} onPress={() => hideTerm(open)}>
												<Trans>Not true for me, hide it</Trans>
											</Button>
										</div>
									</section>
								)}
							</section>
						)}

						{result.found.length > 0 && (
							<section aria-labelledby="match-found" className="grid gap-2">
								<h3 id="match-found" className="text-sm font-semibold">
									<Trans>Already covered · pick one to find it on the page</Trans>
								</h3>
								{/* The picked term is highlighted on the page; picking it again clears the highlight. */}
								<TagGroup
									aria-labelledby="match-found"
									selectionMode="single"
									selectedKeys={keySet(highlightTerm)}
									onSelectionChange={(keys) => useEditorStore.setState({ highlightTerm: firstKey(keys) })}
								>
									<TagGroup.List>
										{result.found.map((term) => (
											<Tag key={term.term} id={term.term} textValue={term.label}>
												<Icon name="check" className="text-success" />
												{term.label}
											</Tag>
										))}
									</TagGroup.List>
								</TagGroup>
							</section>
						)}
					</>
				)}

				{hiddenTerms.length > 0 && (
					<p className="text-xs text-muted">
						<Trans>Hidden: {hiddenList}</Trans> ·{" "}
						{/* An inline text action inside the sentence; a HeroUI Button would break the line. */}
						<button
							type="button"
							disabled={locked}
							className="cursor-(--cursor-interactive) font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
							onClick={() =>
								editWithUndo(
									(draft) => {
										checkStateOf(draft).hiddenTerms = [];
									},
									t`Hidden terms are back`,
								)
							}
						>
							<Trans>Show again</Trans>
						</button>
					</p>
				)}
			</CheckWidget>
		</div>
	);
}

/** A single-selection TagGroup's selected keys, from the one picked term (or none). */
const keySet = (key: string | null): Selection => new Set<Key>(key ? [key] : []);

/** The picked term from a single-selection change, or null once it's cleared. */
const firstKey = (keys: Selection): string | null => {
	if (keys === "all") return null;
	const [key] = keys;
	return key === undefined ? null : String(key);
};

const newSkill = (name: string): SkillItem => ({
	id: generateId(),
	hidden: false,
	icon: "",
	iconColor: "",
	name,
	proficiency: "",
	level: 0,
	keywords: [],
});

function useLinkApplication() {
	const resumeId = useCurrentBuilderResumeSelector((resume) => resume.id);
	const patchResume = usePatchResume();
	const { mutateAsync, isPending } = useMutation(orpc.documents.linkApplication.mutationOptions());

	const link = async (applicationId: string | null) => {
		try {
			await mutateAsync({ type: "resume", id: resumeId, applicationId });
			patchResume((resume) => {
				resume.applicationId = applicationId;
			});
		} catch (error) {
			toastError(error, t`Couldn't link the application. Try again.`);
		}
	};

	return { link, isPending };
}

/** Where the posting comes from, with Change (link another application or unlink) or Save as application. */
function PostingSource({ application }: { application: JobMatch["application"] }) {
	const [changing, setChanging] = useState(false);
	const { link } = useLinkApplication();

	if (!application) {
		return (
			<CheckWidget icon="briefcase" title={<Trans>Posting</Trans>} contentClassName="gap-2 p-3">
				<div className="flex items-center gap-3">
					<Avatar size="sm" className="shrink-0">
						<Avatar.Fallback>
							<Icon name="copy" size={16} />
						</Avatar.Fallback>
					</Avatar>
					<span className="grid min-w-0 flex-1">
						<b className="text-sm font-semibold">
							<Trans>Pasted posting</Trans>
						</b>
						<span className="text-xs text-muted">
							<Trans>For this visit only</Trans>
						</span>
					</span>
					<Button size="sm" variant="secondary" onPress={() => useEditorStore.setState({ pastedPosting: "" })}>
						<Trans>Clear</Trans>
					</Button>
				</div>
				<SaveAsApplication />
			</CheckWidget>
		);
	}

	return (
		<CheckWidget icon="briefcase" title={<Trans>Posting</Trans>} contentClassName="gap-2 p-3">
			<div className="flex items-center gap-3">
				<Avatar size="sm" className="shrink-0">
					<Avatar.Fallback>{application.company.slice(0, 1).toUpperCase()}</Avatar.Fallback>
				</Avatar>
				<span className="grid min-w-0 flex-1">
					<b className="truncate text-sm font-semibold">
						{application.role} · {application.company}
					</b>
					<span className="text-xs text-muted">
						<Trans>Posting from the linked application</Trans>
					</span>
				</span>
				<Button size="sm" variant="secondary" aria-expanded={changing} onPress={() => setChanging(!changing)}>
					<Trans>Change</Trans>
				</Button>
			</div>
			{changing && (
				<div className="grid gap-2">
					<ApplicationPicker
						value={application.id}
						onChange={(id) => {
							setChanging(false);
							void link(id);
						}}
					/>
					<Button
						size="sm"
						variant="ghost"
						className="w-fit"
						onPress={() => {
							setChanging(false);
							void link(null);
						}}
					>
						<Trans>Unlink this application</Trans>
					</Button>
				</div>
			)}
		</CheckWidget>
	);
}

function ApplicationPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
	const { data: applications } = useQuery(applicationsListQueryOptions());
	const choices = (applications ?? []).filter((application) => application.status !== "closed");
	// Linking changes the document's details, which a locked document keeps as they are.
	const locked = useIsResumeLocked();

	return (
		<NativeSelect fullWidth variant="secondary">
			<NativeSelect.Trigger
				aria-label={t`Link an application`}
				disabled={locked}
				value={value ?? ""}
				onChange={(event) => event.target.value && onChange(event.target.value)}
			>
				<NativeSelect.Option value="" disabled>
					{choices.length > 0 ? t`Link an application…` : t`No applications yet`}
				</NativeSelect.Option>
				{choices.map((application) => (
					<NativeSelect.Option key={application.id} value={application.id}>
						{application.role} · {application.company}
					</NativeSelect.Option>
				))}
				<NativeSelect.Indicator />
			</NativeSelect.Trigger>
		</NativeSelect>
	);
}

/**
 * C2: nothing to match against. Link an existing application first; pasting a posting is the fallback. A linked
 * application without a saved posting takes one here, saved to the application.
 */
function NoPosting({ application }: { application: JobMatch["application"] }) {
	const pasted = useEditorStore((state) => state.pastedPosting);
	const [draft, setDraft] = useState(pasted);
	const { link, isPending } = useLinkApplication();
	const queryClient = useQueryClient();
	const { mutate: savePosting, isPending: saving } = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: (_data, input) =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: applicationsListQueryKey() }),
				queryClient.invalidateQueries({
					queryKey: orpc.applications.getById.queryKey({ input: { id: input.id } }),
				}),
			]),
		onError: (error) => toastError(error, t`Couldn't save the posting. Try again.`),
	});

	if (application) {
		return (
			<CheckWidget
				icon="briefcase"
				title={
					<>
						{application.role} · {application.company}
					</>
				}
				contentClassName="gap-3"
			>
				<p className="text-sm text-muted">
					<Trans>This application has no posting saved yet. Paste it to match against it.</Trans>
				</p>
				<TextArea
					fullWidth
					variant="secondary"
					aria-label={t`Job posting`}
					rows={5}
					maxLength={MAX_POSTING_CHARS}
					value={draft}
					placeholder={t`Paste a job posting…`}
					onChange={(event) => setDraft(event.target.value)}
				/>
				<Button
					size="sm"
					className="w-fit"
					isDisabled={!draft.trim() || saving}
					onPress={() => savePosting({ id: application.id, jobDescription: draft.trim() })}
				>
					<Trans>Save to the application</Trans>
				</Button>
			</CheckWidget>
		);
	}

	return (
		<CheckWidget icon="briefcase" title={<Trans>Match against a job</Trans>} contentClassName="gap-3">
			<p className="text-sm text-muted">
				<Trans>This resume isn't linked to an application yet.</Trans>
			</p>
			<ApplicationPicker value={null} onChange={(id) => void link(id)} />
			{isPending && (
				<span className="text-xs text-muted">
					<Trans>Linking…</Trans>
				</span>
			)}
			{/* Two ways in: link an application, or paste a posting. */}
			<div className="flex items-center gap-3 text-xs text-muted">
				<Separator className="flex-1" />
				<Trans>or</Trans>
				<Separator className="flex-1" />
			</div>
			<TextArea
				fullWidth
				variant="secondary"
				aria-label={t`Job posting`}
				rows={4}
				maxLength={MAX_POSTING_CHARS}
				value={draft}
				placeholder={t`Paste a job posting…`}
				onChange={(event) => setDraft(event.target.value)}
			/>
			<Button
				size="sm"
				className="w-fit"
				isDisabled={!draft.trim()}
				onPress={() => useEditorStore.setState({ pastedPosting: draft })}
			>
				<Trans>Match this posting</Trans>
			</Button>
			<span className="text-xs text-muted">
				<Trans>A pasted posting can be saved as an application afterwards.</Trans>
			</span>
		</CheckWidget>
	);
}

/** Saves the pasted posting as a new application (company and role are required) and links the resume to it. */
function SaveAsApplication() {
	const [open, setOpen] = useState(false);
	const [company, setCompany] = useState("");
	const [role, setRole] = useState("");
	const posting = useEditorStore((state) => state.pastedPosting);
	const resumeId = useCurrentBuilderResumeSelector((resume) => resume.id);
	const queryClient = useQueryClient();
	const { link } = useLinkApplication();
	const { mutateAsync: create, isPending } = useMutation(orpc.applications.create.mutationOptions());

	if (!open) {
		return (
			<Button size="sm" variant="ghost" className="w-fit" onPress={() => setOpen(true)}>
				<Icon name="briefcase" size={16} />
				<Trans>Save as application…</Trans>
			</Button>
		);
	}

	const save = async () => {
		try {
			const id = await create({
				company: company.trim(),
				role: role.trim(),
				jobDescription: posting.trim().slice(0, MAX_POSTING_CHARS),
				resumeId,
			});
			await queryClient.invalidateQueries({ queryKey: applicationsListQueryKey() });
			await link(id);
			useEditorStore.setState({ pastedPosting: "" });
			toast.add({ description: t`Saved as an application and linked` });
		} catch (error) {
			toastError(error, t`Couldn't save the application. Try again.`);
		}
	};

	return (
		<form
			className="@container grid gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			{/* Side by side once there's room; stacked in a 300px panel. */}
			<div className="grid gap-2 @3xs:grid-cols-2">
				<TextField isRequired fullWidth value={company} onChange={setCompany}>
					<Label>
						<Trans>Company</Trans>
					</Label>
					<Input variant="secondary" />
				</TextField>
				<TextField isRequired fullWidth value={role} onChange={setRole}>
					<Label>
						<Trans>Role</Trans>
					</Label>
					<Input variant="secondary" />
				</TextField>
			</div>
			<div className="flex gap-1.5">
				<Button size="sm" type="submit" isDisabled={!company.trim() || !role.trim() || isPending}>
					<Trans>Save and link</Trans>
				</Button>
				<Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
					<Trans>Cancel</Trans>
				</Button>
			</div>
		</form>
	);
}

/** The assistant asks before adding anything, so it gets the term and a request to check first. */
function askAssistant(label: string) {
	openAssistantFrom({
		ask: t`The posting asks for “${label}”. If it's true for me, work it into my resume where it fits. Ask me first.`,
	});
}
