import { describe, expect, it } from "vite-plus/test";
import { normalizeWhatsAppNumber } from "./contact-form";
import { moveItem, normalizePortfolioUrl } from "./fields";

describe("addresses typed without https://", () => {
	it("get it added, and full addresses stay as typed", () => {
		expect(normalizePortfolioUrl(" linkedin.com/in/nadia ")).toBe("https://linkedin.com/in/nadia");
		expect(normalizePortfolioUrl("http://example.com")).toBe("http://example.com");
		expect(normalizePortfolioUrl("mailto:nadia@example.com")).toBe("mailto:nadia@example.com");
		expect(normalizePortfolioUrl("   ")).toBe("");
	});
});

describe("WhatsApp numbers", () => {
	it("keep digits with the country code, reading a leading 0 as Indonesian", () => {
		expect(normalizeWhatsAppNumber("0812-5550-1824")).toBe("6281255501824");
		expect(normalizeWhatsAppNumber("+62 812 5550 1824")).toBe("6281255501824");
		expect(normalizeWhatsAppNumber("+1 (415) 555-0100")).toBe("14155550100");
		expect(normalizeWhatsAppNumber("")).toBe("");
	});
});

describe("moving list items", () => {
	it("moves within bounds and ignores moves past the ends", () => {
		const items = ["a", "b", "c"];
		moveItem(items, 0, 2);
		expect(items).toEqual(["b", "c", "a"]);
		moveItem(items, 0, -1);
		moveItem(items, 2, 3);
		expect(items).toEqual(["b", "c", "a"]);
	});
});
