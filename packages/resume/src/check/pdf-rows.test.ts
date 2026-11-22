import type { PdfFinding } from "../ats-pdf/types";
import { describe, expect, it } from "vite-plus/test";
import { groupPdfFindings } from "./pdf-rows";

const finding = (category: PdfFinding["category"], severity: PdfFinding["severity"]) =>
	({ code: "NO_TEXT_LAYER", category, severity }) as PdfFinding;

describe("groupPdfFindings", () => {
	it("groups by category, worst first", () => {
		const groups = groupPdfFindings({
			findings: [finding("layout", "warning"), finding("parseability", "blocker"), finding("layout", "warning")],
			tips: [finding("content", "tip")],
		});
		expect(groups.map((group) => [group.category, group.tone, group.findings.length])).toEqual([
			["parseability", "danger", 1],
			["layout", "warning", 2],
			["content", "accent", 1],
		]);
	});
});
