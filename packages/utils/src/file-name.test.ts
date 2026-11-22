import { describe, expect, it } from "vite-plus/test";
import { getDefaultFileName, sanitizeFileName } from "./file-name";

const document = (person: string, name = "My resume", slug = "my-resume") => ({
	name,
	slug,
	data: { basics: { name: person } },
});

describe("sanitizeFileName", () => {
	it("drops the characters file systems reject and trims", () => {
		expect(sanitizeFileName(' Jane: "CV"/2026? ')).toBe("Jane CV2026");
	});
});

describe("getDefaultFileName", () => {
	it("joins the person's name and the document kind with dashes", () => {
		expect(getDefaultFileName(document("Jane  Doe"))).toBe("Jane-Doe-Resume");
		expect(getDefaultFileName(document("Jane Doe"), "cover-letter")).toBe("Jane-Doe-Cover-Letter");
	});

	it("falls back to the document's name, then its slug", () => {
		expect(getDefaultFileName(document(""))).toBe("My-resume");
		expect(getDefaultFileName(document(" ", "Lumen letter"), "cover-letter")).toBe("Lumen-letter-Cover-Letter");
		expect(getDefaultFileName(document("", "", "backend-role"))).toBe("backend-role");
		expect(getDefaultFileName({ name: "", data: { basics: { name: "" } } })).toBe("Resume");
	});
});
