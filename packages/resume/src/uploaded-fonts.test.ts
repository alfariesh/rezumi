import { expect, it } from "vite-plus/test";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { addUploadedFontFace, removeUploadedFontFamily } from "./uploaded-fonts";

const face = (weight: "400" | "700", url: string) => ({ family: "Brand Sans", weight, italic: false, url });

it("adds faces, replacing one with the same family, weight and style", () => {
	const typography = structuredClone(defaultResumeData.metadata.typography);
	addUploadedFontFace(typography, face("400", "https://rezumi.app/api/uploads/u/fonts/a.ttf"));
	addUploadedFontFace(typography, face("700", "https://rezumi.app/api/uploads/u/fonts/b.ttf"));
	addUploadedFontFace(typography, face("400", "https://rezumi.app/api/uploads/u/fonts/c.ttf"));
	expect(typography.customFonts?.map((item) => item.url)).toEqual([
		"https://rezumi.app/api/uploads/u/fonts/b.ttf",
		"https://rezumi.app/api/uploads/u/fonts/c.ttf",
	]);
});

it("removes a family and moves text set in it back to the default font", () => {
	const typography = structuredClone(defaultResumeData.metadata.typography);
	addUploadedFontFace(typography, face("400", "https://rezumi.app/api/uploads/u/fonts/a.ttf"));
	typography.body = { ...typography.body, fontFamily: "Brand Sans", fontWeights: ["400"] };
	typography.heading = { ...typography.heading, fontFamily: "Roboto", fontWeights: ["500"] };
	removeUploadedFontFamily(typography, "Brand Sans");
	expect(typography.customFonts).toEqual([]);
	expect(typography.body.fontFamily).toBe(defaultResumeData.metadata.typography.body.fontFamily);
	expect(typography.body.fontWeights).toEqual(defaultResumeData.metadata.typography.body.fontWeights);
	expect(typography.heading.fontFamily).toBe("Roboto");
});
