import type { CheckTab } from "../store";
import type { CheckIssue } from "./issues";
import type { CheckResult } from "./use-check";
import type { AtsReport } from "@rezumi/resume/ats";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { Segment } from "@heroui-pro/react";
import { Button, Chip, Modal, ProgressCircle, Spinner, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { Focusable } from "react-aria-components";
import { ATS_CATEGORIES } from "@rezumi/resume/ats";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { useCheckActions } from "./actions";
import { CheckWidget } from "./check-widget";
import { getCategoryDescription, getCategoryName, getIssueTone } from "./issues";
import { JobMatchTab, useJobMatch } from "./job-match";
import { useCheck } from "./use-check";
import { WritingTab } from "./writing-tab";
import { RollingNumber } from "@/components/ui/rolling-number";
import { AtsPdfReportView } from "@/features/ats-checker/report/report-view";
import { blobToPdfFile, runAtsCheck } from "@/features/ats-checker/run-ats-check";
import { useIsResumeLocked } from "@/features/resume/builder/draft";
import { createResumePdfBlob } from "@/features/resume/export/pdf-document";

/**
 * Check: the score over the live checks, then Issues (numbered cards pinned to their lines), Job match (terms from
 * the linked application's posting, not scored) and Writing (an opt-in AI review, not scored).
 */
export function CheckPanel() {
	const check = useCheck();
	const tab = useEditorStore((state) => state.checkTab);
	const match = useJobMatch(check?.data);

	if (!check) return null;

	return (
		<div className="grid content-start gap-3 p-3">
			<ScoreSummary report={check.report} />

			<Segment
				aria-label={t`Check views`}
				selectedKey={tab}
				onSelectionChange={(key) => useEditorStore.setState({ checkTab: String(key) as CheckTab })}
				className="@container w-full"
			>
				<Segment.Item id="issues" className={SEGMENT_CLASS}>
					<Trans>Issues</Trans>
					<span className="text-xs text-muted tabular-nums">{check.issues.length}</span>
				</Segment.Item>
				<Segment.Item id="match" className={SEGMENT_CLASS}>
					<Trans>Job match</Trans>
					{/* The Posting terms widget repeats it, so a 300px panel can drop it to keep the items apart. */}
					{match.result && (
						<span className="hidden text-xs text-muted tabular-nums @xs:inline">
							{match.result.found.length}/{match.result.total}
						</span>
					)}
				</Segment.Item>
				<Segment.Item id="writing" className={SEGMENT_CLASS}>
					<Trans>Writing</Trans>
				</Segment.Item>
			</Segment>

			{tab === "match" ? (
				<JobMatchTab match={match} data={check.data} />
			) : tab === "writing" ? (
				<WritingTab data={check.data} issues={check.issues} />
			) : (
				<IssuesTab check={check} />
			)}
		</div>
	);
}

/** One line per item, sharing the width so all three fit a 300px panel. */
const SEGMENT_CLASS = "w-auto flex-1 gap-1.5 px-2 whitespace-nowrap";

const getVerdict = (score: number) =>
	score >= 80 ? t`Reads cleanly` : score >= 50 ? t`Mostly readable` : t`Hard for software to read`;

/** The score ring (accent, or warning below 80), the verdict and what the score counts. */
function ScoreSummary({ report }: { report: AtsReport }) {
	const { score, passedRules, totalRules } = report;
	const open = report.findings.length;

	return (
		<CheckWidget icon="seal-check" title={<Trans>Readability</Trans>} contentClassName="flex items-center gap-4">
			<ProgressCircle
				aria-label={t`Readability score: ${score} out of 100`}
				value={score}
				color={score >= 80 ? "accent" : "warning"}
				className="relative shrink-0"
			>
				<ProgressCircle.Track className="size-[76px]">
					<ProgressCircle.TrackCircle />
					<ProgressCircle.FillCircle />
				</ProgressCircle.Track>
				<span
					aria-hidden="true"
					className="absolute inset-0 grid place-items-center text-2xl font-semibold tabular-nums"
				>
					<RollingNumber value={score} />
				</span>
			</ProgressCircle>

			<div className="grid min-w-0 gap-1">
				<strong className="text-base font-semibold">{getVerdict(score)}</strong>
				<span className="text-sm text-muted tabular-nums">
					<Trans>
						{passedRules} of {totalRules} checks pass.
					</Trans>{" "}
					{open > 0 ? (
						<Plural value={open} one="# thing to review." other="# things to review." />
					) : (
						<Trans>Nothing to review.</Trans>
					)}
				</span>
				<span className="flex items-center gap-1 text-xs text-muted">
					<Icon name="lightning" size={14} />
					<Trans>Live · updates as you edit</Trans>
				</span>
			</div>
		</CheckWidget>
	);
}

function IssuesTab({ check }: { check: CheckResult }) {
	const { report, issues, data } = check;
	const selected = useEditorStore((state) => state.checkIssue);
	const { restoreIgnored } = useCheckActions();
	const locked = useIsResumeLocked();

	return (
		<div className="grid gap-6">
			<CheckWidget icon="list-checks" title={<Trans>Issues</Trans>}>
				{issues.length === 0 ? (
					<div className="flex gap-2.5 rounded-xl bg-success-soft p-3 text-sm text-success-soft-foreground">
						<Icon name="check-circle" className="shrink-0" />
						<p>
							<Trans>
								<strong>Nothing to fix.</strong> Every check passes.
							</Trans>
						</p>
					</div>
				) : (
					<ol aria-label={t`Issues`} className="grid gap-2">
						{issues.map((issue) => (
							<IssueCard key={issue.key} issue={issue} selected={selected === issue.key} locked={locked} />
						))}
					</ol>
				)}
			</CheckWidget>

			<CategoryRows report={report} />

			<DeepCheck data={data} />

			<p className="px-2 text-body-xs text-muted">
				<Trans>
					The score counts how reliably software reads your resume. It doesn't predict whether you'll be shortlisted.
				</Trans>{" "}
				{report.ignored.length > 0 && (
					<>
						<Plural value={report.ignored.length} one="# issue is ignored." other="# issues are ignored." />{" "}
						{/* An inline text action inside the sentence; a HeroUI Button would break the line. */}
						<button
							type="button"
							disabled={locked}
							onClick={restoreIgnored}
							className="cursor-(--cursor-interactive) font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
						>
							<Trans>Show them again</Trans>
						</button>
					</>
				)}
			</p>
		</div>
	);
}

const SELECTED_RING = { warning: "ring-2 ring-warning", danger: "ring-2 ring-danger" } as const;

type IssueCardProps = { issue: CheckIssue; selected: boolean; locked: boolean };

/** A numbered card: category, title, a plain explanation, the fix, Show on page and Ignore (or Keep). */
function IssueCard({ issue, selected, locked }: IssueCardProps) {
	const { fix, ignore, showOnPage } = useCheckActions();
	const titleId = `issue-${issue.number}-title`;
	const applies = issue.fix.kind === "apply";
	const tone = getIssueTone(issue);

	return (
		// Clicking a card picks it, outlining its line on the page; Show on page does the same from the keyboard.
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- the buttons inside cover the keyboard.
		<li
			data-issue-card={issue.key}
			aria-labelledby={titleId}
			onClick={() => useEditorStore.setState({ checkIssue: issue.key })}
			className={cn(
				"grid cursor-(--cursor-interactive) grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl bg-surface-secondary p-3 transition-[box-shadow] duration-standard fields-on-card",
				selected && SELECTED_RING[tone],
			)}
		>
			{/* The number matches the pin on the page; its colour is the issue's severity. */}
			<Chip
				aria-hidden="true"
				size="sm"
				variant="soft"
				color={tone}
				className="min-w-6 justify-center self-start tabular-nums"
			>
				{issue.number}
			</Chip>
			<div className="grid min-w-0 gap-1">
				<span className="text-xs text-muted">{getCategoryName(issue.category)}</span>
				<h3 id={titleId} className="text-sm font-semibold">
					<span className="sr-only">
						<Trans>Issue {issue.number}:</Trans>{" "}
					</span>
					{issue.title}
				</h3>
				<p className="text-body-sm text-muted">{issue.body}</p>
			</div>

			{/* Default size: 40px on phones (B1), 36px from tablets up. The picked card's fix is the primary action. */}
			<div className="col-start-2 flex min-w-0 flex-wrap gap-1.5">
				<Button
					variant={applies && selected ? "primary" : "secondary"}
					className="max-w-full"
					isDisabled={locked && applies}
					onPress={() => {
						fix(issue);
					}}
				>
					{issue.fix.kind === "apply" ? (
						<Icon name={issue.fix.icon} size={16} />
					) : (
						<Icon name="pencil-simple" size={16} />
					)}
					{/* A fix can name a long value ("Use https://…"); it truncates rather than widening the card. */}
					<span className="truncate">{issue.fix.label}</span>
				</Button>
				{issue.target && (
					<Button
						variant="ghost"
						onPress={() => {
							showOnPage(issue);
						}}
					>
						<Trans>Show on page</Trans>
					</Button>
				)}
				<Button
					variant="ghost"
					isDisabled={locked}
					onPress={() => {
						ignore(issue);
					}}
				>
					{issue.keepLabel ? <Trans>Keep</Trans> : <Trans>Ignore</Trans>}
				</Button>
			</div>
		</li>
	);
}

/** Contact details, Dates, Layout, Section headings, Writing: one white row each, "n of m" or how many to review. */
function CategoryRows({ report }: { report: AtsReport }) {
	const categories = ATS_CATEGORIES.filter((category) => report.categories[category].total > 0);

	return (
		<CheckWidget icon="squares-four" title={<Trans>Checks by category</Trans>} contentClassName="gap-2">
			{categories.map((category) => {
				const { total, passed } = report.categories[category];
				const failing = total - passed;

				return (
					<Tooltip key={category}>
						<Focusable>
							<div className="flex h-11 items-center gap-2.5 rounded-xl bg-surface px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus">
								<Icon
									name={failing > 0 ? "warning-circle" : "check-circle"}
									className={cn("shrink-0", failing > 0 ? "text-warning" : "text-accent")}
								/>
								{getCategoryName(category)}
								<span className="ms-auto text-xs font-normal text-muted tabular-nums">
									{failing > 0 ? (
										<Plural value={failing} one="# to review" other="# to review" />
									) : (
										<Trans>
											{passed} of {total}
										</Trans>
									)}
								</span>
							</div>
						</Focusable>
						<Tooltip.Content placement="top" className="max-w-64">
							{getCategoryDescription(category)}
						</Tooltip.Content>
					</Tooltip>
				);
			})}
		</CheckWidget>
	);
}

/** Renders the resume to a PDF and runs the file-level engine on it; null when either step fails. */
async function checkExportedPdf(data: ResumeData) {
	try {
		const blob = await createResumePdfBlob(data);
		return await runAtsCheck(blobToPdfFile(blob, "resume.pdf"));
	} catch {
		return null;
	}
}

/**
 * Also check the exported PDF: renders it, runs the file-level engine on it in this tab and reports in a toast.
 * What it found is pinned to the page, and its full report opens from the toast or a pin.
 */
function DeepCheck({ data }: { data: ResumeData }) {
	const [running, setRunning] = useState(false);
	const reportDescriptionId = useId();
	const report = useEditorStore((state) => state.exportCheck?.report ?? null);
	const reportOpen = useEditorStore((state) => state.exportReportOpen);

	const run = async () => {
		setRunning(true);
		const result = await checkExportedPdf(data);
		setRunning(false);
		if (!result) {
			toast.add({ type: "error", description: t`The exported PDF couldn't be checked. Try again.` });
			return;
		}

		const problems = result.report.findings.length;
		useEditorStore.setState({ exportCheck: { report: result.report, data } });

		toast.add(
			problems === 0
				? { description: t`Exported PDF checked: it reads cleanly too.` }
				: {
						description: t`Exported PDF checked: ${problems} more to look at.`,
						actionProps: { children: t`Show`, onClick: () => useEditorStore.setState({ exportReportOpen: true }) },
					},
		);
	};

	return (
		<>
			<Button variant="ghost" size="sm" className="w-fit" isDisabled={running} onPress={() => void run()}>
				{running ? <Spinner size="sm" color="current" aria-hidden /> : <Icon name="file-pdf" size={18} />}
				{running ? <Trans>Checking the exported PDF…</Trans> : <Trans>Also check the exported PDF</Trans>}
			</Button>

			<Modal.Backdrop
				isOpen={reportOpen && report !== null}
				onOpenChange={(open) => useEditorStore.setState({ exportReportOpen: open })}
			>
				<Modal.Container size="lg">
					<Modal.Dialog aria-describedby={reportDescriptionId}>
						<Modal.CloseTrigger aria-label={t`Close`} />
						<Modal.Header>
							<Modal.Heading>
								<Trans>The exported PDF</Trans>
							</Modal.Heading>
							<p id={reportDescriptionId} className="text-body-sm text-muted">
								<Trans>
									What the file-level check found in the PDF you'd send. It ran in this tab; nothing was uploaded.
								</Trans>
							</p>
						</Modal.Header>
						<Modal.Body>{report && <AtsPdfReportView report={report} />}</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}
