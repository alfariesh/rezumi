import { describe, expect, it } from "vite-plus/test";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { templatePresets } from "@rezumi/schema/templates";
import { applyTemplatePreset, hasTemplatePreset } from "./template-preset";

const resume = () => structuredClone(defaultResumeData);

describe("applyTemplatePreset", () => {
	it("sets the fonts, accent, keyword layout and picture shape the template was designed with", () => {
		const data = resume();
		data.picture.size = 100;
		applyTemplatePreset(data, "vector");

		expect(data.metadata.typography.heading).toMatchObject({
			fontFamily: "JetBrains Mono",
			fontWeights: ["600"],
			fontSize: 12.5,
		});
		expect(data.metadata.typography.body).toMatchObject({ fontFamily: "Inter", fontSize: 9.4, lineHeight: 1.5 });
		expect(data.metadata.design.colors.primary).toBe(templatePresets.vector.primary);
		expect(data.sections.skills.keywordLayout).toBe("tags");
		expect(data.picture).toMatchObject({ aspectRatio: 1, borderRadius: 50 });
		// Only schema keys: the preset's single `fontWeight` is written as `fontWeights`.
		expect(Object.keys(data.metadata.typography.heading).toSorted()).toEqual([
			"fontFamily",
			"fontSize",
			"fontWeights",
			"lineHeight",
		]);
	});

	it("returns layouts a preset doesn't name to their defaults", () => {
		const data = resume();
		applyTemplatePreset(data, "cendekia");
		expect(data.metadata.design.entry?.layout).toBe("date-column");

		data.metadata.design.entry = { layout: "date-column", lead: "role", accent: "bar" };
		data.sections.skills.keywordLayout = "list";
		applyTemplatePreset(data, "meridian");
		expect(data.metadata.design.entry).toEqual({ layout: "stacked", lead: "role", accent: "bar" });
		expect(data.sections.skills.keywordLayout).toBe("inline");
	});

	it("leaves text and background colours, margins and icons alone", () => {
		const data = resume();
		data.metadata.design.colors.text = "rgba(10, 10, 10, 1)";
		data.metadata.page.marginX = 20;
		data.metadata.design.icons = { ...iconDesignOf(data.metadata.design), style: "sharp" };
		applyTemplatePreset(data, "senja");

		expect(data.metadata.design.colors.text).toBe("rgba(10, 10, 10, 1)");
		expect(data.metadata.page.marginX).toBe(20);
		expect(data.metadata.design.icons?.style).toBe("sharp");
	});
});

describe("hasTemplatePreset", () => {
	it("tells whether applying the preset would change anything", () => {
		const data = resume();
		expect(hasTemplatePreset(data, "aksara")).toBe(false);
		applyTemplatePreset(data, "aksara");
		expect(hasTemplatePreset(data, "aksara")).toBe(true);
		expect(hasTemplatePreset(data, "meridian")).toBe(false);
	});
});
