import type { CheckTab } from "../store";
import type { CheckIssue } from "./issues";
import type { CheckResult } from "./use-check";
import type { AtsCategory, AtsReport } from "@rezumi/resume/ats";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { CSSProperties } from "react";
import { Button, Disclosure, Modal, Spinner, Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { ATS_CATEGORIES } from "@rezumi/resume/ats";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { useCheckActions } from "./actions";
import { getCategoryDescription, getCategoryName } from "./issues";
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
		<div className="grid content-start gap-3.5 p-4 pb-12">
			<ScoreSummary report={check.report} />

			<Tabs
				selectedKey={tab}
				onSelectionChange={(key) => useEditorStore.setState({ checkTab: String(key) as CheckTab })}
				className="gap-3.5"
			>
				<Tabs.ListContainer>
					<Tabs.List aria-label={t`Check views`} className="w-full">
						<Tabs.Tab id="issues" className="gap-1.5">
							<Trans>Issues</Trans>
							<span className="font-mono text-xs text-ink-3">{check.issues.length}</span>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="match" className="gap-1.5">
							<Trans>Job match</Trans>
							{match.result && (
								<span className="font-mono text-xs text-ink-3">
									{match.result.found.length}/{match.result.total}
								</span>
							)}
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id="writing">
							<Trans>Writing</Trans>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>

				<Tabs.Panel id="issues">
					<IssuesTab check={check} />
				</Tabs.Panel>
				<Tabs.Panel id="match">
					<JobMatchTab match={match} data={check.data} />
				</Tabs.Panel>
				<Tabs.Panel id="writing">
					<WritingTab data={check.data} issues={check.issues} />
				</Tabs.Panel>
			</Tabs>
		</div>
	);
}

const getVerdict = (score: number) =>
	score >= 80 ? t`Reads cleanly` : score >= 50 ? t`Mostly readable` : t`Hard for software to read`;

/** The 84px ring (accent, or warn below 80), the verdict and what the score counts. */
function ScoreSummary({ report }: { report: AtsReport }) {
	const { score, passedRules, totalRules } = report;
	const open = report.findings.length;

	return (
		<div className="flex items-center gap-4 rounded-xl border border-line p-4">
			<div
				role="img"
				aria-label={t`Readability score: ${score} out of 100`}
				className="score-ring grid size-[84px] shrink-0 place-items-center rounded-full"
				style={
					{
						"--ring-value": `${score}%`,
						"--ring-color": score >= 80 ? "var(--accent)" : "var(--warn)",
					} as CSSProperties
				}
			>
				<span className="grid size-[70px] place-items-center rounded-full bg-surface font-display text-[26px] font-medium">
					<RollingNumber value={score} />
				</span>
			</div>

			<div className="grid min-w-0 gap-1">
				<strong className="text-[15px] font-semibold">{getVerdict(score)}</strong>
				<span className="text-[13px] leading-[19px] text-ink-2">
					<Trans>
						{passedRules} of {totalRules} checks pass.
					</Trans>{" "}
					{open > 0 ? (
						<Plural value={open} one="# thing to review." other="# things to review." />
					) : (
						<Trans>Nothing to review.</Trans>
					)}
				</span>
				<span className="flex items-center gap-1 text-xs text-ink-3">
					<Icon name="lightning" size={14} />
					<Trans>Live · updates as you edit</Trans>
				</span>
			</div>
		</div>
	);
}

function IssuesTab({ check }: { check: CheckResult }) {
	const { report, issues, data } = check;
	const selected = useEditorStore((state) => state.checkIssue);
	const { restoreIgnored } = useCheckActions();
	const locked = useIsResumeLocked();

	return (
		<div className="grid gap-2.5">
			{issues.length === 0 ? (
				<div className="flex gap-2.5 rounded-xl bg-accent-soft p-3 text-[13px] leading-[19px] text-accent-text">
					<Icon name="check-circle" />
					<p>
						<Trans>
							<strong>Nothing to fix.</strong> Every check passes.
						</Trans>
					</p>
				</div>
			) : (
				<ol aria-label={t`Issues`} className="grid gap-2.5">
					{issues.map((issue) => (
						<IssueCard key={issue.key} issue={issue} selected={selected === issue.key} locked={locked} />
					))}
				</ol>
			)}

			<CategoryRows report={report} />

			<p className="px-1 text-xs leading-[17px] text-ink-3">
				<Trans>
					The score counts how reliably software reads your resume. It doesn't predict whether you'll be shortlisted.
				</Trans>{" "}
				{report.ignored.length > 0 && (
					<>
						<Plural value={report.ignored.length} one="# issue is ignored." other="# issues are ignored." />{" "}
						<button
							type="button"
							disabled={locked}
							onClick={restoreIgnored}
							className="font-medium text-ink-2 underline underline-offset-2"
						>
							<Trans>Show them again</Trans>
						</button>
					</>
				)}
			</p>

			<DeepCheck data={data} />
		</div>
	);
}

type IssueCardProps = { issue: CheckIssue; selected: boolean; locked: boolean };

/** A numbered card: category, title, a plain explanation, the fix, Show on page and Ignore (or Keep). */
function IssueCard({ issue, selected, locked }: IssueCardProps) {
	const { fix, ignore, showOnPage } = useCheckActions();
	const titleId = `issue-${issue.number}-title`;
	const applies = issue.fix.kind === "apply";

	return (
		// Clicking a card picks it, outlining its line on the page; Show on page does the same from the keyboard.
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- the buttons inside cover the keyboard.
		<li
			data-issue-card={issue.key}
			aria-labelledby={titleId}
			onClick={() => useEditorStore.setState({ checkIssue: issue.key })}
			className={cn(
				"grid cursor-pointer gap-2.5 rounded-xl border bg-surface p-3.5 transition-[border-color,box-shadow] duration-standard",
				selected ? "border-warn shadow-e2" : "border-line",
			)}
		>
			<div className="flex items-start gap-2.5">
				<span
					aria-hidden="true"
					className="grid size-[22px] shrink-0 place-items-center rounded-sm bg-warn text-[12px] font-bold text-[oklch(0.22_0.03_80)]"
				>
					{issue.number}
				</span>
				<div className="grid min-w-0 gap-[3px]">
					<span className="font-mono text-xs text-ink-3">{getCategoryName(issue.category)}</span>
					<h3 id={titleId} className="text-sm leading-5 font-semibold">
						<span className="sr-only">
							<Trans>Issue {issue.number}:</Trans>{" "}
						</span>
						{issue.title}
					</h3>
					<p className="text-[13px] leading-[19px] text-ink-2">{issue.body}</p>
				</div>
			</div>

			{/* Touch size on phones (B1). */}
			<div className="ms-8 flex flex-wrap gap-1.5 [&_button]:max-sm:h-10 [&_button]:max-sm:px-3.5 [&_button]:max-sm:text-sm">
				<Button
					size="sm"
					variant={applies ? "primary" : "secondary"}
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
					{issue.fix.label}
				</Button>
				{issue.target && (
					<Button
						size="sm"
						variant="ghost"
						onPress={() => {
							showOnPage(issue);
						}}
					>
						<Trans>Show on page</Trans>
					</Button>
				)}
				<Button
					size="sm"
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

/** Contact details, Dates, Layout, Section headings, Writing: "n of m", open when something needs attention. */
function CategoryRows({ report }: { report: AtsReport }) {
	const [toggled, setToggled] = useState<Partial<Record<AtsCategory, boolean>>>({});
	const categories = ATS_CATEGORIES.filter((category) => report.categories[category].total > 0);

	return (
		<section aria-labelledby="check-categories" className="grid gap-2 pt-2">
			<h3 id="check-categories" className="px-1 text-xs font-semibold text-ink-3">
				<Trans>Checks by category</Trans>
			</h3>
			<div className="overflow-hidden rounded-xl border border-line">
				{categories.map((category, index) => {
					const { total, passed } = report.categories[category];
					const failing = total - passed;
					const open = toggled[category] ?? failing > 0;

					return (
						<Disclosure
							key={category}
							isExpanded={open}
							onExpandedChange={(next) => setToggled((current) => ({ ...current, [category]: next }))}
							className={cn(index > 0 && "border-t border-line")}
						>
							<Disclosure.Heading>
								<Disclosure.Trigger className="flex h-12 w-full items-center gap-2.5 px-3 text-start text-sm font-medium transition-colors duration-quick hover:bg-hover">
									<Icon
										name={failing > 0 ? "warning-circle" : "check-circle"}
										className={failing > 0 ? "text-warn-text" : "text-accent-text"}
									/>
									{getCategoryName(category)}
									<span className={cn("text-xs font-normal", failing > 0 ? "text-warn-text" : "text-ink-3")}>
										{failing > 0 ? (
											<Plural value={failing} one="# to review" other="# to review" />
										) : (
											<Trans>
												{passed} of {total}
											</Trans>
										)}
									</span>
									<Disclosure.Indicator className="ms-auto text-ink-3" />
								</Disclosure.Trigger>
							</Disclosure.Heading>
							<Disclosure.Content>
								<Disclosure.Body>
									<p className="px-3 ps-[42px] pb-3 text-[13px] leading-[19px] text-ink-2">
										{getCategoryDescription(category)}
									</p>
								</Disclosure.Body>
							</Disclosure.Content>
						</Disclosure>
					);
				})}
			</div>
		</section>
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
							<p id={reportDescriptionId} className="text-sm text-muted">
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
