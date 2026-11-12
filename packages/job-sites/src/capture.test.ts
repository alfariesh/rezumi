import { describe, expect, it } from "vite-plus/test";
import { capturedPostingSchema, MAX_CAPTURE_TEXT_CHARS, MAX_JSON_LD_BLOCKS } from "./capture";

const valid = {
	url: "https://www.linkedin.com/jobs/search/?currentJobId=1234567890",
	canonicalUrl: "https://www.linkedin.com/jobs/view/1234567890/",
	site: "linkedin",
	pageTitle: "Product Designer | Lumen Health | LinkedIn",
	jsonLd: [],
	text: "Design calm tools.",
	fields: { role: " Product Designer ", company: "Lumen Health", applyUrl: "https://lumen.example/apply" },
};

describe("capturedPostingSchema", () => {
	it("accepts a capture and trims its fields", () => {
		const parsed = capturedPostingSchema.parse(valid);
		expect(parsed.fields?.role).toBe("Product Designer");
	});

	it("accepts any other site as a null site", () => {
		expect(capturedPostingSchema.safeParse({ ...valid, site: null }).success).toBe(true);
	});

	it.each([
		["an unknown site", { site: "monster" }],
		["a non-web address", { url: "javascript:alert(1)" }],
		["a non-web apply link", { fields: { applyUrl: "data:text/html,hi" } }],
		["too much text", { text: "x".repeat(MAX_CAPTURE_TEXT_CHARS + 1) }],
		["too many JSON-LD blocks", { jsonLd: Array.from({ length: MAX_JSON_LD_BLOCKS + 1 }, () => "{}") }],
		["a missing page title", { pageTitle: undefined }],
	])("rejects %s", (_, change) => {
		expect(capturedPostingSchema.safeParse({ ...valid, ...change }).success).toBe(false);
	});
});
