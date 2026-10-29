import { documentToLines } from "@rezumi/import/pdf-lines";
import { buildExtractedDocument } from "@rezumi/resume/ats-pdf";
import { extractPdf } from "@/features/ats-checker/extract-client";

export { documentToLines } from "@rezumi/import/pdf-lines";

export async function extractPdfLines(file: File): Promise<string[]> {
	return documentToLines(buildExtractedDocument(await extractPdf(file, { operatorBudgetMs: 0 })));
}
