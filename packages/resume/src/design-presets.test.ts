import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import {
	ACCENTS,
	contrastOver,
	fitToPages,
	matchesFilter,
	MIN_CONTRAST,
	nextFitStep,
	parseColorInput,
	resetDesign,
	TEMPLATES,
} from "./design-presets";

describe("Fit to one page", () => {
	it("tightens density, then margins, then size, never below 9 pt", () => {
		expect(nextFitStep({ density: "roomy", margins: "wide", size: 10 })).toEqual({ density: "normal" });
		expect(nextFitStep({ density: "compact", margins: "wide", size: 10 })).toEqual({ margins: "normal" });
		expect(nextFitStep({ density: "compact", margins: "narrow", size: 10 })).toEqual({ size: 9.5 });
		expect(nextFitStep({ density: "compact", margins: "narrow", size: 9 })).toBeNull();
		// Values that match no preset jump straight to the tightest one.
		expect(nextFitStep({ density: null, margins: null, size: 10 })).toEqual({ density: "compact" });
	});

	it("stops as soon as the page fits", async () => {
		const applied: unknown[] = [];
		let pagesLeft = 2;
		const result = await fitToPages(
			{ density: "normal", margins: "normal", size: 10 },
			(step) => applied.push(step),
			async () => pagesLeft-- <= 0,
		);
		expect(result.fits).toBe(true);
		expect(applied).toEqual([{ density: "compact" }, { margins: "narrow" }]);
		expect(result.state).toEqual({ density: "compact", margins: "narrow", size: 10 });
	});
});

describe("colour input and contrast", () => {
	it("reads hex with or without # and rgb(a) in range", () => {
		expect(parseColorInput("2f5a8a")).toBe("rgba(47, 90, 138, 1)");
		expect(parseColorInput(" rgb(10, 20, 30) ")).toBe("rgba(10, 20, 30, 1)");
		expect(parseColorInput("rgba(300, 0, 0, 1)")).toBeNull();
		expect(parseColorInput("blue")).toBeNull();
	});

	it("counts transparency against white paper", () => {
		expect(contrastOver("#000000")).toBeCloseTo(21, 0);
		expect(contrastOver("rgba(0, 0, 0, 0)")).toBeCloseTo(1, 5);
		expect(ACCENTS.every((accent) => contrastOver(accent.hex) >= MIN_CONTRAST)).toBe(true);
	});
});

describe("reset design and template filters", () => {
	it("resets the look but keeps paper, language and section placement", () => {
		const metadata = structuredClone(defaultResumeData.metadata);
		metadata.typography.body.fontSize = 12;
		metadata.page.format = "letter";
		metadata.layout.pages = [{ fullWidth: true, main: ["skills"], sidebar: [] }];
		const next = produce(metadata, (draft) => resetDesign(draft));
		expect(next.typography).toEqual(defaultResumeData.metadata.typography);
		expect(next.page.format).toBe("letter");
		expect(next.layout.pages).toEqual(metadata.layout.pages);
	});

	it("filters templates by columns and ATS safety", () => {
		const one = TEMPLATES.filter((id) => matchesFilter(id, "one"));
		const two = TEMPLATES.filter((id) => matchesFilter(id, "two"));
		expect(one.length + two.length).toBe(TEMPLATES.length);
		expect(TEMPLATES.filter((id) => matchesFilter(id, "all"))).toEqual(TEMPLATES);
	});
});
