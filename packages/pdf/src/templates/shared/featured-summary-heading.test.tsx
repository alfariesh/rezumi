import { describe, expect, it } from "vite-plus/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { act } from "react";
import { defaultIconDesign } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { templateLineup } from "@rezumi/schema/templates";
import { ResumeDocument } from "../../document";
import { renderToBuffer } from "../../forme/testing";

// The first page's summary has a heading unless `showHeading` is false; a resume saved before the switch existed
// (undefined) keeps it. No template draws the summary in a featured region any more, so this runs on every template.
describe.each(templateLineup)("%s summary heading", (template) => {
	it.each([
		[true, true],
		[false, false],
		[undefined, true],
	] as const)("showHeading=%s renders heading=%s", { timeout: 60_000 }, async (showHeading, expected) => {
		const data = structuredClone(defaultResumeData);
		data.metadata.typography.body.fontFamily = "Helvetica";
		data.metadata.typography.heading.fontFamily = "Helvetica";
		data.metadata.design.icons = { ...defaultIconDesign, contact: false, items: false };
		data.basics.name = "Ada Lovelace";
		data.summary.title = "Summary";
		data.summary.content = "<p>Seasoned engineer shipping reliable systems.</p>";
		data.metadata.layout.pages = [{ fullWidth: false, main: ["summary"], sidebar: [] }];
		if (showHeading === undefined) delete data.summary.showHeading;
		else data.summary.showHeading = showHeading;
		const bytes = await act(() => renderToBuffer(<ResumeDocument data={data} template={template} />));
		const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
		try {
			const document = await loading.promise;
			const page = await document.getPage(1);
			const text = (await page.getTextContent()).items.flatMap((item) => ("str" in item ? [item.str] : []));
			// Tracked capitals reach the PDF a letter at a time, so the line is read back without spaces or case.
			const joined = text.join("").replaceAll(/\s/g, "").toLowerCase();
			expect(joined.includes("summary")).toBe(expected);
		} finally {
			await loading.destroy();
		}
	});
});
