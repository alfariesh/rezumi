import { describe, expect, it } from "vite-plus/test";
import z from "zod";
import { FREE_TEMPLATES } from "./billing/catalog";
import {
	careerFields,
	defaultTemplate,
	formerTemplateSuccessor,
	legacyTemplateSuccessors,
	readableTemplateSchema,
	templateCareerFields,
	templateInputSchema,
	templateLayouts,
	templateLineup,
	templatePresets,
	templateSchema,
	templateSummaries,
	upgradeTemplateId,
} from "./templates";

const formerIds = [
	"azurill",
	"bronzor",
	"chikorita",
	"ditgar",
	"ditto",
	"gengar",
	"glalie",
	"kakuna",
	"lapras",
	"leafish",
	"meowth",
	"onyx",
	"persian",
	"pikachu",
	"porygon",
	"rhyhorn",
	"scizor",
	"smeargle",
];

describe("template IDs", () => {
	it("names exactly the thirty-six templates, in gallery order, each once", () => {
		expect(templateSchema.options).toEqual(templateLineup);
		expect(templateLineup).toHaveLength(36);
		expect(new Set(templateLineup).size).toBe(36);
		expect(templateLineup[0]).toBe(defaultTemplate);
	});

	it("no longer names any former template", () => {
		for (const id of formerIds) expect(templateSchema.safeParse(id).success).toBe(false);
	});

	it("keeps per-template data for every template and nothing else", () => {
		const sorted = (ids: readonly string[]) => [...ids].toSorted();
		for (const record of [templateLayouts, templatePresets, templateSummaries, templateCareerFields])
			expect(sorted(Object.keys(record))).toEqual(sorted(templateLineup));
	});

	it("replaces each of the eighteen former templates with a template that exists", () => {
		expect(Object.keys(legacyTemplateSuccessors).toSorted()).toEqual(formerIds);
		for (const [former, successor] of Object.entries(legacyTemplateSuccessors)) {
			expect(templateLineup).toContain(successor);
			expect(upgradeTemplateId(former)).toBe(successor);
		}
	});
});

describe("templateCareerFields", () => {
	it("gives every template a field, and every field a free template", () => {
		for (const id of templateLineup) expect(templateCareerFields[id].length).toBeGreaterThan(0);
		for (const field of careerFields) {
			const suited = templateLineup.filter((id) => (templateCareerFields[id] as readonly string[]).includes(field));
			expect(suited.some((id) => (FREE_TEMPLATES as readonly string[]).includes(id))).toBe(true);
		}
	});
});

describe("upgradeTemplateId", () => {
	it("keeps a template, maps a former one to its successor, and falls back to the default", () => {
		for (const id of templateLineup) expect(upgradeTemplateId(id)).toBe(id);
		expect(upgradeTemplateId("onyx")).toBe("meridian");
		expect(upgradeTemplateId("ditgar")).toBe("purnama");
		expect(upgradeTemplateId("gengar")).toBe("kirana");
		expect(upgradeTemplateId("pokemon")).toBe(defaultTemplate);
		for (const unreadable of [undefined, null, 7, {}, "", "toString", "__proto__"])
			expect(upgradeTemplateId(unreadable)).toBe(defaultTemplate);
	});

	it("only treats the eighteen former IDs as former templates", () => {
		expect(formerTemplateSuccessor("scizor")).toBe("summit");
		expect(formerTemplateSuccessor("summit")).toBeUndefined();
		expect(formerTemplateSuccessor("constructor")).toBeUndefined();
		expect(formerTemplateSuccessor(undefined)).toBeUndefined();
	});
});

describe("readableTemplateSchema", () => {
	it("reads a template, a former template as its successor, and anything else as the default", () => {
		expect(readableTemplateSchema.parse("sterling")).toBe("sterling");
		expect(readableTemplateSchema.parse("persian")).toBe("sterling");
		expect(readableTemplateSchema.parse("nosepass")).toBe(defaultTemplate);
		expect(readableTemplateSchema.parse(42)).toBe(defaultTemplate);
		expect(readableTemplateSchema.parse(undefined)).toBe(defaultTemplate);
	});

	it("documents only the lineup", () => {
		const json = z.toJSONSchema(readableTemplateSchema, { io: "input" });
		expect(json).toMatchObject({ enum: [...templateLineup] });
		expect(JSON.stringify(json)).not.toMatch(/onyx|pikachu|azurill/);
	});
});

describe("templateInputSchema", () => {
	it("accepts a template and replaces a former one with its successor", () => {
		expect(templateInputSchema.parse("linen")).toBe("linen");
		expect(templateInputSchema.parse("leafish")).toBe("linen");
		expect(templateInputSchema.parse("rhyhorn")).toBe("meridian");
	});

	it("rejects an ID that was never a template instead of guessing", () => {
		for (const bad of ["nosepass", "", "constructor", 3, null])
			expect(templateInputSchema.safeParse(bad).success).toBe(false);
	});

	it("documents only the lineup", () => {
		const json = z.toJSONSchema(templateInputSchema, { io: "output" });
		expect(json).toMatchObject({ enum: [...templateLineup] });
	});
});
