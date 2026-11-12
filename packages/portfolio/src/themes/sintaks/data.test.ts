import { describe, expect, it } from "vite-plus/test";
import { languageColor, shortHash, terminalUser } from "./data";

describe("Sintaks data", () => {
	it("gives each entry a stable seven-digit hash", () => {
		expect(shortHash("e1")).toMatch(/^[\da-f]{7}$/);
		expect(shortHash("e1")).toBe(shortHash("e1"));
		expect(shortHash("e1")).not.toBe(shortHash("e2"));
		// A hash below 2^28 still has seven digits.
		expect(shortHash("")).toHaveLength(7);
	});

	it("colours a tag by its text, whatever its case or spaces", () => {
		expect(languageColor("Go")).toMatch(/^#[\dA-F]{6}$/);
		expect(languageColor(" go ")).toBe(languageColor("Go"));
	});

	it("names the terminal's user after the first word of the name", () => {
		expect(terminalUser("Raka Pratama")).toBe("raka");
		expect(terminalUser("  O'Neil Smith")).toBe("oneil");
		expect(terminalUser("رقية العلي")).toBe("رقية");
		expect(terminalUser("Prameswarikusumaningrum Dewi")).toBe("prameswarikusuma");
		expect(terminalUser("")).toBe("guest");
		expect(terminalUser("!!!")).toBe("guest");
	});
});
