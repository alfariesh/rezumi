import type { PdfAtsReport } from "@rezumi/resume/ats-pdf";
import type { CSSProperties } from "react";
import { Tooltip } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { getPdfFindingMessage } from "../messages";
import { RollingNumber } from "@/components/ui/rolling-number";

function scoreTone(score: number) {
	if (score >= 80) return { text: "text-accent-soft-foreground", bar: "bg-accent" };
	if (score >= 60) return { text: "text-warning-soft-foreground", bar: "bg-warning" };
	return { text: "text-danger-soft-foreground", bar: "bg-danger" };
}

type ScoreHeaderProps = {
	report: PdfAtsReport;
};

export function ScoreHeader({ report }: ScoreHeaderProps) {
	const tone = scoreTone(report.score);
	const [cap] = report.cappedBy;

	return (
		<div className="space-y-3 rounded-md border bg-surface p-3">
			<div className="flex items-baseline gap-2">
				<span className={cn("text-4xl leading-none font-bold tabular-nums", tone.text)}>
					<RollingNumber value={report.score} />
				</span>
				<span className="text-sm text-muted">
					<Trans>out of 100</Trans>
				</span>
			</div>

			{/* Fills from empty when the report first shows. The starting --fill needs !important to beat the inline one; it's derived through --fill so RTL still fills from the right. */}
			<div className="h-1.5 overflow-hidden rounded-sm bg-default">
				<div
					className={cn(
						"h-full translate-x-(--fill) rounded-sm transition-[translate,background-color] duration-emphasized ease-enter rtl:-translate-x-(--fill) starting:[--fill:-100%]!",
						tone.bar,
					)}
					style={{ "--fill": `${report.score - 100}%` } as CSSProperties}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
				<span>
					<Trans>
						{report.passedChecks} of {report.applicableChecks} applicable checks passed
					</Trans>
				</span>

				{report.skippedChecks > 0 && (
					<Tooltip>
						<Tooltip.Trigger>
							<span className="inline-flex cursor-help items-center gap-1 underline decoration-dotted underline-offset-2">
								<Trans>{report.skippedChecks} skipped</Trans>
								<Icon name="info" size={12} />
							</span>
						</Tooltip.Trigger>
						<Tooltip.Content placement="bottom" className="max-w-64">
							<Trans>
								Some checks need information this file does not carry: page contents that could not be inspected, or
								text in a language these checks do not cover. They count as neither a pass nor a fail.
							</Trans>
						</Tooltip.Content>
					</Tooltip>
				)}
			</div>

			{cap && (
				<p className="rounded-md bg-default/60 p-2 text-xs leading-normal text-muted">
					<Trans>The score is capped because of a blocking problem: {getPdfFindingMessage(cap).title}</Trans>
				</p>
			)}
		</div>
	);
}
