import type { SiteImportState } from "./use-source-runs";
import type { SourceId, SourceRun, SourceRuns } from "@rezumi/resume/profile-sources";
import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { canRetrySource, SOURCE_IDS, sourceFindings } from "@rezumi/resume/profile-sources";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import {
	siteImportNoteMessage,
	siteImportStepLabel,
	SOURCE_ICONS,
	sourceErrorMessage,
	sourceLabel,
	sourceNoteMessage,
} from "./messages";
import { RowIcon } from "@/components/layout/icon-row";
import { ENTER_CLASS, POP_CLASS, stagger } from "@/libs/motion";
import { getSectionTitle } from "@/libs/resume/section";

type SourceProgressProps = {
	runs: SourceRuns;
	/** The website's import, when the website is the person's own: its steps, then the works it found. */
	site?: SiteImportState | null;
	onRetry: (id: SourceId) => void;
	className?: string;
};

/**
 * Each source on its own line while it's read: a spinner, then what it found, or why it failed with Retry when trying
 * again can help. One source failing never holds up the others.
 */
export function SourceProgress({ runs, site = null, onRetry, className }: SourceProgressProps) {
	const shown = SOURCE_IDS.flatMap((id) => {
		const run = runs[id];
		return run ? [{ id, run }] : [];
	});
	if (shown.length === 0) return null;

	return (
		<ul aria-label={t`Your sources`} className={cn("grid gap-3", className)}>
			{shown.map(({ id, run }, index) => (
				<li key={id} className={cn(ENTER_CLASS, "flex items-start gap-3")} style={stagger(index)}>
					<RowIcon>
						<Icon name={SOURCE_ICONS[id]} size={20} className="text-muted" />
					</RowIcon>
					<div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
						<span className="flex items-center gap-2 text-sm font-medium">
							{sourceLabel(id)}
							<RunIcon run={run} />
						</span>
						<RunStatus id={id} run={run} site={id === "website" ? site : null} />
					</div>
					{run.status === "failed" && canRetrySource(run.error) && (
						<Button size="sm" variant="secondary" className={cn(ENTER_CLASS, "shrink-0")} onPress={() => onRetry(id)}>
							<Trans>Retry</Trans>
						</Button>
					)}
				</li>
			))}
		</ul>
	);
}

type RunProps = { run: SourceRun };

function RunIcon({ run }: RunProps) {
	if (run.status === "loading") return <Spinner size="sm" color="current" className="text-muted" aria-hidden />;
	if (run.status === "done")
		return <Icon key="done" name="check-circle" size={18} className={cn(POP_CLASS, "text-success")} />;
	return <Icon key="failed" name="warning-circle" size={18} className={cn(POP_CLASS, "text-danger")} />;
}

type RunStatusProps = { id: SourceId; run: SourceRun; site: SiteImportState | null };

/** The line under a source's name. Polite, so a screen reader hears each source finish without being interrupted. */
function RunStatus({ id, run, site }: RunStatusProps) {
	if (run.status === "loading" && site)
		return (
			<p role="status" className="text-body-sm text-muted">
				{siteImportStepLabel(site.progress)}
			</p>
		);

	if (run.status === "loading")
		return (
			<p role="status" className="text-body-sm text-muted">
				{id === "linkedin" ? (
					<Trans>Reading your profile…</Trans>
				) : id === "file" ? (
					<Trans>Reading the file…</Trans>
				) : (
					<Trans>Reading…</Trans>
				)}
			</p>
		);

	if (run.status === "failed")
		return (
			<p role="status" className="text-body-sm text-danger">
				{sourceErrorMessage(id, run.error)}
			</p>
		);

	const result = site?.result;
	const notes = [
		...new Set([
			...run.result.notes.flatMap((note) => sourceNoteMessage(note) ?? []),
			...(result?.notes.flatMap((note) => siteImportNoteMessage(note) ?? []) ?? []),
		]),
	];
	return (
		<div role="status" className="grid gap-0.5">
			<p className="text-body-sm text-muted">{describeFindings(run.result.data)}</p>
			{result && result.works.length > 0 && (
				<p className="text-body-sm text-muted">
					<Plural
						value={result.works.length}
						one="And # work for your portfolio"
						other="And # works for your portfolio"
					/>
				</p>
			)}
			{result?.free && (
				<p className="text-body-xs text-muted">
					<Trans>Your first website import is free.</Trans>
				</p>
			)}
			{notes.map((note) => (
				<p key={note} className="text-body-xs text-muted">
					{note}
				</p>
			))}
		</div>
	);
}

/** "Found: Experience 4 · Skills 12 · Summary · Details 2", or that nothing came in. */
function describeFindings(data: Parameters<typeof sourceFindings>[0]) {
	const findings = sourceFindings(data);
	const parts = [
		...findings.sections.map(({ type, count }) => `${getSectionTitle(type)} ${count}`),
		...(findings.summary ? [getSectionTitle("summary")] : []),
		...(findings.details > 0 ? [`${t`Details`} ${findings.details}`] : []),
	];
	if (parts.length === 0) return t`Nothing to add from here.`;
	const list = parts.join(" · ");
	return t`Found: ${list}`;
}
