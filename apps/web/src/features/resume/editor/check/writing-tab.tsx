import type { WritingNote } from "../store";
import type { CheckIssue } from "./issues";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import { Button, Chip, Spinner, buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { collectPassages } from "@rezumi/resume/proposals";
import { Icon } from "@rezumi/ui/components/icon";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { ProposalList } from "../proposals/proposal-list";
import { useEditorStore } from "../store";
import { describeEntry } from "../write/model";
import { CheckWidget } from "./check-widget";
import { getSectionName } from "./issues";
import { mapWritingReview } from "./review";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { AiProviderPicker } from "@/features/settings/integrations/components/ai-provider-picker";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/** The endpoint's caps; the text and lists are trimmed here so a long resume is never refused. */
const MAX_TEXT_CHARS = 50_000;
const MAX_FINDINGS = 120;
const MAX_PASSAGES = 120;
const MAX_PASSAGE_CHARS = 1_000;

type WritingTabProps = { data: ResumeData; issues: readonly CheckIssue[] };

/**
 * Writing: an opt-in AI review of the wording. It says what it sends before it runs, returns rewrites of bullets
 * and paragraphs as proposals to accept or reject, and is never part of the score. Its errors stay in this tab.
 */
export function WritingTab({ data, issues }: WritingTabProps) {
	const providerState = useHasUsableAiProvider();
	const { usableProviders, hasUsableProvider } = providerState;
	const [providerOverride, setProviderOverride] = useState<string | null>(null);
	const [choosing, setChoosing] = useState(false);
	const review = useEditorStore((state) => state.writingReview);
	const proposals = useEditorStore((state) => state.proposals);

	const provider = usableProviders.find((entry) => entry.id === providerOverride) ?? usableProviders[0];
	const passages = collectPassages(data, {
		summary: getSectionName(data, "summary"),
		sectionTitle: (sectionId) => getSectionName(data, sectionId),
		entryTitle: (type, entry) => describeEntry(type as never, entry as never).title,
		bullet: (n) => t`bullet ${n}`,
		paragraph: (n) => t`paragraph ${n}`,
	}).slice(0, MAX_PASSAGES);

	const { mutate, isPending, error, reset } = useMutation({
		...orpc.ai.atsReview.mutationOptions(),
		onSuccess: (result) => {
			const { proposals: next, notes } = mapWritingReview(result.suggestions, passages);
			useEditorStore.setState({
				proposals: next,
				writingReview: { summary: result.summary, strengths: result.strengths, notes },
			});
		},
	});

	const run = () => {
		reset();
		mutate({
			...(provider ? { aiProviderId: provider.id } : {}),
			extractedText: buildMarkdown(data).slice(0, MAX_TEXT_CHARS),
			findings: issues.slice(0, MAX_FINDINGS).map((issue) => ({
				code: issue.finding.code,
				severity: issue.finding.severity,
				message: issue.title.slice(0, 300),
			})),
			passages: passages.map((passage) => ({
				id: passage.id,
				where: passage.location.slice(0, 200),
				text: passage.text.slice(0, MAX_PASSAGE_CHARS),
			})),
		});
	};

	if (providerState.isUnavailable)
		return (
			// The load state brings its own padding.
			<ReviewWidget contentClassName="p-1.5">
				<AiProviderLoadState state={providerState} />
			</ReviewWidget>
		);

	if (!hasUsableProvider) {
		return (
			<ReviewWidget>
				<strong className="text-sm font-semibold">
					<Trans>A second opinion on your wording</Trans>
				</strong>
				<p className="text-sm text-muted">
					<Trans>
						Connect your own AI provider to have a language model read your bullets and suggest rewrites. Issues and Job
						match need no provider.
					</Trans>
				</p>
				<Link
					to="/dashboard/settings/app"
					hash="ai-providers"
					className={buttonVariants({ size: "sm", variant: "secondary", className: "w-fit" })}
				>
					<Trans>Open AI settings</Trans>
				</Link>
			</ReviewWidget>
		);
	}

	if (isPending) {
		return (
			<ReviewWidget>
				<div aria-busy="true" className="flex items-center gap-2.5 text-sm text-muted">
					<Spinner size="sm" color="current" aria-hidden />
					<Plural
						value={passages.length}
						one="Reading # passage of your resume…"
						other="Reading # bullets and paragraphs of your resume…"
					/>
				</div>
			</ReviewWidget>
		);
	}

	if (error) {
		return (
			<ReviewWidget>
				<div role="alert" className="flex gap-2.5 rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
					<Icon name="warning-circle" className="shrink-0" />
					<span>
						{getOrpcErrorMessage(error, {
							byCode: {
								BAD_GATEWAY: t`Couldn't reach your AI provider. Its key may have expired.`,
								BAD_REQUEST: t`The provider returned a review that couldn't be read. Try again.`,
								PRECONDITION_FAILED: t`AI providers are unavailable until ENCRYPTION_SECRET is configured.`,
							},
							fallback: t`The review couldn't finish. Try again.`,
						})}
					</span>
				</div>
				<div className="flex gap-1.5">
					<Button size="sm" onPress={run}>
						<Trans>Retry</Trans>
					</Button>
					<Link
						to="/dashboard/settings/app"
						hash="ai-providers"
						className={buttonVariants({ size: "sm", variant: "secondary" })}
					>
						<Trans>Open AI settings</Trans>
					</Link>
				</div>
				<p className="text-xs text-muted">
					<Trans>Issues and Job match still work without AI.</Trans>
				</p>
			</ReviewWidget>
		);
	}

	if (!review) {
		return (
			<ReviewWidget>
				<strong className="text-sm font-semibold">
					<Trans>A second opinion on your wording</Trans>
				</strong>
				<p className="text-sm text-muted">
					<Trans>
						The checks are mechanical. This asks a language model how a reader might react to your bullets and suggests
						rewrites. It isn't part of the score.
					</Trans>
				</p>
				<div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
					<Icon name="lock" size={16} className="shrink-0" />
					<span>
						<Trans>
							Sends your resume's text only to {provider?.label} · {provider?.model}, with your key.
						</Trans>
					</span>
					{/* An inline text action inside the sentence; a HeroUI Button would break the line. */}
					<button
						type="button"
						aria-expanded={choosing}
						className="cursor-(--cursor-interactive) font-medium text-foreground underline underline-offset-2"
						onClick={() => setChoosing(!choosing)}
					>
						<Trans>Change</Trans>
					</button>
				</div>
				{choosing && (
					<AiProviderPicker
						value={provider?.id ?? null}
						providers={usableProviders}
						onValueChange={(value) => {
							setProviderOverride(value);
							setChoosing(false);
						}}
					/>
				)}
				<Button size="sm" variant="secondary" className="w-fit" isDisabled={passages.length === 0} onPress={run}>
					<Icon name="sparkle" size={16} />
					<Trans>Review writing</Trans>
				</Button>
				{passages.length === 0 && (
					<p className="text-xs text-muted">
						<Trans>Add a summary or describe a role first; there's nothing to review yet.</Trans>
					</p>
				)}
			</ReviewWidget>
		);
	}

	return (
		<div className="grid gap-3">
			{(review.summary || review.strengths.length > 0) && (
				<ReviewWidget>
					{review.summary && <p className="text-sm text-muted">{review.summary}</p>}

					{review.strengths.length > 0 && (
						<section aria-labelledby="writing-strengths" className="grid gap-2">
							<h3 id="writing-strengths" className="text-sm font-semibold">
								<Trans>What's working</Trans>
							</h3>
							<ul className="grid list-disc gap-1 ps-[18px] text-sm text-muted">
								{review.strengths.map((strength) => (
									<li key={strength}>{strength}</li>
								))}
							</ul>
						</section>
					)}
				</ReviewWidget>
			)}

			{proposals.length > 0 && <ProposalList proposals={proposals} data={data} onSuggestAgain={run} />}

			{review.notes.length > 0 && (
				<CheckWidget icon="note" title={<Trans>Notes</Trans>} contentClassName="gap-2 p-2">
					{review.notes.map((note) => (
						<WritingNoteCard key={`${note.location}:${note.note}`} note={note} />
					))}
				</CheckWidget>
			)}

			<p className="px-2 text-xs leading-4 text-muted">
				<Trans>A model's opinion, not a verdict. It can be wrong.</Trans>{" "}
				<button
					type="button"
					className="cursor-(--cursor-interactive) font-medium text-foreground underline underline-offset-2"
					onClick={run}
				>
					<Trans>Run again</Trans>
				</button>
			</p>
		</div>
	);
}

/** The review's widget: what it is before it runs, its progress or error, then its summary and strengths. */
function ReviewWidget({ contentClassName, children }: { contentClassName?: string; children: ReactNode }) {
	return (
		<CheckWidget icon="sparkle" title={<Trans>AI review</Trans>} contentClassName={cn("gap-3", contentClassName)}>
			{children}
		</CheckWidget>
	);
}

const impactLabel = (impact: WritingNote["impact"]) => ({ high: t`High`, medium: t`Medium`, low: t`Low` })[impact];

function WritingNoteCard({ note }: { note: WritingNote }) {
	const breakpoint = useBreakpoint();

	const showOnPage = () => {
		if (!note.target) return;
		useEditorStore.setState({ selection: note.target, pageView: "page" });
		if (breakpoint === "tablet") useEditorStore.setState({ drawerOpen: false });
		if (breakpoint === "mobile") useEditorStore.setState({ mobileView: "page" });
	};

	return (
		<article className="fields-on-card grid gap-2 rounded-xl bg-surface-secondary p-3">
			<div className="flex items-start justify-between gap-2">
				<span className="min-w-0 font-mono text-xs text-muted">{note.location}</span>
				<Chip size="sm" variant="soft" color={note.impact === "high" ? "warning" : "default"}>
					{impactLabel(note.impact)}
				</Chip>
			</div>
			<p className="text-sm">
				{note.quote && <i className="text-muted">“{note.quote}”</i>} {note.note}
			</p>
			{note.target && (
				<Button size="sm" variant="secondary" className="w-fit" onPress={showOnPage}>
					<Trans>Show on page</Trans>
				</Button>
			)}
		</article>
	);
}
