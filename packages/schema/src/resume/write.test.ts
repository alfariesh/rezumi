import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_LIMITS } from "../portfolio/limits";
import { resumeDataSchema } from "./data";
import { defaultResumeData } from "./default";
import { sampleResumeData } from "./sample";
import { parseResumeDataForWrite, RESUME_ITEM_ID_MAX_LENGTH, writableResumeDataSchema } from "./write";

describe("writableResumeDataSchema", () => {
	it("rejects deep extension data including objects hidden under a URL key", () => {
		let extension: unknown = "leaf";
		for (let index = 0; index < 100; index++) extension = { child: extension };
		for (const key of ["extension", "url"]) {
			const result = writableResumeDataSchema.safeParse({ ...defaultResumeData, [key]: extension });
			expect(result.error?.issues[0]?.message).toBe("Resume content is nested too deeply.");
		}
	});

	it.each([defaultResumeData, sampleResumeData])("accepts canonical initial resume data", (data) => {
		expect(parseResumeDataForWrite(data)).toEqual(resumeDataSchema.parse(data));
	});

	it("defaults absent legacy style rules while rejecting an explicitly invalid value", () => {
		const { styleRules: _, ...metadata } = defaultResumeData.metadata;
		const data = { ...defaultResumeData, metadata };
		expect(parseResumeDataForWrite(data).metadata.styleRules).toEqual([]);
		expect(
			writableResumeDataSchema.safeParse({
				...data,
				metadata: { ...metadata, styleRules: null },
			}).success,
		).toBe(false);
	});

	it("preserves historical stylesheet normalization", () => {
		const source = { languageVersion: 1, text: "@version 1;\nname { color: red; }\n" };
		const data = {
			...defaultResumeData,
			metadata: { ...defaultResumeData.metadata, stylesheet: { mode: "semantic", source, applied: source } },
		};
		expect(parseResumeDataForWrite(data).metadata.stylesheet).toEqual({ mode: "semantic", source });
	});

	it("does not change existing legacy style-rule filtering", () => {
		const data = {
			...defaultResumeData,
			metadata: {
				...defaultResumeData.metadata,
				styleRules: [
					{
						id: "legacy",
						label: "",
						enabled: true,
						target: { scope: "global" },
						slots: { heading: { lineHeight: 5 } },
					},
				],
			},
		};
		expect(parseResumeDataForWrite(data).metadata.styleRules).toEqual([]);
	});

	it("caps each text field and the whole document, exempting URLs from the per-field cap", () => {
		const withSummary = (content: string) => ({
			...defaultResumeData,
			summary: { ...defaultResumeData.summary, content },
		});
		const withPicture = (url: string) => ({ ...defaultResumeData, picture: { ...defaultResumeData.picture, url } });

		expect(writableResumeDataSchema.safeParse(withSummary("a".repeat(200_000))).success).toBe(true);
		expect(writableResumeDataSchema.safeParse(withSummary("a".repeat(200_001))).error?.issues[0]?.path).toEqual([
			"summary",
			"content",
		]);
		expect(writableResumeDataSchema.safeParse(withPicture(`data:,${"a".repeat(300_000)}`)).success).toBe(true);
		expect(writableResumeDataSchema.safeParse(withPicture(`data:,${"a".repeat(10_000_000)}`)).success).toBe(false);
	});

	it("rejects bounds within custom-section item arrays", () => {
		const data = {
			...defaultResumeData,
			customSections: [
				{
					...sampleResumeData.sections.skills,
					id: "custom-skills",
					type: "skills",
					items: [{ ...sampleResumeData.sections.skills.items[0], level: 6 }],
				},
			],
		};
		expect(writableResumeDataSchema.safeParse(data).success).toBe(false);
	});

	it("saves a former template ID as its successor but still rejects an ID that never existed", () => {
		const withTemplate = (template: unknown) => ({
			...defaultResumeData,
			metadata: { ...defaultResumeData.metadata, template },
		});
		expect(parseResumeDataForWrite(withTemplate("onyx")).metadata.template).toBe("meridian");
		expect(parseResumeDataForWrite(withTemplate("ditgar")).metadata.template).toBe("purnama");
		expect(parseResumeDataForWrite(withTemplate("sterling")).metadata.template).toBe("sterling");
		for (const unknown of ["nosepass", "", 7, null])
			expect(writableResumeDataSchema.safeParse(withTemplate(unknown)).success).toBe(false);
	});
});

describe("resume item ids", () => {
	const withProject = (id: string) => {
		const data = structuredClone(sampleResumeData);
		const [project] = data.sections.projects.items;
		if (!project) throw new Error("The sample has no project.");
		project.id = id;
		return data;
	};

	it("refuses an empty or overlong id anywhere a portfolio can refer to it", () => {
		for (const id of ["", "x".repeat(RESUME_ITEM_ID_MAX_LENGTH + 1)]) {
			const result = writableResumeDataSchema.safeParse(withProject(id));
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.path).toEqual(["sections", "projects", "items", 0, "id"]);
		}
		const data = structuredClone(sampleResumeData);
		const section = data.customSections[0];
		if (section) {
			section.id = "";
			expect(writableResumeDataSchema.safeParse(data).success).toBe(false);
		}
	});

	it("accepts any id up to the limit, which a portfolio can refer to", () => {
		expect(() => parseResumeDataForWrite(withProject("x".repeat(RESUME_ITEM_ID_MAX_LENGTH)))).not.toThrow();
		expect(() => parseResumeDataForWrite(withProject("project one: ü"))).not.toThrow();
		expect(RESUME_ITEM_ID_MAX_LENGTH).toBe(PORTFOLIO_LIMITS.text.id);
	});
});
