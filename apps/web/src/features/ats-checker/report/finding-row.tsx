import type { PdfFinding, PdfSeverity } from "@rezumi/resume/ats-pdf";
import { Chip } from "@heroui/react";
import { match } from "ts-pattern";
import { cn } from "@rezumi/utils/style";
import { getPdfFindingMessage, getPdfSeverityLabel } from "../messages";

function severityDotClass(severity: PdfSeverity) {
	return match(severity)
		.with("blocker", () => "bg-danger")
		.with("warning", () => "bg-warning")
		.with("tip", () => "bg-accent")
		.exhaustive();
}

type FindingRowProps = {
	finding: PdfFinding;
};

export function FindingRow({ finding }: FindingRowProps) {
	const message = getPdfFindingMessage(finding.code);
	const evidence = finding.evidence;

	return (
		<li className="space-y-2 rounded-md border bg-surface p-3">
			<div className="flex items-start gap-2">
				<span className={cn("mt-1.5 size-2 shrink-0 rounded-sm", severityDotClass(finding.severity))} aria-hidden />

				<div className="min-w-0 flex-1 space-y-1">
					<p className="text-sm leading-snug font-medium">{message.title}</p>
					<p className="text-xs leading-normal text-muted">{message.action}</p>
				</div>

				<Chip size="sm" variant="soft" className="shrink-0">
					{getPdfSeverityLabel(finding.severity)}
				</Chip>
			</div>

			{(evidence?.snippet || evidence?.page !== undefined) && (
				<div className="flex flex-wrap items-center gap-2">
					{evidence.snippet && (
						<code className="min-w-0 truncate rounded bg-default px-1.5 py-0.5 font-mono text-xs text-muted">
							{evidence.snippet}
						</code>
					)}
					{evidence.page !== undefined && (
						<Chip size="sm" variant="secondary" className="shrink-0 text-xs font-normal">
							Page {evidence.page}
						</Chip>
					)}
				</div>
			)}
		</li>
	);
}
