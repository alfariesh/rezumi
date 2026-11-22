import type { PdfAtsReport, PdfCategory } from "../ats-pdf";

export type PdfFindingGroup = {
	category: PdfCategory;
	findings: PdfAtsReport["findings"];
	/** Danger when a blocker is among them, accent when all are tips, warning otherwise. */
	tone: "danger" | "warning" | "accent";
};

const RANK = { danger: 0, warning: 1, accent: 2 } as const;

/** A PDF report's findings and tips, one group per category, worst first (the checker's issue rows). */
export function groupPdfFindings(report: Pick<PdfAtsReport, "findings" | "tips">): PdfFindingGroup[] {
	const byCategory = new Map<PdfCategory, PdfAtsReport["findings"]>();
	for (const finding of [...report.findings, ...report.tips])
		byCategory.set(finding.category, [...(byCategory.get(finding.category) ?? []), finding]);

	return [...byCategory.entries()]
		.map(([category, findings]): PdfFindingGroup => ({
			category,
			findings,
			tone: findings.some((finding) => finding.severity === "blocker")
				? "danger"
				: findings.every((finding) => finding.severity === "tip")
					? "accent"
					: "warning",
		}))
		.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
